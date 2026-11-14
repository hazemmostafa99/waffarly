/**
 * Prepares a readable record of returned items, their value and the staff who approved them.
 */
import type { PosItemReturnSummary } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { formatCents, toCents } from '../../../common/money/money.js';

export const itemReturnInclude = {
  createdBy: { select: { displayName: true } },
  approvedBy: { select: { displayName: true } },
  lines: { orderBy: [{ orderLineId: 'asc' as const }, { id: 'asc' as const }] },
} satisfies Prisma.PosOrderItemReturnInclude;

export type ItemReturnRecord = Prisma.PosOrderItemReturnGetPayload<{
  include: typeof itemReturnInclude;
}>;

export function toItemReturnSummary(record: ItemReturnRecord): PosItemReturnSummary {
  return {
    id: record.id,
    requestId: record.requestId,
    returnNumber: record.returnNumber,
    orderId: record.orderId,
    amount: formatCents(toCents(record.amount.toString())),
    currency: (record.currency || 'EGP') as 'EGP',
    reason: record.reason,
    issuedAt: record.issuedAt.toISOString(),
    createdByEmployeeId: record.createdByEmployeeId,
    approvedByEmployeeId: record.approvedByEmployeeId,
    issuedBy: record.createdBy.displayName,
    approvedBy: record.approvedBy?.displayName ?? null,
    lines: record.lines.map((line) => ({
      orderLineId: line.orderLineId,
      productName: line.productName,
      variantName: line.variantName,
      quantity: line.quantity,
      disposition: 'waste',
      unitPrice: formatCents(toCents(line.unitPrice.toString())),
      amount: formatCents(toCents(line.amount.toString())),
    })),
  };
}
