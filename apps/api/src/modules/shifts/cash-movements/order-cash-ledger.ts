/** Records the drawer effects of order payments and refunds against the right shift. */
import { ConflictException, ForbiddenException } from '@nestjs/common';

import type { PosEmployeeSession } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { assertShiftBranchAssignment } from '../access/shift-access.rules.js';

export async function lockOpenShiftForSale(
  tx: Prisma.TransactionClient,
  employee: PosEmployeeSession,
  registerId: string,
): Promise<{ id: string; branchId: string }> {
  if (!employee.permissions.includes('sell'))
    throw new ForbiddenException('This employee is not authorized to sell.');
  const rows = await tx.$queryRaw<Array<{ id: string; branchId: string }>>`
      SELECT s."id", s."branchId"
      FROM "pos_shifts" s
      INNER JOIN "pos_registers" r
        ON r."id" = s."registerId" AND r."merchantId" = s."merchantId"
      WHERE s."merchantId" = ${employee.merchantId}::uuid
        AND s."registerId" = ${registerId}::uuid
        AND s."status" = 'open'
        AND r."active" = true
      FOR SHARE OF s
    `;
  const shift = rows[0];
  if (!shift) throw new ConflictException('Open a register shift before confirming a sale.');
  assertShiftBranchAssignment(employee, shift.branchId);
  return shift;
}

export async function recordCashSale(
  tx: Prisma.TransactionClient,
  input: {
    merchantId: string;
    shiftId: string;
    paymentId: string;
    operatorEmployeeId: string;
    amount: string;
  },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "pos_shifts"
      WHERE "id" = ${input.shiftId}::uuid
        AND "merchantId" = ${input.merchantId}::uuid
        AND "status" = 'open'
      FOR SHARE
    `;
  if (rows.length === 0) throw new ConflictException('The register shift is no longer open.');
  await tx.posShiftCashMovement.create({
    data: {
      merchantId: input.merchantId,
      shiftId: input.shiftId,
      paymentId: input.paymentId,
      operatorEmployeeId: input.operatorEmployeeId,
      kind: 'cash_sale',
      amount: input.amount,
    },
  });
}

export async function lockOpenShiftForPayment(
  tx: Prisma.TransactionClient,
  input: { merchantId: string; shiftId: string; branchId: string },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "pos_shifts"
      WHERE "id" = ${input.shiftId}::uuid
        AND "merchantId" = ${input.merchantId}::uuid
        AND "branchId" = ${input.branchId}::uuid
        AND "status" = 'open'
      FOR SHARE
    `;
  if (rows.length === 0)
    throw new ConflictException('The register shift for this order is not open.');
}

export async function lockDeliveryReceivingShift(
  tx: Prisma.TransactionClient,
  input: {
    merchantId: string;
    branchId: string;
    shiftId: string;
    followupShiftId: string | null;
  },
): Promise<void> {
  await lockOpenShiftForPayment(tx, input);
  if (input.followupShiftId && input.followupShiftId !== input.shiftId) {
    const current = await tx.posShift.findFirst({
      where: { id: input.followupShiftId, merchantId: input.merchantId, status: 'open' },
      select: { id: true },
    });
    if (current)
      throw new ConflictException(
        'Close and approve delivery handover before moving follow-up to another drawer.',
      );
  }
}

export async function lockOpenShiftForRefund(
  tx: Prisma.TransactionClient,
  input: { merchantId: string; shiftId: string; branchId: string; employee: PosEmployeeSession },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT s."id"
      FROM "pos_shifts" s
      INNER JOIN "pos_registers" r
        ON r."id" = s."registerId" AND r."branchId" = s."branchId"
          AND r."merchantId" = s."merchantId" AND r."active" = true
      WHERE s."id" = ${input.shiftId}::uuid
        AND s."merchantId" = ${input.merchantId}::uuid
        AND s."branchId" = ${input.branchId}::uuid
        AND s."status" = 'open'
      FOR SHARE OF s
    `;
  if (rows.length === 0)
    throw new ConflictException('Choose an open register shift for this refund.');
  assertShiftBranchAssignment(input.employee, input.branchId);
}

export async function recordCashRefund(
  tx: Prisma.TransactionClient,
  input: {
    merchantId: string;
    shiftId: string;
    refundTenderId: string;
    operatorEmployeeId: string;
    amount: string;
  },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "pos_shifts"
      WHERE "id" = ${input.shiftId}::uuid
        AND "merchantId" = ${input.merchantId}::uuid
        AND "status" = 'open'
      FOR SHARE
    `;
  if (rows.length === 0)
    throw new ConflictException('The refund register shift is no longer open.');
  await tx.posShiftRefundMovement.create({
    data: {
      merchantId: input.merchantId,
      shiftId: input.shiftId,
      refundTenderId: input.refundTenderId,
      operatorEmployeeId: input.operatorEmployeeId,
      amount: input.amount,
    },
  });
}
