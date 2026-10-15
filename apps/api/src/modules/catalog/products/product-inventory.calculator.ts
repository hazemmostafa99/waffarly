import { BadRequestException } from '@nestjs/common';
import type { StockBaseUnit } from '@waffarly/contracts';
import { formatStockQuantity, parseStockQuantity } from '../../inventory/index.js';

export interface InventoryRequirementInput {
  stockItemId: string;
  baseUnit: StockBaseUnit;
  baseQuantity: string;
}

export interface InventoryRequirement {
  stockItemId: string;
  baseUnit: StockBaseUnit;
  quantity: string;
}

/** Scale one sellable's requirements by its sold quantity and combine shared Stock Items. */
export function calculateInventoryRequirements(
  components: readonly InventoryRequirementInput[],
  sellableQuantity: number,
): InventoryRequirement[] {
  if (!Number.isSafeInteger(sellableQuantity) || sellableQuantity <= 0) {
    throw new BadRequestException('Sellable quantity must be a positive whole number.');
  }
  const totals = new Map<string, { baseUnit: StockBaseUnit; scaled: bigint }>();
  for (const component of components) {
    const componentScaled = parseStockQuantity(component.baseQuantity);
    const requiredScaled = componentScaled * BigInt(sellableQuantity);
    const current = totals.get(component.stockItemId);
    if (current && current.baseUnit !== component.baseUnit) {
      throw new BadRequestException('One stock item cannot use multiple base units.');
    }
    const next = (current?.scaled ?? 0n) + requiredScaled;
    if (next > 999_999_999_999_999_999n) {
      throw new BadRequestException(
        'Calculated inventory requirement exceeds the supported range.',
      );
    }
    totals.set(component.stockItemId, { baseUnit: component.baseUnit, scaled: next });
  }
  return [...totals]
    .map(([stockItemId, total]) => ({
      stockItemId,
      baseUnit: total.baseUnit,
      quantity: formatStockQuantity(total.scaled),
    }))
    .sort((left, right) => left.stockItemId.localeCompare(right.stockItemId));
}
