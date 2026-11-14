/**
 * Adds newly ordered items to a kitchen ticket while keeping the existing sale and bill.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type {
  AddPosKitchenItemsRequest,
  AddPosKitchenItemsResponse,
  PosEmployeeSession,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { createHash } from 'node:crypto';
import { formatCents, toCents } from '../../../common/money/money.js';

import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  ProductConsumptionService,
  ProductPricingService,
  type InventoryRequirement,
} from '../../catalog/index.js';
import { InventoryLedgerService } from '../../inventory/index.js';
import { ShiftsService } from '../../shifts/index.js';

import { posKitchenTicketInclude } from './pos-kitchen.persistence.js';
import { toSummary } from '../mapping/order.mapper.js';

import {
  consumeDirectOrderRequirements,
  freezeLineStockRequirements,
  resolveConsumptionWarehouse,
} from '../stock/order-stock.persistence.js';
import { parseAddPosKitchenItemsRequest } from '../pos-sales/pos-orders.schemas.js';

const MAX_ORDER_TOTAL_CENTS = 999_999_999_999n;
const orderSummaryInclude = {
  kitchenTicket: posKitchenTicketInclude,
  diningSession: { select: { table: { select: { code: true } } } },
  lines: {
    orderBy: { position: 'asc' as const },
    include: {
      selections: {
        orderBy: [{ groupPosition: 'asc' as const }, { optionPosition: 'asc' as const }],
      },
      variantAttributes: { orderBy: { position: 'asc' as const } },
    },
  },
} satisfies Prisma.StorefrontOrderInclude;

import {
  quotePosSaleItems,
  requirePosSellPermission,
  quoteSelectionsForRequirements,
  createSelectionSnapshots,
} from '../pos-sales/pos-order.rules.js';

export async function amendKitchenOrder(
  context: {
    prisma: PrismaService;
    pricing: ProductPricingService;
    consumption: ProductConsumptionService;
    ledger: InventoryLedgerService;
    shifts: ShiftsService;
  },
  employee: PosEmployeeSession,
  orderId: string,
  input: unknown,
): Promise<AddPosKitchenItemsResponse> {
  requirePosSellPermission(employee);
  const request: AddPosKitchenItemsRequest = parseAddPosKitchenItemsRequest(input);
  const actor = `pos:${employee.id}`;
  const branchIds = employee.branches
    .filter((branch) => branch.archivedAt === null)
    .map((branch) => branch.id);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ action: 'pos_kitchen_amendment', orderId, ...request }))
    .digest('hex');

  try {
    // 1. Append new lines and their stock effects without creating another sale.
    return await context.prisma.$transaction(
      async (tx) => {
        const replay = await tx.storefrontOrderAction.findUnique({
          where: {
            merchantId_requestId: {
              merchantId: employee.merchantId,
              requestId: request.requestId,
            },
          },
        });
        if (replay) return replayKitchenAmendment(replay, actor, fingerprint);

        const observed = await tx.storefrontOrder.findFirst({
          where: {
            id: orderId,
            merchantId: employee.merchantId,
            source: 'pos',
            branchId: { in: branchIds },
          },
          select: { branchId: true, posShiftId: true },
        });
        if (!observed) throw new NotFoundException('The POS order was not found.');
        if (!observed.branchId || !observed.posShiftId)
          throw new ConflictException('This order is not linked to an open register shift.');

        await context.shifts.lockOpenShiftForPayment(tx, {
          merchantId: employee.merchantId,
          shiftId: observed.posShiftId,
          branchId: observed.branchId,
        });
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "storefront_orders"
            WHERE "id" = ${orderId}::uuid
              AND "merchantId" = ${employee.merchantId}::uuid
            FOR UPDATE`;
        if (locked.length !== 1) throw new NotFoundException('The POS order was not found.');

        const lockedReplay = await tx.storefrontOrderAction.findUnique({
          where: {
            merchantId_requestId: {
              merchantId: employee.merchantId,
              requestId: request.requestId,
            },
          },
        });
        if (lockedReplay) return replayKitchenAmendment(lockedReplay, actor, fingerprint);

        const order = await tx.storefrontOrder.findFirst({
          where: {
            id: orderId,
            merchantId: employee.merchantId,
            source: 'pos',
            branchId: { in: branchIds },
          },
          include: {
            ...orderSummaryInclude,
            checks: {
              orderBy: { position: 'asc' },
              select: { id: true, amount: true, splitMethod: true, settledAt: true },
            },
          },
        });
        if (!order) throw new NotFoundException('The POS order was not found.');
        if (order.revision !== request.revision)
          throw new ConflictException('This order changed. Refresh it before adding items.');
        if (order.status !== 'pending' || !order.kitchenTicket)
          throw new ConflictException(
            'Items can only be added before the kitchen accepts the sent order.',
          );
        if (order.checks.length !== 1 || order.checks[0]?.splitMethod !== 'whole')
          throw new ConflictException('Items can only be added to one unsplit check.');
        const check = order.checks[0]!;
        if (check.settledAt)
          throw new ConflictException('Items cannot be added after a check is settled.');
        const paymentCount = await tx.posOrderPayment.count({
          where: { orderId, merchantId: employee.merchantId },
        });
        if (paymentCount > 0)
          throw new ConflictException('Items cannot be added after payment begins.');
        const allocationCount = await tx.posOrderCheckLine.count({
          where: { orderId, merchantId: employee.merchantId },
        });
        if (allocationCount > 0)
          throw new ConflictException('Items cannot be added after the check is split.');

        const quote = await quotePosSaleItems(context.pricing, employee.merchantId, request, tx);
        const quoteByLineId = new Map(quote.items.map((item) => [item.lineId, item.quote]));
        const directRequirements: InventoryRequirement[] = [];
        const firstPosition =
          order.lines.reduce((max, line) => Math.max(max, line.position), -1) + 1;

        for (const [index, item] of request.items.entries()) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, merchantId: employee.merchantId, archivedAt: null },
            select: {
              id: true,
              name: true,
              availability: true,
              revision: true,
              inventoryConfiguration: { select: { mode: true } },
              variants: {
                select: {
                  id: true,
                  name: true,
                  availability: true,
                  stockQuantity: true,
                  attributeSelections: {
                    orderBy: { attribute: { position: 'asc' } },
                    select: {
                      attributeId: true,
                      valueId: true,
                      attribute: { select: { id: true, name: true, position: true } },
                      value: { select: { id: true, value: true } },
                    },
                  },
                },
              },
              modifierGroups: {
                orderBy: { position: 'asc' },
                select: {
                  id: true,
                  modifierGroupId: true,
                  position: true,
                  modifierGroup: { select: { name: true } },
                  options: {
                    orderBy: { option: { position: 'asc' } },
                    select: {
                      optionId: true,
                      priceAdjustment: true,
                      option: { select: { name: true, position: true } },
                    },
                  },
                },
              },
            },
          });
          const lineQuote = quoteByLineId.get(item.lineId);
          if (!product || product.availability !== 'available' || !lineQuote)
            throw new ConflictException('A product in this addition is no longer available.');
          if (
            product.revision !== item.expectedProductRevision ||
            product.revision !== lineQuote.productRevision
          )
            throw new ConflictException(
              'A product changed. Review the updated quote before adding it.',
            );

          const variant = lineQuote.variantId
            ? product.variants.find((candidate) => candidate.id === lineQuote.variantId)
            : undefined;
          if (product.variants.length > 0 && (!variant || variant.availability !== 'available'))
            throw new ConflictException('A selected variant is no longer available.');

          const mode = product.inventoryConfiguration?.mode ?? null;
          if (mode && mode !== 'DIRECT' && mode !== 'RECIPE')
            throw new ConflictException('The product stock handling is not supported.');
          const stockHandling =
            mode === 'DIRECT' ? 'direct_sale' : mode === 'RECIPE' ? 'recipe_acceptance' : 'legacy';
          let requirements: InventoryRequirement[] = [];
          if (mode === 'DIRECT' || mode === 'RECIPE') {
            requirements = await context.consumption.requirements(
              tx,
              employee.merchantId,
              [
                {
                  productId: product.id,
                  variantId: variant?.id ?? null,
                  quantity: item.quantity,
                  selections: quoteSelectionsForRequirements(lineQuote.selections),
                },
              ],
              mode,
            );
            if (mode === 'DIRECT') directRequirements.push(...requirements);
          }

          let stockReserved = false;
          if (
            stockHandling === 'legacy' &&
            variant?.stockQuantity !== null &&
            variant?.stockQuantity !== undefined
          ) {
            const reservation = await tx.productVariant.updateMany({
              where: {
                id: variant.id,
                merchantId: employee.merchantId,
                productId: product.id,
                availability: 'available',
                stockQuantity: { gte: item.quantity },
              },
              data: { stockQuantity: { decrement: item.quantity } },
            });
            if (reservation.count !== 1)
              throw new ConflictException('A selected variant does not have enough stock.');
            stockReserved = true;
          }

          const lineTotalCents = toCents(lineQuote.totalPrice) * BigInt(item.quantity);
          const savedLine = await tx.storefrontOrderLine.create({
            data: {
              orderId,
              merchantId: employee.merchantId,
              productId: product.id,
              variantId: variant?.id ?? null,
              productName: product.name,
              variantName: variant?.name ?? null,
              basePrice: lineQuote.basePrice,
              modifierTotal: lineQuote.modifierTotal,
              quantity: item.quantity,
              unitPrice: lineQuote.totalPrice,
              lineTotal: formatCents(lineTotalCents),
              note: item.note?.trim() || null,
              stockHandling,
              stockReserved,
              position: firstPosition + index,
              selections: { create: createSelectionSnapshots(product, lineQuote.selections) },
              variantAttributes: {
                create: lineQuote.variantAttributes.map((attribute) => ({
                  attributeId: attribute.attributeId,
                  valueId: attribute.valueId,
                  attributeName: attribute.attributeName,
                  attributeValue: attribute.value,
                  position: attribute.position,
                })),
              },
            },
            select: { id: true },
          });
          if (mode === 'DIRECT' || mode === 'RECIPE')
            await freezeLineStockRequirements(tx, employee.merchantId, savedLine.id, requirements);
        }

        const newTotalCents = toCents(order.total.toString()) + toCents(quote.total);
        if (newTotalCents > MAX_ORDER_TOTAL_CENTS)
          throw new BadRequestException('The order total is too large.');
        const updatedOrder = await tx.storefrontOrder.updateMany({
          where: {
            id: orderId,
            merchantId: employee.merchantId,
            revision: request.revision,
            status: 'pending',
          },
          data: { total: formatCents(newTotalCents), revision: { increment: 1 } },
        });
        if (updatedOrder.count !== 1)
          throw new ConflictException('This order changed. Refresh it before adding items.');
        await tx.posOrderCheck.update({
          where: { id: check.id },
          data: {
            amount: formatCents(toCents(check.amount.toString()) + toCents(quote.total)),
            revision: { increment: 1 },
          },
        });

        if (directRequirements.length) {
          let warehouse: Awaited<ReturnType<typeof resolveConsumptionWarehouse>>;
          if (order.warehouseId) {
            const rows = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id" FROM "warehouses"
                WHERE "id" = ${order.warehouseId}::uuid
                  AND "merchantId" = ${employee.merchantId}::uuid
                  AND "branchId" = ${order.branchId}::uuid
                  AND "archivedAt" IS NULL
                FOR SHARE`;
            if (!rows.length)
              throw new ConflictException(
                "The order's assigned stock warehouse is no longer available.",
              );
            warehouse = await tx.warehouse.findFirstOrThrow({
              where: { id: order.warehouseId, merchantId: employee.merchantId },
              include: { branch: { select: { name: true } } },
            });
          } else {
            warehouse = await resolveConsumptionWarehouse(tx, employee.merchantId, order.branchId!);
          }
          await consumeDirectOrderRequirements(
            tx,
            context.ledger,
            employee.merchantId,
            actor,
            orderId,
            warehouse.id,
            directRequirements,
          );
          if (!order.warehouseId)
            await tx.storefrontOrder.update({
              where: { id: orderId },
              data: {
                warehouseId: warehouse.id,
                branchName: warehouse.branch.name,
                warehouseName: warehouse.name,
              },
            });
        }

        const summary = toSummary(
          await tx.storefrontOrder.findFirstOrThrow({
            where: { id: orderId, merchantId: employee.merchantId },
            include: orderSummaryInclude,
          }),
        );
        await tx.storefrontOrderAction.create({
          data: {
            merchantId: employee.merchantId,
            orderId,
            requestId: request.requestId,
            action: 'pos_kitchen_amendment',
            fingerprint,
            result: summary as unknown as Prisma.InputJsonValue,
            createdBy: actor,
          },
        });
        return summary;
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (isUniqueConstraintError(error) || isSerializationConflict(error)) {
      const previous = await context.prisma.storefrontOrderAction.findUnique({
        where: {
          merchantId_requestId: { merchantId: employee.merchantId, requestId: request.requestId },
        },
      });
      if (previous) return replayKitchenAmendment(previous, actor, fingerprint);
      throw new ConflictException('This order changed. Refresh it before adding items.');
    }
    throw error;
  }
}

export function replayKitchenAmendment(
  previous: { action: string; fingerprint: string; createdBy: string; result: unknown },
  actor: string,
  fingerprint: string,
): AddPosKitchenItemsResponse {
  if (
    previous.action !== 'pos_kitchen_amendment' ||
    previous.createdBy !== actor ||
    previous.fingerprint !== fingerprint
  )
    throw new ConflictException('This request ID was already used for a different POS action.');
  return previous.result as AddPosKitchenItemsResponse;
}
