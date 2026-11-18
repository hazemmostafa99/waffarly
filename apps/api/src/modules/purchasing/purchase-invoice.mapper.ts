import type { PurchaseInvoice } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { normalizeStockQuantity } from '../inventory/index.js';

export const invoiceInclude = {
  lines: { orderBy: { position: 'asc' as const } },
  payments: { orderBy: [{ paidAt: 'asc' as const }, { id: 'asc' as const }] },
  creditNotes: { orderBy: [{ issuedAt: 'asc' as const }, { id: 'asc' as const }], include: { lines: true } },
  corrections: { orderBy: [{ issuedAt: 'asc' as const }, { id: 'asc' as const }], include: { lines: true } },
  warehouse: { select: { branchId: true } },
} satisfies Prisma.PurchaseInvoiceInclude;
export type InvoiceRecord = Prisma.PurchaseInvoiceGetPayload<{ include: typeof invoiceInclude }>;

export function toInvoice(record: InvoiceRecord): PurchaseInvoice {
  const correctedCosts = new Map(record.lines.map((line) => [line.id, line.unitCost?.toFixed(2) ?? null]));
  const returnedQuantity = new Map<string, number>();
  for (const correction of record.corrections) {
    for (const line of correction.lines) correctedCosts.set(line.invoiceLineId, line.correctedUnitCost.toFixed(2));
  }
  for (const note of record.creditNotes) {
    for (const line of note.lines) returnedQuantity.set(line.invoiceLineId, (returnedQuantity.get(line.invoiceLineId) ?? 0) + Number(line.quantity.toFixed(6)));
  }
  const paidCents = record.payments.reduce(
    (sum, payment) => sum + moneyToCents(payment.amount.toString()),
    0n,
  );
  const creditCents = record.creditNotes.reduce(
    (sum, note) => sum + moneyToCents(note.amount.toString()),
    0n,
  );
  const totalCents = record.totalAmount ? moneyToCents(record.totalAmount.toString()) : null;
  const correctionDeltaCents = record.corrections.reduce(
    (sum, correction) => sum + moneyToCentsSigned(correction.amountDelta.toString()),
    0n,
  );
  const correctedTotalCents = totalCents === null ? null : totalCents + correctionDeltaCents;
  return {
    id: record.id,
    supplierId: record.supplierId,
    supplierName: record.supplierName,
    supplierInvoiceNumber: record.supplierInvoiceNumber,
    invoiceDate: record.invoiceDate?.toISOString().slice(0, 10),
    notes: record.notes ?? undefined,
    discountType: record.discountType as 'amount' | 'percentage',
    discountValue: record.discountValue?.toFixed(2) ?? record.discountAmount?.toFixed(2) ?? '0.00',
    warehouseId: record.warehouseId,
    warehouseBranchId: record.warehouse.branchId,
    warehouseName: record.warehouseName,
    branchName: record.branchName,
    subtotalAmount: record.subtotalAmount?.toFixed(2) ?? null,
    discountAmount: record.discountAmount?.toFixed(2) ?? null,
    shippingAmount: record.shippingAmount?.toFixed(2) ?? null,
    totalAmount: record.totalAmount?.toFixed(2) ?? null,
    correctedTotalAmount: correctedTotalCents === null ? null : formatCents(correctedTotalCents),
    paidAmount: formatCents(paidCents),
    creditNoteAmount: formatCents(creditCents),
    balanceDue: correctedTotalCents === null ? null : formatCents(correctedTotalCents - paidCents - creditCents),
    payments: record.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount.toFixed(2),
      paidAt: payment.paidAt.toISOString(),
      reason: payment.reason,
      sourceType: payment.safeMovementId ? 'safe' : 'drawer',
      sourceMovementId: payment.safeMovementId ?? payment.drawerMovementId!,
    })),
    creditNotes: record.creditNotes.map((note) => ({
      id: note.id,
      creditNumber: note.creditNumber,
      amount: note.amount.toFixed(2),
      reason: note.reason,
      issuedAt: note.issuedAt.toISOString(),
      returnedQuantity: note.lines.reduce((sum, line) => sum + Number(line.quantity.toFixed(6)), 0).toFixed(6),
    })),
    corrections: record.corrections.map((correction) => ({
      id: correction.id,
      amountDelta: correction.amountDelta.toFixed(2),
      reason: correction.reason,
      issuedAt: correction.issuedAt.toISOString(),
      affectedLines: correction.lines.length,
    })),
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
      unitCost: line.unitCost?.toFixed(2) ?? null,
      correctedUnitCost: correctedCosts.get(line.id) ?? null,
      returnedQuantity: (returnedQuantity.get(line.id) ?? 0).toFixed(6),
      lineSubtotal: line.lineSubtotal?.toFixed(2) ?? null,
      discountAllocation: line.discountAllocation?.toFixed(2) ?? null,
      shippingAllocation: line.shippingAllocation?.toFixed(2) ?? null,
      lineTotal: line.lineTotal?.toFixed(2) ?? null,
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

function moneyToCents(value: string): bigint {
  const [whole, fraction = '00'] = value.split('.');
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function moneyToCentsSigned(value: string): bigint {
  return value.startsWith('-')
    ? -moneyToCents(value.slice(1))
    : moneyToCents(value);
}

function formatCents(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}
