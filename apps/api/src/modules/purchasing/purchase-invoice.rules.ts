import { ConflictException } from '@nestjs/common';
import {
  normalizePurchaseAmount,
  normalizePurchaseUnitCost,
  type CreatePurchaseInvoiceRequest,
} from '@waffarly/contracts';
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
        ...(input.invoiceDate ? { invoiceDate: input.invoiceDate } : {}),
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        ...(input.discountType !== undefined || input.discountValue !== undefined
          ? {
              discountType: input.discountType ?? 'amount',
              discountValue: normalizePurchaseAmount(
                input.discountValue ?? input.discountAmount ?? '0.00',
              ),
            }
          : {}),
        warehouseId: input.warehouseId,
        discountAmount: normalizePurchaseAmount(input.discountAmount ?? '0.00')!,
        shippingAmount: normalizePurchaseAmount(input.shippingAmount ?? '0.00')!,
        lines: input.lines.map((line) => ({
          stockItemId: line.stockItemId,
          condition: line.condition,
          quantity: normalizeStockQuantity(line.quantity),
          unitCode: line.unitCode,
          unitCost: normalizePurchaseUnitCost(line.unitCost)!,
        })),
      }),
    )
    .digest('hex');
}
