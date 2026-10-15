import type { PurchaseInvoice } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { normalizeStockQuantity } from '../inventory/index.js';

export const invoiceInclude = {
  lines: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.PurchaseInvoiceInclude;
export type InvoiceRecord = Prisma.PurchaseInvoiceGetPayload<{ include: typeof invoiceInclude }>;

export function toInvoice(record: InvoiceRecord): PurchaseInvoice {
  return {
    id: record.id,
    supplierId: record.supplierId,
    supplierName: record.supplierName,
    supplierInvoiceNumber: record.supplierInvoiceNumber,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouseName,
    branchName: record.branchName,
    status: record.status as PurchaseInvoice['status'],
    revision: record.revision,
    lines: record.lines.map((line) => ({
      id: line.id,
      stockItemId: line.stockItemId,
      stockItemName: line.stockItemName,
      baseUnit: line.baseUnit as PurchaseInvoice['lines'][number]['baseUnit'],
      unitCode: line.unitCode,
      unitName: line.unitName,
      condition: line.condition as PurchaseInvoice['lines'][number]['condition'],
      quantity: normalizeStockQuantity(line.quantity.toFixed(6)),
      position: line.position,
    })),
    confirmedAt: record.confirmedAt?.toISOString() ?? null,
    confirmedBy: record.confirmedBy,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
