/** Prepares the saved reorder levels and stock item details shown in stock health views. */
import type { InventoryReorderThreshold } from '@waffarly/contracts';
import { Prisma } from '@waffarly/database';

import { decimalText } from '../ledger/ledger.rules.js';

export const healthInclude = {
  warehouse: {
    select: { id: true, name: true, branchId: true, branch: { select: { name: true } } },
  },
  stockItem: { select: { id: true, name: true, baseUnit: true } },
} satisfies Prisma.StockReorderThresholdInclude;

export function toThreshold(record: {
  id: string;
  warehouseId: string;
  stockItemId: string;
  minimumAvailableQuantity: { toFixed(decimalPlaces: number): string };
  revision: number;
  updatedAt: Date;
}): InventoryReorderThreshold {
  return {
    id: record.id,
    warehouseId: record.warehouseId,
    stockItemId: record.stockItemId,
    minimumAvailableQuantity: decimalText(record.minimumAvailableQuantity.toFixed(6)),
    revision: record.revision,
    updatedAt: record.updatedAt.toISOString(),
  };
}
