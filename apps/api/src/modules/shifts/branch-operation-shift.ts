import type { Prisma } from '@waffarly/database';

/** Keep an open same-branch cash shift stable until the caller transaction commits. */
export async function lockBranchOperationShift(db: Prisma.TransactionClient, merchantId: string, branchId: string | null) {
  if (!branchId) return null;
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT s."id" FROM "pos_shifts" s
    INNER JOIN "pos_registers" r ON r."id" = s."registerId" AND r."merchantId" = s."merchantId" AND r."branchId" = s."branchId"
    INNER JOIN "branches" b ON b."id" = s."branchId" AND b."merchantId" = s."merchantId"
    WHERE s."merchantId" = ${merchantId}::uuid AND s."branchId" = ${branchId}::uuid
      AND s."status" = 'open' AND r."active" = true AND b."archivedAt" IS NULL
    ORDER BY s."id" LIMIT 1 FOR SHARE OF s
  `;
  return rows[0] ?? null;
}
