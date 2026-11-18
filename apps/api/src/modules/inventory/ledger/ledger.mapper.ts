import type { StockBalance, StockMovement, StockMovementBatchResult } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { decimalText } from './ledger.rules.js';

export const balanceInclude = {
  warehouse: { select: { name: true, branchId: true, branch: { select: { name: true } } } },
  stockItem: { select: { name: true, baseUnit: true } },
} as const;
export const movementInclude = {
  batch: true,
  warehouse: { select: { branchId: true } },
  costEvent: { select: { sourceType: true, sourceInvoiceId: true } },
} as const;
type BalanceRecord = Prisma.StockBalanceGetPayload<{ include: typeof balanceInclude }>;
type MovementRecord = Prisma.StockMovementGetPayload<{ include: typeof movementInclude }>;
type BatchRecord = Prisma.StockMovementBatchGetPayload<{
  include: { movements: { include: typeof movementInclude } };
}>;
export function toBatchResult(batch: BatchRecord, replayed: boolean): StockMovementBatchResult {
  return {
    id: batch.id,
    kind: batch.kind,
    reason: batch.reason,
    createdAt: batch.createdAt.toISOString(),
    replayed,
    movements: batch.movements.map(toMovement),
  };
}

export function toBalance(record: BalanceRecord): StockBalance {
  return {
    id: record.id,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouse.name,
    branchId: record.warehouse.branchId,
    branchName: record.warehouse.branch.name,
    stockItemId: record.stockItemId,
    stockItemName: record.stockItem.name,
    baseUnit: record.stockItem.baseUnit as StockBalance['baseUnit'],
    condition: record.condition as StockBalance['condition'],
    quantity: decimalText(record.quantity.toFixed(6)),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toMovement(record: MovementRecord): StockMovement {
  return {
    id: record.id,
    batchId: record.batchId,
    kind: record.batch.kind,
    sourceType: record.batch.sourceType,
    sourceId: record.batch.sourceId,
    reason: record.batch.reason,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouseName,
    branchId: record.warehouse.branchId,
    branchName: record.branchName,
    stockItemId: record.stockItemId,
    stockItemName: record.stockItemName,
    baseUnit: record.baseUnit as StockMovement['baseUnit'],
    condition: record.condition as StockMovement['condition'],
    unitCode: record.unitCode,
    enteredQuantity: decimalText(record.enteredQuantity.toFixed(6)),
    baseDelta: decimalText(record.baseDelta.toFixed(6)),
    costRevision: record.costRevision,
    baseUnitCost: record.baseUnitCost?.toFixed(12) ?? null,
    estimatedCostAmount: record.baseUnitCost
      ? formatEstimatedCostAmount(record.baseDelta.toFixed(6), record.baseUnitCost.toFixed(12))
      : null,
    costSourceType: (record.costEvent?.sourceType as StockMovement['costSourceType']) ?? null,
    costSourceInvoiceId: record.costEvent?.sourceInvoiceId ?? null,
    actor: record.createdBy,
    createdAt: record.createdAt.toISOString(),
  };
}

function formatEstimatedCostAmount(quantity: string, unitCost: string): string {
  const quantityScaled = BigInt(quantity.replace(/^-/, '').replace('.', ''));
  const costScaled = BigInt(unitCost.replace('.', ''));
  const cents = (quantityScaled * costScaled + 5_000_000_000_000_000n) / 10_000_000_000_000_000n;
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}
