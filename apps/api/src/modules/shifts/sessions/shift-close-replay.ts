/** Returns a saved close result only when it belongs to the same employee and request. */
import { toCloseReport } from '../shift.mapper.js';
import { ConflictException } from '@nestjs/common';

import type {
  PosEmployeeSession,
  PosShiftCloseReport as PosShiftCloseReportContract,
} from '@waffarly/contracts';
import type { Prisma, PrismaClient } from '@waffarly/database';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { type CloseReportRecord } from '../shift-records.js';
import { assertShiftBranchAssignment } from '../access/shift-access.rules.js';

export function replayShiftClose(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  record: CloseReportRecord,
  shiftId: string,
  fingerprint: string,
  _db: PrismaClient | Prisma.TransactionClient = prisma,
): PosShiftCloseReportContract {
  if (
    record.shiftId !== shiftId ||
    record.operatorEmployeeId !== employee.id ||
    record.fingerprint !== fingerprint
  )
    throw new ConflictException('This shift close request ID was already used for another action.');
  assertShiftBranchAssignment(employee, record.shift.branchId);
  return toCloseReport(record);
}
