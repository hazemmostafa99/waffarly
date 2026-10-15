import { ConflictException } from '@nestjs/common';
import type { CreatePurchaseInvoiceRequest } from '@waffarly/contracts';
import { createHash } from 'node:crypto';
import { normalizeStockQuantity } from '../inventory/index.js';

export function assertDraftRevision(
  invoice: { status: string; revision: number },
  revision: number,
) {
  if (invoice.status !== 'draft') {
    throw new ConflictException('Confirmed purchase invoices cannot be changed.');
  }
  if (invoice.revision !== revision) {
    throw new ConflictException('Purchase invoice was changed by another request.');
  }
}

export function invoiceFingerprint(input: CreatePurchaseInvoiceRequest): string {
  const invoiceNumber = input.supplierInvoiceNumber?.trim().toLocaleLowerCase('en-US') || null;
  return createHash('sha256')
    .update(
      JSON.stringify({
        supplierId: input.supplierId,
        supplierInvoiceNumber: invoiceNumber,
        warehouseId: input.warehouseId,
        lines: input.lines.map((line) => ({
          stockItemId: line.stockItemId,
          condition: line.condition,
          quantity: normalizeStockQuantity(line.quantity),
          unitCode: line.unitCode,
        })),
      }),
    )
    .digest('hex');
}
