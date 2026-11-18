/** Prepares cash handoff records and identifies exact repeats of earlier requests. */
import { createHash } from 'node:crypto';
import type { CashTransferSummary, CursorPage } from '@waffarly/contracts';

import type { Prisma } from '@waffarly/database';

import { formatCents, toSignedCents } from '../../../common/money/money.js';

export const transferInclude = {
  sourceShift: { select: { register: { select: { name: true } } } },
  destinationSafe: { select: { name: true } },
  destinationShift: { select: { register: { select: { name: true } } } },
} satisfies Prisma.PosCashTransferInclude;

export type TransferRecord = Prisma.PosCashTransferGetPayload<{ include: typeof transferInclude }>;

export const fingerprintCustodyCommand = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const cashAmountCents = (value: { toFixed(n: number): string } | null) =>
  toSignedCents(value?.toFixed(2) ?? '0.00');

export function page<T extends { id: string }>(items: T[], more: boolean): CursorPage<T> {
  return { items, nextCursor: more ? (items.at(-1)?.id ?? null) : null };
}

export function toCashTransferSummary(row: TransferRecord): CashTransferSummary {
  return {
    id: row.id,
    sourceShiftId: row.sourceShiftId,
    registerName: row.sourceShift.register.name,
    branchId: row.branchId,
    destinationName: row.destinationSafe?.name ?? row.destinationShift?.register.name ?? '',
    kind: row.destinationSafeId ? 'safe' : 'carryover',
    amount: row.amount.toFixed(2),
    receivedAmount: row.receivedAmount?.toFixed(2) ?? null,
    difference:
      row.receivedAmount === null
        ? null
        : formatCents(cashAmountCents(row.receivedAmount) - cashAmountCents(row.amount)),
    status: row.status as CashTransferSummary['status'],
    reference: row.reference,
    reason: row.reason,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    receivedBy: row.receivedBy,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    receiptNote: row.receiptNote,
    resolutionNote: row.resolutionNote,
    resolvedBy: row.resolvedBy,
  };
}
