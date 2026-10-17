import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AcceptRecipeOrderRequest,
  CancelRecipeOrderRequest,
  StartOrderPreparationRequest,
  StorefrontOrderSummary,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash } from 'node:crypto';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { ProductConsumptionService } from '../catalog/index.js';
import { InventoryLedgerService } from '../inventory/index.js';
import { toSummary } from './order.mapper.js';
import {
  acceptRecipeOrderSchema,
  cancelRecipeOrderSchema,
  startOrderPreparationSchema,
} from './order-lifecycle.schemas.js';
import {
  consumeOrderRequirements,
  resolveConsumptionWarehouse,
  restoreOrderConsumption,
} from './order-stock.persistence.js';

const orderInclude = {
  lines: {
    orderBy: { position: 'asc' as const },
    include: {
      selections: {
        orderBy: [{ groupPosition: 'asc' as const }, { optionPosition: 'asc' as const }],
      },
      variantAttributes: { orderBy: { position: 'asc' as const } },
    },
  },
};
type Action =
  | { action: 'accept'; input: AcceptRecipeOrderRequest }
  | { action: 'prepare'; input: StartOrderPreparationRequest }
  | { action: 'cancel'; input: CancelRecipeOrderRequest };

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
  cancel(merchantId: string, actor: string, orderId: string, input: CancelRecipeOrderRequest) {
    return this.run(merchantId, actor, orderId, {
      action: 'cancel',
      input: parseRequest(cancelRecipeOrderSchema, input),
    });
  }

  private async run(
    merchantId: string,
    actor: string,
    orderId: string,
    command: Action,
    branchIds?: readonly string[],
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
          if (branchIds && command.action === 'prepare') {
            const routed = await tx.storefrontOrder.findFirst({
              where: {
                id: orderId,
                merchantId,
                branchId: { in: [...branchIds] },
                lines: { some: { stockHandling: 'recipe_acceptance' } },
              },
              select: { id: true },
            });
            if (!routed) throw new NotFoundException('Order was not found.');
          }
          const replay = await tx.storefrontOrderAction.findUnique({
            where: { merchantId_requestId: { merchantId, requestId: command.input.requestId } },
          });
          if (replay) {
            if (replay.fingerprint !== fingerprint)
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
          if (!recipeLines.length)
            throw new ConflictException('This action is only available for new recipe orders.');
          if (command.action === 'accept') {
            if (order.status !== 'pending')
              throw new ConflictException('Only pending orders can be accepted.');
            const warehouse = await resolveConsumptionWarehouse(
              tx,
              merchantId,
              command.input.branchId,
            );
            const requirements = await this.consumption.requirements(tx, merchantId, recipeLines);
            await consumeOrderRequirements(
              tx,
              this.ledger,
              merchantId,
              actor,
              orderId,
              warehouse.id,
              requirements,
            );
            await tx.storefrontOrder.update({
              where: { id: orderId },
              data: {
                status: 'accepted',
                branchId: warehouse.branchId,
                warehouseId: warehouse.id,
                branchName: warehouse.branch.name,
                warehouseName: warehouse.name,
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
