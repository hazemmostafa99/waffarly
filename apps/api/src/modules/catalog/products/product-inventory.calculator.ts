import { BadRequestException } from '@nestjs/common';
import type { StockBaseUnit } from '@waffarly/contracts';
import {
  formatStockQuantity,
  parseStockQuantity,
  MAX_STOCK_QUANTITY_SCALED,
} from '../../inventory/index.js';

export interface InventoryRequirementInput {
  stockItemId: string;
  baseUnit: StockBaseUnit;
  baseQuantity: string;
}

export interface InventoryRequirementEffectInput extends InventoryRequirementInput {
  direction: 'ADD' | 'REMOVE';
  optionQuantity: number;
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
  effects: readonly InventoryRequirementEffectInput[] = [],
): InventoryRequirement[] {
  if (!Number.isSafeInteger(sellableQuantity) || sellableQuantity <= 0) {
    throw new BadRequestException('Sellable quantity must be a positive whole number.');
  }
  const totals = new Map<string, { baseUnit: StockBaseUnit; scaled: bigint }>();
  const inputs = [
    ...components.map((component) => ({ ...component, multiplier: 1n })),
    ...effects.map((effect) => {
      if (
        !Number.isSafeInteger(effect.optionQuantity) ||
        effect.optionQuantity < 1 ||
        effect.optionQuantity > 99 ||
        !['ADD', 'REMOVE'].includes(effect.direction)
      ) {
        throw new BadRequestException('Modifier effect quantity or direction is invalid.');
      }
      return {
        ...effect,
        multiplier: BigInt(effect.optionQuantity) * (effect.direction === 'REMOVE' ? -1n : 1n),
      };
    }),
  ];
  for (const component of inputs) {
    const requiredScaled =
      parseStockQuantity(component.baseQuantity) * component.multiplier * BigInt(sellableQuantity);
    const current = totals.get(component.stockItemId);
    if (current && current.baseUnit !== component.baseUnit)
      throw new BadRequestException('One stock item cannot use multiple base units.');
    totals.set(component.stockItemId, {
      baseUnit: component.baseUnit,
      scaled: (current?.scaled ?? 0n) + requiredScaled,
    });
  }
  for (const total of totals.values()) {
    if (total.scaled < 0n)
      throw new BadRequestException(
        'Selected modifiers would make an ingredient requirement negative.',
      );
    if (total.scaled > MAX_STOCK_QUANTITY_SCALED)
      throw new BadRequestException(
        'Calculated inventory requirement exceeds the supported range.',
      );
  }
  return [...totals]
    .filter(([, total]) => total.scaled > 0n)
    .map(([stockItemId, total]) => ({
      stockItemId,
      baseUnit: total.baseUnit,
      quantity: formatStockQuantity(total.scaled),
    }))
    .sort((left, right) => left.stockItemId.localeCompare(right.stockItemId));
}

/** Shared option-effect inheritance for quoting and acceptance of frozen order selections. */
export function modifierEffectRequirements(
  option: {
    variantOverrides?: Array<{ variantId: string; effectsOverride: boolean }>;
    effects?: Array<{
      variantId: string | null;
      stockItemId: string;
      baseUnit: string;
      baseQuantity: { toString(): string };
      direction: string;
    }>;
  },
  variantId: string | null,
  optionQuantity: number,
): InventoryRequirementEffectInput[] {
  const sourceVariant = option.variantOverrides?.find(
    (override) => override.variantId === variantId,
  )?.effectsOverride
    ? variantId
    : null;
  return (option.effects ?? [])
    .filter((effect) => effect.variantId === sourceVariant)
    .map((effect) => ({
      stockItemId: effect.stockItemId,
      baseUnit: effect.baseUnit as StockBaseUnit,
      baseQuantity: effect.baseQuantity.toString(),
      direction: effect.direction as 'ADD' | 'REMOVE',
      optionQuantity,
    }));
}
