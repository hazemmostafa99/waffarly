/**
 * Coordinates changes to an order as it moves from waiting to preparation, handover or cancellation.
 * Each change and its stock effects are saved together.
 */
import { orderTransitionInclude, type OrderTransitionCommand } from './order-transition.types.js';
import { assertOrderTransitionAccess } from './order-transition-access.js';
import { acceptOrder } from './accept-order.js';
import {
  startOrderPreparation,
  markWholeOrderReady,
  markKitchenLineReady,
} from './prepare-order.js';
import { handoverOrder } from './handover-order.js';
import { cancelPosOrder, cancelAcceptedOrder } from './cancel-order.js';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AcceptRecipeOrderRequest,
  CancelPosOrderRequest,
  CancelRecipeOrderRequest,
  HandoverPosOrderRequest,
  MarkOrderReadyRequest,
  MarkKitchenItemReadyRequest,
  StartOrderPreparationRequest,
  PosEmployeeSession,
  StorefrontOrderSummary,
} from '@waffarly/contracts';

import type { Prisma } from '@waffarly/database';
import { createHash } from 'node:crypto';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { ProductConsumptionService } from '../../catalog/index.js';
import { InventoryLedgerService } from '../../inventory/index.js';
import { toSummary } from '../mapping/order.mapper.js';
import { lockBranchOperationShift } from '../../shifts/index.js';

import {
  acceptRecipeOrderSchema,
  cancelRecipeOrderSchema,
  markOrderReadySchema,
  markKitchenItemReadySchema,
  handoverPosOrderSchema,
  cancelPosOrderCommandSchema,
  startOrderPreparationSchema,
} from './order-lifecycle.schemas.js';

