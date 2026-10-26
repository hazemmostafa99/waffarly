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
import { isPosEmployeeRole, resolvePosEmployeePermissions } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash } from 'node:crypto';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { calculateInventoryRequirements, ProductConsumptionService } from '../catalog/index.js';
import { InventoryLedgerService } from '../inventory/index.js';
import { toSummary } from './order.mapper.js';
import { posKitchenTicketInclude } from './pos-kitchen.persistence.js';
import {
  acceptRecipeOrderSchema,
  cancelRecipeOrderSchema,
  markOrderReadySchema,
  markKitchenItemReadySchema,
  handoverPosOrderSchema,
  cancelPosOrderCommandSchema,
  startOrderPreparationSchema,
} from './order-lifecycle.schemas.js';
import {
  consumeOrderRequirements,
  resolveConsumptionWarehouse,
  restoreOrderConsumption,
} from './order-stock.persistence.js';

const orderInclude = {
  kitchenTicket: posKitchenTicketInclude,
  diningSession: { select: { table: { select: { code: true } } } },
  lines: {
    orderBy: { position: 'asc' as const },
    include: {
      selections: {
        orderBy: [{ groupPosition: 'asc' as const }, { optionPosition: 'asc' as const }],
      },
      variantAttributes: { orderBy: { position: 'asc' as const } },
      stockRequirements: { orderBy: { position: 'asc' as const } },
    },
  },
};
type Action =
  | { action: 'accept'; input: AcceptRecipeOrderRequest }
  | { action: 'prepare'; input: StartOrderPreparationRequest }
  | { action: 'ready'; input: MarkOrderReadyRequest }
  | { action: 'ready_item'; input: MarkKitchenItemReadyRequest; lineId: string }
  | { action: 'handover'; input: HandoverPosOrderRequest }
  | { action: 'cancel'; input: CancelRecipeOrderRequest }
  | {
      action: 'pos_cancel';
      branchId: string;
      input: Pick<CancelPosOrderRequest, 'requestId' | 'reason'>;
      approverEmployeeId?: string;
    };

