/** Checks that a repeated drawer cash request matches its previously recorded result. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { toLiveShiftSummary, toManualCashMovementSummary } from '../shift.mapper.js';

import type { PosEmployeeSession, RecordPosShiftCashMovementResponse } from '@waffarly/contracts';
import type { Prisma, PrismaClient } from '@waffarly/database';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { assertShiftBranchAssignment } from '../access/shift-access.rules.js';
import { buildShiftReconciliation } from '../reconciliation/shift-reconciliation.js';
import { shiftInclude, type ManualCashMovementRecord } from '../shift-records.js';

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