@Injectable()
export class OrderLifecycleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductConsumptionService) private readonly consumption: ProductConsumptionService,
    @Inject(InventoryLedgerService) private readonly ledger: InventoryLedgerService,
  ) {}

  accept(merchantId: string, actor: string, orderId: string, input: AcceptRecipeOrderRequest) {
    return this.applyOrderTransition(merchantId, actor, orderId, {
      action: 'accept',
      input: parseRequest(acceptRecipeOrderSchema, input),
    });
  }

  acceptFromPos(
    merchantId: string,
    actor: string,
    orderId: string,
    input: AcceptRecipeOrderRequest,
    branchIds: readonly string[],
  ) {
    const parsed = parseRequest(acceptRecipeOrderSchema, input);
    if (!branchIds.includes(parsed.branchId))
      throw new ForbiddenException('This employee is not assigned to the selected branch.');
    return this.applyOrderTransition(
      merchantId,
      actor,
      orderId,
      { action: 'accept', input: parsed },
      branchIds,
    );
  }
  startPreparation(
    merchantId: string,
    actor: string,
    orderId: string,
    input: StartOrderPreparationRequest,
  ) {
    return this.applyOrderTransition(merchantId, actor, orderId, {
      action: 'prepare',
      input: parseRequest(startOrderPreparationSchema, input),
    });
  }

  startPreparationFromPos(
    merchantId: string,
    actor: string,
    orderId: string,
    input: StartOrderPreparationRequest,
    branchIds: readonly string[],
  ) {
    return this.applyOrderTransition(
      merchantId,
      actor,
      orderId,
      { action: 'prepare', input: parseRequest(startOrderPreparationSchema, input) },
      branchIds,
    );
  }

  markReadyFromPos(
    merchantId: string,
    actor: string,
    orderId: string,
    input: MarkOrderReadyRequest,
    branchIds: readonly string[],
  ) {
    return this.applyOrderTransition(
      merchantId,
      actor,
      orderId,
      { action: 'ready', input: parseRequest(markOrderReadySchema, input) },
      branchIds,
    );
  }

  markKitchenItemReadyFromPos(
    merchantId: string,
    actor: string,
    orderId: string,
    lineId: string,
    input: MarkKitchenItemReadyRequest,
    branchIds: readonly string[],
  ) {
    return this.applyOrderTransition(
      merchantId,
      actor,
      orderId,
      {
        action: 'ready_item',
        lineId,
        input: parseRequest(markKitchenItemReadySchema, input),
      },
      branchIds,
    );
  }

  handoverFromPos(
    merchantId: string,
    actor: string,
    orderId: string,
    input: HandoverPosOrderRequest,
    branchIds: readonly string[],
  ) {
    return this.applyOrderTransition(
      merchantId,
      actor,
      orderId,
      { action: 'handover', input: parseRequest(handoverPosOrderSchema, input) },
      branchIds,
    );
  }

  cancel(merchantId: string, actor: string, orderId: string, input: CancelRecipeOrderRequest) {
    return this.applyOrderTransition(merchantId, actor, orderId, {
      action: 'cancel',
      input: parseRequest(cancelRecipeOrderSchema, input),
    });
  }

  cancelPosFromPos(
    employee: PosEmployeeSession,
    orderId: string,
    input: Pick<CancelPosOrderRequest, 'requestId' | 'branchId' | 'reason'>,
    approverEmployeeId?: string,
  ) {
    const parsed = parseRequest(cancelPosOrderCommandSchema, {
      requestId: input.requestId,
      reason: input.reason,
    });
    return this.applyOrderTransition(
      employee.merchantId,
      `pos:${employee.id}`,
      orderId,
      {
        action: 'pos_cancel',
        branchId: input.branchId,
        input: parsed,
        ...(approverEmployeeId ? { approverEmployeeId } : {}),
      },
      employee.branches.map((branch) => branch.id),
      { employeeId: employee.id, branchId: input.branchId },
    );
  }

  // Coordinate state, stock effects and the recorded action in one transaction.
  private async applyOrderTransition(
    merchantId: string,
    actor: string,
    orderId: string,
    command: OrderTransitionCommand,
    branchIds?: readonly string[],
    posCancelActor?: { employeeId: string; branchId: string },
  ): Promise<StorefrontOrderSummary> {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ orderId, ...command }))
      .digest('hex');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // 1. Keep the shift and order stable while this change is saved.
          // Lock the shift first to match payment and shift-close operations.
          const operationTarget = await tx.storefrontOrder.findFirst({
            where: { id: orderId, merchantId },
            select: { source: true, branchId: true },
          });
          const operationBranch =
            operationTarget?.branchId ??
            (command.action === 'accept' ? command.input.branchId : null);
          const operationShift =
            operationTarget?.source === 'storefront'
              ? await lockBranchOperationShift(tx, merchantId, operationBranch)
              : null;
          const locked = await tx.$queryRaw<
            Array<{ id: string }>
          >`SELECT "id" FROM "storefront_orders" WHERE "id" = ${orderId}::uuid AND "merchantId" = ${merchantId}::uuid FOR UPDATE`;
          if (locked.length !== 1) throw new NotFoundException('Order was not found.');
          // 2. Check who can change this order before returning a previous result.
          await assertOrderTransitionAccess(
            tx,
            merchantId,
            orderId,
            command,
            branchIds,
            posCancelActor,
          );
          // 3. Return the earlier result when this exact request already succeeded.
          const replay = await tx.storefrontOrderAction.findUnique({
            where: { merchantId_requestId: { merchantId, requestId: command.input.requestId } },
          });
          if (replay) {
            if (
              replay.fingerprint !== fingerprint ||
              (command.action === 'pos_cancel' && replay.createdBy !== actor) ||
              (command.action === 'pos_cancel' && replay.action !== 'pos_cancel')
            )
              throw new ConflictException(
                'The request ID was already used for a different order action.',
              );
            return replay.result as unknown as StorefrontOrderSummary;
          }
          const order = await tx.storefrontOrder.findFirstOrThrow({
            where: { id: orderId, merchantId },
            include: orderTransitionInclude,
          });
          // A completed retry is returned above without a new status write.
          if (
            order.source === 'storefront' &&
            (!operationShift || (order.branchId && order.branchId !== operationBranch))
          )
            throw new ConflictException({
              message: "Open a cashier shift at this order's branch before changing its status.",
              code: 'ORDER_SHIFT_REQUIRED',
            });
          const recipeLines = order.lines.filter(
            (line) => line.stockHandling === 'recipe_acceptance',
          );
          const isDispatchedPosOrder = order.source === 'pos' && order.kitchenTicket !== null;
          const isRoutedStorefrontOrder = order.source === 'storefront' && order.branchId !== null;
          if (
            isRoutedStorefrontOrder &&
            command.action === 'accept' &&
            order.branchId !== command.input.branchId
          )
            throw new ConflictException('Accept this order at its receiving branch.');
          if (
            command.action !== 'pos_cancel' &&
            !recipeLines.length &&
            !isDispatchedPosOrder &&
            !isRoutedStorefrontOrder
          )
            throw new ConflictException('This action is only available for new recipe orders.');
          if (command.action === 'cancel' && !recipeLines.length && !isRoutedStorefrontOrder)
            throw new ConflictException('POS cancellation requires the cancellation workflow.');
          if (isRoutedStorefrontOrder && command.action === 'cancel') {
            const payment = await tx.posOrderPayment.findFirst({
              where: { orderId, merchantId },
              select: { id: true },
            });
            if (payment)
              throw new ConflictException(
                'A collected pickup requires financial review before cancellation.',
              );
          }
          // 4. Apply the requested change using the same saved order and transaction.
          if (command.action === 'accept') {
            await acceptOrder(tx, order, command, merchantId, actor, this.consumption, this.ledger);
          } else if (command.action === 'prepare') {
            await startOrderPreparation(tx, order);
          } else if (command.action === 'ready') {
            await markWholeOrderReady(tx, order);
          } else if (command.action === 'ready_item') {
            await markKitchenLineReady(tx, order, command, merchantId);
          } else if (command.action === 'handover') {
            await handoverOrder(tx, order, merchantId);
          } else if (command.action === 'pos_cancel') {
            await cancelPosOrder(
              tx,
              order,
              command,
              merchantId,
              actor,
              this.ledger,
              posCancelActor,
            );
          } else if (command.action === 'cancel') {
            await cancelAcceptedOrder(tx, order, command, merchantId, actor, this.ledger);
          }
          // 5. Save the result so retrying cannot apply the change twice.
          const saved = toSummary(
            await tx.storefrontOrder.findFirstOrThrow({
              where: { id: orderId, merchantId },
              include: orderTransitionInclude,
            }),
          );
          await tx.storefrontOrderAction.create({
            data: {
              merchantId,
              orderId,
              requestId: command.input.requestId,
              action: command.action,
              fingerprint,
              result: saved as unknown as Prisma.InputJsonValue,
              createdBy: actor,
              ...(command.action === 'pos_cancel'
                ? { approvedByPosEmployeeId: command.approverEmployeeId ?? null }
                : {}),
            },
          });
          return saved;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (isSerializationConflict(error) || isUniqueConstraintError(error))
        throw new ConflictException(
          'Order or inventory changed concurrently. Retry the same request.',
        );
      throw error;
    }
  }
}