@Injectable()
export class OrderLifecycleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductConsumptionService) private readonly consumption: ProductConsumptionService,
    @Inject(InventoryLedgerService) private readonly ledger: InventoryLedgerService,
  ) {}

  accept(merchantId: string, actor: string, orderId: string, input: AcceptRecipeOrderRequest) {
    return this.run(merchantId, actor, orderId, {
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
    return this.run(merchantId, actor, orderId, { action: 'accept', input: parsed }, branchIds);
  }
  startPreparation(
    merchantId: string,
    actor: string,
    orderId: string,
    input: StartOrderPreparationRequest,
  ) {
    return this.run(merchantId, actor, orderId, {
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
    return this.run(
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
    return this.run(
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
    return this.run(
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
    return this.run(
      merchantId,
      actor,
      orderId,
      { action: 'handover', input: parseRequest(handoverPosOrderSchema, input) },
      branchIds,
    );
  }

  cancel(merchantId: string, actor: string, orderId: string, input: CancelRecipeOrderRequest) {
    return this.run(merchantId, actor, orderId, {
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
    return this.run(
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

  private async run(
    merchantId: string,
    actor: string,
    orderId: string,
    command: Action,
    branchIds?: readonly string[],
    posCancelActor?: { employeeId: string; branchId: string },
  ): Promise<StorefrontOrderSummary> {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ orderId, ...command }))
      .digest('hex');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const locked = await tx.$queryRaw<
            Array<{ id: string }>
          >`SELECT "id" FROM "storefront_orders" WHERE "id" = ${orderId}::uuid AND "merchantId" = ${merchantId}::uuid FOR UPDATE`;
          if (locked.length !== 1) throw new NotFoundException('Order was not found.');
          if (
            branchIds &&
            command.action === 'accept' &&
            !branchIds.includes(command.input.branchId)
          )
            throw new ForbiddenException('This employee is not assigned to the selected branch.');
          if (
            branchIds &&
            (command.action === 'prepare' ||
              command.action === 'ready' ||
              command.action === 'ready_item' ||
              command.action === 'handover')
          ) {
            const routed = await tx.storefrontOrder.findFirst({
              where: {
                id: orderId,
                merchantId,
                branchId: { in: [...branchIds] },
                OR: [
                  { source: 'pos', kitchenTicket: { isNot: null } },
                  { lines: { some: { stockHandling: 'recipe_acceptance' } } },
                ],
              },
              select: { id: true },
            });
            if (!routed) throw new NotFoundException('Order was not found.');
          }
          if (command.action === 'pos_cancel') {
            if (
              !posCancelActor ||
              command.branchId !== posCancelActor.branchId ||
              !branchIds?.includes(posCancelActor.branchId)
            )
              throw new ForbiddenException('This employee is not assigned to the selected branch.');
            const actorEmployee = await tx.posEmployee.findFirst({
              where: {
                id: posCancelActor.employeeId,
                merchantId,
                active: true,
                branches: {
                  some: {
                    merchantId,
                    branchId: posCancelActor.branchId,
                    branch: { archivedAt: null },
                  },
                },
              },
              select: { role: true, permissions: true },
            });
            const actorPermissions = actorEmployee
              ? resolvePosEmployeePermissions(
                  isPosEmployeeRole(actorEmployee.role) ? actorEmployee.role : null,
                  actorEmployee.permissions,
                )
              : [];
            if (!actorEmployee || !actorPermissions.includes('sell'))
              throw new ForbiddenException('This employee is no longer authorized to sell.');
            if (!command.approverEmployeeId && !actorPermissions.includes('approve_voids'))
              throw new ForbiddenException('Supervisor approval is required to cancel this order.');
            if (command.approverEmployeeId) {
              if (command.approverEmployeeId === posCancelActor.employeeId)
                throw new ForbiddenException('A different supervisor must approve this action.');
              const approver = await tx.posEmployee.findFirst({
                where: {
                  id: command.approverEmployeeId,
                  merchantId,
                  active: true,
                  branches: {
                    some: {
                      merchantId,
                      branchId: posCancelActor.branchId,
                      branch: { archivedAt: null },
                    },
                  },
                },
                select: { role: true, permissions: true },
              });
              const approverPermissions = approver
                ? resolvePosEmployeePermissions(
                    isPosEmployeeRole(approver.role) ? approver.role : null,
                    approver.permissions,
                  )
                : [];
              if (!approver || !approverPermissions.includes('approve_voids'))
                throw new ForbiddenException('The supervisor approval is no longer valid.');
            }
          }
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
            include: orderInclude,
          });
          const recipeLines = order.lines.filter(
            (line) => line.stockHandling === 'recipe_acceptance',
          );
          const isDispatchedPosOrder = order.source === 'pos' && order.kitchenTicket !== null;
          if (command.action !== 'pos_cancel' && !recipeLines.length && !isDispatchedPosOrder)
            throw new ConflictException('This action is only available for new recipe orders.');
          if (command.action === 'cancel' && !recipeLines.length)
            throw new ConflictException('POS cancellation requires the cancellation workflow.');
          if (command.action === 'accept') {
            if (order.status !== 'pending')
              throw new ConflictException('Only pending orders can be accepted.');
            if (order.source === 'pos' && !order.kitchenTicket)
              throw new ConflictException(
                'Send this POS order to the kitchen before accepting it.',
              );
            if (order.source === 'pos' && order.branchId !== command.input.branchId)
              throw new ConflictException('A POS order must be accepted at its assigned branch.');
            const warehouse = recipeLines.length
              ? await resolveConsumptionWarehouse(tx, merchantId, command.input.branchId)
              : null;
            const snapshotted = recipeLines.filter((line) => line.stockRequirementsFrozenAt);
            const legacy = recipeLines.filter((line) => !line.stockRequirementsFrozenAt);
            const legacyRequirements = legacy.length
              ? await this.consumption.requirements(
                  tx,
                  merchantId,
                  legacy.map((line) => ({
                    productId: line.productId,
                    variantId: line.variantId,
                    quantity: line.quantity,
                    selections: line.selections.map((selection) => ({
                      modifierGroupId: selection.modifierGroupId,
                      modifierOptionId: selection.modifierOptionId,
                      quantity: selection.quantity,
                    })),
                  })),
                )
              : [];
            const requirements = calculateInventoryRequirements(
              [
                ...legacyRequirements.map((requirement) => ({
                  stockItemId: requirement.stockItemId,
                  baseUnit: requirement.baseUnit,
                  baseQuantity: requirement.quantity,
                })),
                ...snapshotted.flatMap((line) =>
                  (line.stockRequirements ?? []).map((requirement) => ({
                    stockItemId: requirement.stockItemId,
                    baseUnit:
                      requirement.baseUnit as (typeof legacyRequirements)[number]['baseUnit'],
                    baseQuantity: requirement.quantity.toString(),
                  })),
                ),
              ],
              1,
            );
            if (warehouse && requirements.length) {
              await consumeOrderRequirements(
                tx,
                this.ledger,
                merchantId,
                actor,
                orderId,
                warehouse.id,
                requirements,
              );
            }
            await tx.storefrontOrder.update({
              where: { id: orderId },
              data: {
                status: 'accepted',
                ...(warehouse
                  ? {
                      branchId: warehouse.branchId,
                      warehouseId: warehouse.id,
                      branchName: warehouse.branch.name,
                      warehouseName: warehouse.name,
                    }
                  : {}),
                acceptedAt: new Date(),
              },
            });
          } else if (command.action === 'prepare') {
            if (order.status !== 'accepted' || order.preparationStartedAt)
              throw new ConflictException(
                'Only accepted orders awaiting preparation can start preparation.',
              );
            await tx.storefrontOrder.update({
              where: { id: orderId },
              data: { status: 'preparing', preparationStartedAt: new Date() },
            });
          } else if (command.action === 'ready') {
            if (order.status !== 'preparing')
              throw new ConflictException('Only orders being prepared can be marked ready.');
            if (isDispatchedPosOrder)
              throw new ConflictException('Mark each kitchen item ready before handover.');
            await tx.storefrontOrder.update({
              where: { id: orderId },
              data: { status: 'ready', readyAt: new Date() },
            });
          } else if (command.action === 'ready_item') {
            if (!isDispatchedPosOrder)
              throw new ConflictException(
                'Item readiness is only available for POS kitchen tickets.',
              );
            const line = order.lines.find((candidate) => candidate.id === command.lineId);
            if (!line) throw new NotFoundException('Kitchen item was not found.');
            if (line.kitchenReadyAt) {
              if (order.status !== 'ready')
                throw new ConflictException('This ticket readiness changed. Refresh and retry.');
            } else {
              if (order.status !== 'preparing')
                throw new ConflictException('Start preparation before marking an item ready.');
              const itemReadyAt = new Date();
              const updated = await tx.storefrontOrderLine.updateMany({
                where: { id: line.id, orderId, merchantId, kitchenReadyAt: null },
                data: { kitchenReadyAt: itemReadyAt },
              });
              if (updated.count !== 1)
                throw new ConflictException('This kitchen item changed. Refresh and retry.');
              const allItemsReady = order.lines.every(
                (candidate) => candidate.id === line.id || candidate.kitchenReadyAt !== null,
              );
              if (allItemsReady)
                await tx.storefrontOrder.update({
                  where: { id: orderId },
                  data: { status: 'ready', readyAt: itemReadyAt },
                });
            }
          } else if (command.action === 'handover') {
            if (
              await tx.posDelivery.findFirst({
                where: { orderId, merchantId },
                select: { orderId: true },
              })
            )
              throw new ConflictException(
                'Confirm customer delivery from the delivery follow-up screen.',
              );
            if (order.source !== 'pos' || !order.kitchenTicket)
              throw new ConflictException('Only ticketed POS orders can be handed over here.');
            if (order.status !== 'ready')
              throw new ConflictException('Only ready orders can be handed over.');

            const checks = await tx.posOrderCheck.findMany({
              where: { orderId, merchantId },
              select: { id: true, settledAt: true, cancelledAt: true },
            });
            if (!checks.length || checks.some((check) => !check.settledAt))
              throw new ConflictException('Settle every check for this order before handover.');

            let sessionForClosure: {
              id: string;
              orders: Array<{
                id: string;
                status: string;
                checks: Array<{ settledAt: Date | null; cancelledAt: Date | null }>;
              }>;
            } | null = null;
            if (order.posDiningSessionId) {
              const session = await tx.posDiningSession.findFirst({
                where: { id: order.posDiningSessionId, merchantId, status: 'open' },
                select: { id: true, tableId: true, branchId: true },
              });
              if (!session)
                throw new ConflictException('The dining table session is no longer open.');
              const tableLock = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id" FROM "pos_dining_tables"
                WHERE "id" = ${session.tableId}::uuid
                  AND "branchId" = ${session.branchId}::uuid
                  AND "merchantId" = ${merchantId}::uuid
                FOR UPDATE`;
              if (!tableLock.length)
                throw new ConflictException('The dining table is no longer available.');
              const sessionLock = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id" FROM "pos_dining_sessions"
                WHERE "id" = ${session.id}::uuid
                  AND "merchantId" = ${merchantId}::uuid
                  AND "status" = 'open'
                FOR UPDATE`;
              if (!sessionLock.length)
                throw new ConflictException('The dining table session is no longer open.');
              const lockedSession = await tx.posDiningSession.findFirst({
                where: { id: session.id, merchantId, status: 'open', tableId: session.tableId },
                select: {
                  id: true,
                  orders: {
                    select: {
                      id: true,
                      status: true,
                      checks: { select: { settledAt: true, cancelledAt: true } },
                    },
                  },
                },
              });
              if (!lockedSession)
                throw new ConflictException('The dining table moved. Reload and retry handover.');
              sessionForClosure = lockedSession;
            }

            const completedAt = new Date();
            await tx.storefrontOrder.update({
              where: { id: orderId },
              data: { status: 'completed', completedAt },
            });
            if (
              sessionForClosure &&
              sessionForClosure.orders.every(
                (sessionOrder) =>
                  sessionOrder.id === orderId ||
                  sessionOrder.status === 'completed' ||
                  sessionOrder.status === 'cancelled',
              ) &&
              sessionForClosure.orders.every(
                (sessionOrder) =>
                  sessionOrder.status === 'cancelled' ||
                  (sessionOrder.checks.length > 0 &&
                    sessionOrder.checks.every(
                      (check) => check.settledAt !== null || check.cancelledAt !== null,
                    )),
              )
            ) {
              await tx.posDiningSession.updateMany({
                where: { id: sessionForClosure.id, merchantId, status: 'open' },
                data: { status: 'closed', closedAt: completedAt, revision: { increment: 1 } },
              });
            }
          } else if (command.action === 'pos_cancel') {
            if (
              order.source !== 'pos' ||
              order.branchId !== posCancelActor?.branchId ||
              !['pending', 'accepted'].includes(order.status) ||
              order.preparationStartedAt
            )
              throw new ConflictException(
                'Only an unpaid POS order waiting for kitchen preparation can be cancelled.',
              );
            const paymentCount = await tx.posOrderPayment.count({
              where: { orderId, merchantId },
            });
            if (paymentCount > 0)
              throw new ConflictException('An order with any recorded payment must use a refund.');
            await restoreOrderConsumption(
              tx,
              this.ledger,
              merchantId,
              actor,
              orderId,
              command.input.reason,
            );
            const reservedLines = await tx.storefrontOrderLine.findMany({
              where: { orderId, merchantId, stockReserved: true, variantId: { not: null } },
              select: { id: true, variantId: true, quantity: true },
            });
            for (const line of reservedLines) {
              if (!line.variantId) continue;
              const restored = await tx.productVariant.updateMany({
                where: { id: line.variantId, merchantId, stockQuantity: { not: null } },
                data: { stockQuantity: { increment: line.quantity } },
              });
              if (restored.count !== 1)
                throw new ConflictException('Reserved variant stock could not be restored safely.');
              await tx.storefrontOrderLine.updateMany({
                where: { id: line.id, orderId, merchantId, stockReserved: true },
                data: { stockReserved: false },
              });
            }
            await tx.storefrontOrder.update({
              where: { id: orderId },
              data: {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancellationReason: command.input.reason,
                stockRestored: true,
                revision: { increment: 1 },
              },
            });
            await tx.posOrderCheck.updateMany({
              where: { orderId, merchantId, settledAt: null, cancelledAt: null },
              data: { cancelledAt: new Date(), revision: { increment: 1 } },
            });
            if (order.posDiningSessionId) {
              const session = await tx.posDiningSession.findFirst({
                where: { id: order.posDiningSessionId, merchantId, status: 'open' },
                select: { id: true, tableId: true, branchId: true },
              });
              if (session) {
                const tableLock = await tx.$queryRaw<Array<{ id: string }>>`
                  SELECT "id" FROM "pos_dining_tables"
                  WHERE "id" = ${session.tableId}::uuid
                    AND "branchId" = ${session.branchId}::uuid
                    AND "merchantId" = ${merchantId}::uuid
                  FOR UPDATE`;
                const sessionLock = tableLock.length
                  ? await tx.$queryRaw<Array<{ id: string }>>`
                      SELECT "id" FROM "pos_dining_sessions"
                      WHERE "id" = ${session.id}::uuid AND "merchantId" = ${merchantId}::uuid
                        AND "status" = 'open' FOR UPDATE`
                  : [];
                if (sessionLock.length) {
                  const current = await tx.posDiningSession.findFirst({
                    where: { id: session.id, merchantId, status: 'open', tableId: session.tableId },
                    select: {
                      id: true,
                      orders: {
                        select: {
                          id: true,
                          status: true,
                          checks: { select: { settledAt: true, cancelledAt: true } },
                        },
                      },
                    },
                  });
                  if (
                    current &&
                    current.orders.every((sessionOrder) =>
                      ['completed', 'cancelled'].includes(sessionOrder.status),
                    ) &&
                    current.orders.every(
                      (sessionOrder) =>
                        sessionOrder.status === 'cancelled' ||
                        (sessionOrder.checks.length > 0 &&
                          sessionOrder.checks.every(
                            (check) => check.settledAt !== null || check.cancelledAt !== null,
                          )),
                    )
                  ) {
                    await tx.posDiningSession.updateMany({
                      where: { id: session.id, merchantId, status: 'open' },
                      data: { status: 'closed', closedAt: new Date(), revision: { increment: 1 } },
                    });
                  }
                }
              }
            }
          } else {
            if (order.status !== 'accepted' || order.preparationStartedAt)
              throw new ConflictException(
                'Cancellation is only allowed before preparation starts.',
              );
            if (command.input.restoreStock) {
              await restoreOrderConsumption(
                tx,
                this.ledger,
                merchantId,
                actor,
                orderId,
                command.input.reason,
              );
              // Mixed orders retain their original DIRECT/legacy reservations; restore them only on an explicit restock decision.
              for (const line of order.lines.filter(
                (line) => line.stockHandling === 'legacy' && line.stockReserved && line.variantId,
              )) {
                const restored = await tx.productVariant.updateMany({
                  where: { id: line.variantId!, merchantId, stockQuantity: { not: null } },
                  data: { stockQuantity: { increment: line.quantity } },
                });
                if (restored.count !== 1)
                  throw new ConflictException(
                    'A reserved variant cannot be restored; review its stock configuration.',
                  );
              }
            }
            await tx.storefrontOrder.update({
              where: { id: orderId },
              data: {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancellationReason: command.input.reason,
                stockRestored: command.input.restoreStock,
              },
            });
          }
          const saved = toSummary(
            await tx.storefrontOrder.findFirstOrThrow({
              where: { id: orderId, merchantId },
              include: orderInclude,
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
