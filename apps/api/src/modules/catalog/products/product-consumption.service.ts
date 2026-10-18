import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@waffarly/database';
import type { StockBaseUnit } from '@waffarly/contracts';
import {
  calculateInventoryRequirements,
  modifierEffectRequirements,
  type InventoryRequirementEffectInput,
} from './product-inventory.calculator.js';

export interface RecipeOrderLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  selections: Array<{
    modifierGroupId: string | null;
    modifierOptionId: string | null;
    quantity: number;
  }>;
}

@Injectable()
export class ProductConsumptionService {
  /** Read frozen configuration on the caller's transaction; prices/visibility may change independently. */
  async requirements(
    tx: Prisma.TransactionClient,
    merchantId: string,
    lines: RecipeOrderLine[],
    mode: 'RECIPE' | 'DIRECT' = 'RECIPE',
  ) {
    const products = await tx.product.findMany({
      where: { merchantId, id: { in: [...new Set(lines.map((line) => line.productId))] } },
      include: {
        inventoryConfiguration: { include: { targets: { include: { components: true } } } },
        modifierGroups: {
          include: { options: { include: { effects: true, variantOverrides: true } } },
        },
      },
    });
    const requirements = lines.flatMap((line) => {
      const product = products.find((product) => product.id === line.productId);
      const target = product?.inventoryConfiguration?.targets.find(
        (target) => target.variantId === line.variantId,
      );
      if (product?.inventoryConfiguration?.mode !== mode || !target)
        throw new ConflictException(
          mode === 'RECIPE'
            ? 'The saved order recipe is no longer configured.'
            : 'The saved direct-stock mapping is no longer configured.',
        );
      const effects: InventoryRequirementEffectInput[] = [];
      const seen = new Set<string>();
      for (const selection of line.selections) {
        const group = product.modifierGroups.find(
          (group) => group.modifierGroupId === selection.modifierGroupId,
        );
        const option = group?.options.find(
          (option) => option.optionId === selection.modifierOptionId,
        );
        const key = `${selection.modifierGroupId}:${selection.modifierOptionId}`;
        if (
          !option ||
          seen.has(key) ||
          !Number.isSafeInteger(selection.quantity) ||
          selection.quantity < 1 ||
          selection.quantity > option.maxQuantity
        )
          throw new ConflictException('A saved recipe selection is no longer valid.');
        seen.add(key);
        effects.push(...modifierEffectRequirements(option, line.variantId, selection.quantity));
      }
      return calculateInventoryRequirements(
        target.components.map((component) => ({
          stockItemId: component.stockItemId,
          baseUnit: component.baseUnit as StockBaseUnit,
          baseQuantity: component.baseQuantity.toString(),
        })),
        line.quantity,
        effects,
      );
    });
    return calculateInventoryRequirements(
      requirements.map((requirement) => ({
        stockItemId: requirement.stockItemId,
        baseUnit: requirement.baseUnit,
        baseQuantity: requirement.quantity,
      })),
      1,
    );
  }
}
