/** Prepares a stock item with its units and recognizes a repeated creation request. */
import { ConflictException } from '@nestjs/common';
import type { StockItem } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { normalizeStockQuantity } from '../stock-quantity.js';

export const includeUnits = { units: { orderBy: { code: 'asc' as const } } };

export type ItemRecord = Prisma.StockItemGetPayload<{ include: { units: true } }>;

export function replayCreation(record: ItemRecord, fingerprint: string): StockItem {
  if (record.creationFingerprint !== fingerprint) {
    throw new ConflictException(
      'This creation request was already used with different item details.',
    );
  }
  return toItem(record);
}

export function toItem(record: ItemRecord): StockItem {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    baseUnit: record.baseUnit as StockItem['baseUnit'],
    revision: record.revision,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    units: record.units.map((unit) => ({
      id: unit.id,
      code: unit.code,
      name: unit.name,
      baseQuantity: normalizeStockQuantity(unit.baseQuantity.toFixed(6)),
    })),
  };
}
