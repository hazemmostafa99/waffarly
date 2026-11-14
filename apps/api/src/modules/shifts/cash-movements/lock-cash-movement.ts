/** Keeps the selected cash drawer available while a cash movement is recorded. */
import { ConflictException } from '@nestjs/common';

import type { PosEmployeeSession } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

export async function lockOpenShiftForCashMovement(
  tx: Prisma.TransactionClient,
  employee: PosEmployeeSession,
  shiftId: string,
): Promise<{ id: string; branchId: string }> {
  const rows = await tx.$queryRaw<Array<{ id: string; branchId: string }>>`
    SELECT s."id", s."branchId"
    FROM "pos_shifts" s
    INNER JOIN "pos_registers" r
      ON r."id" = s."registerId" AND r."branchId" = s."branchId"
        AND r."merchantId" = s."merchantId" AND r."active" = true
    INNER JOIN "branches" b
      ON b."id" = s."branchId" AND b."merchantId" = s."merchantId"
        AND b."archivedAt" IS NULL
    WHERE s."id" = ${shiftId}::uuid
      AND s."merchantId" = ${employee.merchantId}::uuid
      AND s."status" = 'open'
    FOR SHARE OF s
  `;
  const shift = rows[0];
  if (!shift) throw new ConflictException('Choose an open register shift for this cash movement.');
  return shift;
}
