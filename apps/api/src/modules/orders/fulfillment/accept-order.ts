/**
 * Accepts a waiting order and accounts for the ingredients needed to prepare it.
 */
import { ConflictException } from '@nestjs/common';

import type { Prisma } from '@waffarly/database';

import { calculateInventoryRequirements, ProductConsumptionService } from '../../catalog/index.js';
import { InventoryLedgerService } from '../../inventory/index.js';

import {
  consumeOrderRequirements,
  resolveConsumptionWarehouse,
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

  // 1. Make sure the order can still be accepted at this branch.
  if (order.status !== 'pending')
    throw new ConflictException('Only pending orders can be accepted.');
  if (order.source === 'pos' && !order.kitchenTicket)
    throw new ConflictException('Send this POS order to the kitchen before accepting it.');
  if (order.source === 'pos' && order.branchId !== command.input.branchId)
    throw new ConflictException('A POS order must be accepted at its assigned branch.');
  const warehouse = recipeLines.length
    ? await resolveConsumptionWarehouse(tx, merchantId, command.input.branchId)
    : null;
  // 2. Use the saved ingredient needs; older orders use their existing fallback.
  const snapshotted = recipeLines.filter((line) => line.stockRequirementsFrozenAt);
  const legacy = recipeLines.filter((line) => !line.stockRequirementsFrozenAt);
  const legacyRequirements = legacy.length
    ? await consumption.requirements(
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
          baseUnit: requirement.baseUnit as (typeof legacyRequirements)[number]['baseUnit'],
          baseQuantity: requirement.quantity.toString(),
        })),
      ),
    ],
    1,
  );
  if (warehouse && requirements.length) {
    await consumeOrderRequirements(
      tx,
      ledger,
      merchantId,
      actor,
      orderId,
      warehouse.id,
      requirements,
    );
  }
  // 3. Mark the order accepted only after its stock work succeeds.
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
}
