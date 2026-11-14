/**
 * Accepts a waiting order and accounts for the ingredients needed to prepare it.
 */
import { ConflictException } from '@nestjs/common';

import type { Prisma } from '@waffarly/database';

import {
  calculateInventoryRequirements,
  ProductConsumptionService,
  type InventoryRequirement,
} from '../../catalog/index.js';
import { InventoryLedgerService } from '../../inventory/index.js';
import { allocateCheckoutLineRevenue } from '../checkout/checkout-policy.js';

import {
  consumeOrderRequirements,
  consumeDirectOrderRequirements,
  resolveConsumptionWarehouse,
  saveLineCostSnapshots,
} from '../stock/order-stock.persistence.js';

import type { OrderForTransition, OrderTransitionCommand } from './order-transition.types.js';

export async function acceptOrder(
  tx: Prisma.TransactionClient,
  order: OrderForTransition,
  command: Extract<OrderTransitionCommand, { action: 'accept' }>,
  merchantId: string,
  actor: string,
  consumption: ProductConsumptionService,
  ledger: InventoryLedgerService,
): Promise<void> {
  const orderId = order.id;
  const recipeLines = order.lines.filter((line) => line.stockHandling === 'recipe_acceptance');
  const directLines = order.lines.filter((line) => line.stockHandling === 'direct_acceptance');
  const trackedLines = [...recipeLines, ...directLines];
  if (order.lines.some((line) => line.stockHandling === 'legacy')) {
    throw new ConflictException(
      'Configure inventory and record current item costs before accepting this sale.',
    );
  }

  // 1. Make sure the order can still be accepted at this branch.
  if (order.status !== 'pending')
    throw new ConflictException('Only pending orders can be accepted.');
  if (order.source === 'pos' && !order.kitchenTicket)
    throw new ConflictException('Send this POS order to the kitchen before accepting it.');
  if (order.source === 'pos' && order.branchId !== command.input.branchId)
    throw new ConflictException('A POS order must be accepted at its assigned branch.');
  const warehouse = trackedLines.length
    ? await resolveConsumptionWarehouse(tx, merchantId, command.input.branchId)
    : null;
  // 2. Use each line's frozen ingredient needs, retaining the current-price cost at consumption.
  const requirementsByLine = new Map<string, InventoryRequirement[]>();
  for (const line of trackedLines) {
    const requirements = line.stockRequirementsFrozenAt
      ? (line.stockRequirements ?? []).map((requirement) => ({
          stockItemId: requirement.stockItemId,
          baseUnit: requirement.baseUnit as InventoryRequirement['baseUnit'],
          quantity: requirement.quantity.toString(),
        }))
      : await consumption.requirements(tx, merchantId, [
          {
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
            selections: line.selections.map((selection) => ({
              modifierGroupId: selection.modifierGroupId,
              modifierOptionId: selection.modifierOptionId,
              quantity: selection.quantity,
            })),
          },
        ]);
    requirementsByLine.set(line.id, requirements);
  }
  const consumeLines = async (
    lines: typeof trackedLines,
    consume: typeof consumeOrderRequirements,
  ) => {
    if (!warehouse || !lines.length) return;
    const requirements = calculateInventoryRequirements(
      lines.flatMap((line) =>
        (requirementsByLine.get(line.id) ?? []).map((requirement) => ({
          stockItemId: requirement.stockItemId,
          baseUnit: requirement.baseUnit,
          baseQuantity: requirement.quantity,
        })),
      ),
      1,
    );
    const capturedCosts = await consume(tx, ledger, merchantId, actor, orderId, warehouse.id, requirements);
    for (const line of lines) {
      await saveLineCostSnapshots(
        tx,
        merchantId,
        line.id,
        requirementsByLine.get(line.id) ?? [],
        capturedCosts,
      );
    }
  };
  await consumeLines(recipeLines, consumeOrderRequirements);
  await consumeLines(directLines, (tx, inventory, tenant, user, source, location, lines) =>
    consumeDirectOrderRequirements(tx, inventory, tenant, user, source, location, lines, 'storefront_order'),
  );

  const acceptedAt = new Date();
  if (order.source === 'storefront') {
    const revenueByLine = allocateCheckoutLineRevenue(
      order.lines.map((line) => ({
        id: line.id,
        position: line.position,
        lineTotal: line.lineTotal.toString(),
      })),
      order.discountRedemption?.amount.toString(),
    );
    for (const lineRevenue of revenueByLine) {
      const recognized = await tx.storefrontOrderLine.updateMany({
        where: {
          id: lineRevenue.lineId,
          merchantId,
          recognizedRevenueAmount: null,
          revenueRecognizedAt: null,
        },
        data: { recognizedRevenueAmount: lineRevenue.revenueAmount, revenueRecognizedAt: acceptedAt },
      });
      if (recognized.count !== 1)
        throw new ConflictException('This order line already has a revenue recognition event.');
    }
  }
  // 3. Mark the order accepted only after its stock and sale snapshots succeed.
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
      acceptedAt,
    },
  });
}
