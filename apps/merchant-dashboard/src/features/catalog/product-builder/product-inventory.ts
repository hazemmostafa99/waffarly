import {
  isPositiveStockQuantity,
  type ProductInventoryMode,
  type StockItem,
} from '@waffarly/contracts';
import { stockUnitOptions } from '../../inventory/stock-unit-options.js';
import type {
  ProductInventoryComponentDraft,
  ProductInventoryTargetDraft,
} from './ProductInventoryTab.js';

export function emptyInventoryComponent(
  mode: ProductInventoryMode,
): ProductInventoryComponentDraft {
  return { stockItemId: '', unitCode: '', quantity: mode === 'DIRECT' ? '1' : '' };
}

export function inventoryTargetComplete(
  target: ProductInventoryTargetDraft,
  mode: ProductInventoryMode,
  stockItems: readonly StockItem[],
): boolean {
  return (
    target.components.length > 0 &&
    (mode !== 'DIRECT' || target.components.length === 1) &&
    target.components.every((component) => {
      const item = stockItems.find((entry) => entry.id === component.stockItemId);
      return (
        Boolean(
          component.stockItemId &&
          component.unitCode &&
          isPositiveStockQuantity(component.quantity),
        ) &&
        (!item || stockUnitOptions(item).some((unit) => unit.code === component.unitCode))
      );
    })
  );
}
