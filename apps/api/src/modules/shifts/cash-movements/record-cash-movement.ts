/** Records approved cash added to or taken from a drawer and remembers completed requests. */
import { toManualCashMovementSummary, toLiveShiftSummary } from '../shift.mapper.js';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';

import type { PosEmployeeSession, RecordPosShiftCashMovementResponse } from '@waffarly/contracts';
import type { Prisma, PrismaClient } from '@waffarly/database';

import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { toCents, toSignedCents } from '../../../common/money/money.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import {
  recordPosShiftCashMovementSchema,
  withoutShiftCashMovementApproval,
} from '../shifts.schemas.js';

import { trackSafeDrop } from '../cash-custody.persistence.js';
import {
  shiftInclude,
  manualCashMovementInclude,
  type ManualCashMovementRecord,
} from '../shift-records.js';
import { lockOpenShiftForCashMovement } from './lock-cash-movement.js';
import { buildShiftReconciliation } from '../reconciliation/shift-reconciliation.js';
import {
  readCurrentShiftPermissions,
  requireCurrentApprover,
  assertShiftBranchAssignment,
  requireShiftAccess,
} from '../access/shift-access.rules.js';

export async function recordManualCashMovement(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  shiftId: string,
  input: unknown,
  approverEmployeeId?: string,
): Promise<RecordPosShiftCashMovementResponse> {
  requireShiftAccess(employee);
  const parsed = parseRequest(recordPosShiftCashMovementSchema, input);
  const request = withoutShiftCashMovementApproval(parsed);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ shiftId, ...request, approverEmployeeId: approverEmployeeId ?? null }))
    .digest('hex');
  const existing = await prisma.posShiftManualCashMovement.findFirst({
    where: { merchantId: employee.merchantId, requestId: request.requestId },
    include: manualCashMovementInclude,
  });
  if (existing) return replayManualCashMovement(prisma, employee, existing, shiftId, fingerprint);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const prior = await tx.posShiftManualCashMovement.findFirst({
          where: { merchantId: employee.merchantId, requestId: request.requestId },
          include: manualCashMovementInclude,
        });
        if (prior)
          return replayManualCashMovement(prisma, employee, prior, shiftId, fingerprint, tx);

        const shiftRow = await lockOpenShiftForCashMovement(tx, employee, shiftId);
        assertShiftBranchAssignment(employee, shiftRow.branchId);
        const actorPermissions = await readCurrentShiftPermissions(tx, employee, shiftRow.branchId);
        if (!actorPermissions.includes('sell'))
          throw new ForbiddenException('This employee is not authorized to change register cash.');
        let approverEmployeeIdForRecord: string | null = null;
        if (actorPermissions.includes('manage_cash_movements')) {
          if (approverEmployeeId) {
            approverEmployeeIdForRecord = await requireCurrentApprover(
              tx,
              employee,
              shiftRow.branchId,
              approverEmployeeId,
              'manage_cash_movements',
            );
          }
        } else {
          if (!approverEmployeeId)
            throw new ForbiddenException('Supervisor approval is required for a cash movement.');
          approverEmployeeIdForRecord = await requireCurrentApprover(
            tx,
            employee,
            shiftRow.branchId,
            approverEmployeeId,
            'manage_cash_movements',
          );
        }
        if (request.kind === 'cash_drop' && request.safeId) {
          const currentShift = await tx.posShift.findFirstOrThrow({
            where: { id: shiftId, merchantId: employee.merchantId },
            include: shiftInclude,
          });
          const cash = await buildShiftReconciliation(tx, currentShift);
          if (toCents(request.amount) > toSignedCents(cash.expectedCash))
            throw new ConflictException('The cash drop exceeds available drawer cash.');
        }
        const movement = await tx.posShiftManualCashMovement.create({
          data: {
            merchantId: employee.merchantId,
            shiftId,
            requestId: request.requestId,
            fingerprint,
            kind: request.kind,
            amount: request.amount,
            dropReference: request.dropReference ?? null,
            reason: request.reason,
            operatorEmployeeId: employee.id,
            approvedByEmployeeId: approverEmployeeIdForRecord,
          },
          include: manualCashMovementInclude,
        });
        if (request.kind === 'cash_drop' && request.safeId) {
          await trackSafeDrop(tx, {
            merchantId: employee.merchantId,
            branchId: shiftRow.branchId,
            shiftId,
            safeId: request.safeId,
            movementId: movement.id,
            requestId: request.requestId,
            amount: request.amount,
            reference: request.dropReference!,
            reason: request.reason,
            actor: `pos:${employee.id}`,
            fingerprint,
          });
        }
        const shift = await tx.posShift.findFirstOrThrow({
          where: { id: shiftId, merchantId: employee.merchantId, status: 'open' },
          include: shiftInclude,
        });
        return {
          shiftId,
          reconciliation: toLiveShiftSummary(await buildShiftReconciliation(tx, shift)),
          movement: toManualCashMovementSummary(movement),
        };
      },
      { isolationLevel: 'ReadCommitted' },
    );
  } catch (error) {
    if (isUniqueConstraintError(error) || isSerializationConflict(error)) {
      const prior = await prisma.posShiftManualCashMovement.findFirst({
        where: { merchantId: employee.merchantId, requestId: request.requestId },
        include: manualCashMovementInclude,
      });
      if (prior) return replayManualCashMovement(prisma, employee, prior, shiftId, fingerprint);
      throw new ConflictException(
        'The cash movement changed concurrently. Refresh the shift and retry.',
      );
    }
    throw error;
  }
}

export function replayManualCashMovement(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  record: ManualCashMovementRecord,
  shiftId: string,
  fingerprint: string,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<RecordPosShiftCashMovementResponse> {
  if (
    record.shiftId !== shiftId ||
    record.operatorEmployeeId !== employee.id ||
    record.fingerprint !== fingerprint
  )
    throw new ConflictException(
      'This cash movement request ID was already used for another action.',
    );
  return db.posShift
    .findFirst({
      where: { id: shiftId, merchantId: employee.merchantId },
      include: shiftInclude,
    })
    .then(async (shift) => {
      if (!shift) throw new NotFoundException('The register shift was not found.');
      assertShiftBranchAssignment(employee, shift.branchId);
      return {
        shiftId,
        reconciliation: toLiveShiftSummary(await buildShiftReconciliation(db, shift)),
        movement: toManualCashMovementSummary(record),
      };
    });
}
