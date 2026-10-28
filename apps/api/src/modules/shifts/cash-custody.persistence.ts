import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@waffarly/database';
import { toCents, formatCents } from '../../common/money/money.js';

export async function remainingClosedCash(
  tx: Prisma.TransactionClient,
  merchantId: string,
  shiftId: string,
): Promise<bigint> {
  const report = await tx.posShiftCloseReport.findFirst({ where: { merchantId, shiftId } });
  if (!report)
    throw new ConflictException('Count and close this shift before settling its remaining cash.');
  const allocated = await tx.posCashTransfer.aggregate({
    where: { merchantId, sourceShiftId: shiftId, manualMovementId: null },
    _sum: { amount: true },
  });
  return (
    toCents(report.countedCash.toFixed(2)) - toCents(allocated._sum.amount?.toFixed(2) ?? '0.00')
  );
}

export async function trackSafeDrop(
  tx: Prisma.TransactionClient,
  input: {
    merchantId: string;
    branchId: string;
    shiftId: string;
    safeId: string;
    movementId: string;
    requestId: string;
    amount: string;
    reference: string;
    reason: string;
    actor: string;
    fingerprint: string;
  },
): Promise<void> {
  const safe = await tx.posCashSafe.findFirst({
    where: { id: input.safeId, merchantId: input.merchantId, branchId: input.branchId },
  });
  if (!safe) throw new NotFoundException('Select a safe in the same branch.');
  await tx.posCashTransfer.create({
    data: {
      merchantId: input.merchantId,
      branchId: input.branchId,
      requestId: input.requestId,
      sourceShiftId: input.shiftId,
      destinationSafeId: safe.id,
      manualMovementId: input.movementId,
      amount: input.amount,
      reference: input.reference,
      reason: input.reason,
      createdBy: input.actor,
      fingerprint: input.fingerprint,
    },
  });
}

export async function carryClosedCash(
  tx: Prisma.TransactionClient,
  input: {
    merchantId: string;
    branchId: string;
    registerId: string;
    sourceShiftId: string;
    destinationShiftId: string;
    requestId: string;
    amount: string;
    actor: string;
  },
): Promise<void> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "pos_shifts" WHERE "id"=${input.sourceShiftId}::uuid
    AND "merchantId"=${input.merchantId}::uuid AND "registerId"=${input.registerId}::uuid
    AND "branchId"=${input.branchId}::uuid AND "status"='closed' FOR UPDATE`;
  if (!locked.length) throw new NotFoundException('Select a closed shift on the same register.');
  const amount = toCents(input.amount);
  if (
    amount <= 0n ||
    amount > (await remainingClosedCash(tx, input.merchantId, input.sourceShiftId))
  ) {
    throw new ConflictException('The previous shift does not have enough unallocated cash.');
  }
  await tx.posCashTransfer.create({
    data: {
      merchantId: input.merchantId,
      branchId: input.branchId,
      requestId: input.requestId,
      fingerprint: input.destinationShiftId,
      sourceShiftId: input.sourceShiftId,
      destinationShiftId: input.destinationShiftId,
      amount: formatCents(amount),
      receivedAmount: formatCents(amount),
      status: 'received',
      reference: 'SHIFT-CARRYOVER',
      reason: 'Opening float received from previous shift',
      createdBy: input.actor,
      receivedBy: input.actor,
      receivedAt: new Date(),
    },
  });
}
