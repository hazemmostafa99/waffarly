/**
 * Gives each new cashier sale its branch-and-day reference without reusing another sale number.
 */
import { InternalServerErrorException } from '@nestjs/common';
import type { Prisma } from '@waffarly/database';

export async function allocatePosOrderReference(
  tx: Prisma.TransactionClient,
  merchantId: string,
  branchId: string,
): Promise<string> {
  const [number] = await tx.$queryRaw<Array<{ reference: string }>>`
            WITH branch_code AS (
              INSERT INTO "pos_order_branch_codes" ("merchantId", "branchId")
              VALUES (${merchantId}::uuid, ${branchId}::uuid)
              ON CONFLICT ("merchantId", "branchId") DO UPDATE SET "branchId" = EXCLUDED."branchId"
              RETURNING "code"
            ), counter AS (
              INSERT INTO "pos_order_daily_counters" ("merchantId", "branchId", "businessDate", "lastNumber")
              VALUES (${merchantId}::uuid, ${branchId}::uuid,
                      (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Cairo')::date, 1)
              ON CONFLICT ("merchantId", "branchId", "businessDate")
              DO UPDATE SET "lastNumber" = "pos_order_daily_counters"."lastNumber" + 1
              RETURNING "businessDate", "lastNumber"
            )
            SELECT 'B' || branch_code."code"::text || '-' || to_char(counter."businessDate", 'YYYYMMDD') || '-' || lpad(counter."lastNumber"::text, GREATEST(4, length(counter."lastNumber"::text)), '0') AS "reference"
            FROM branch_code CROSS JOIN counter
          `;
  if (!number) throw new InternalServerErrorException('Could not allocate an order number.');
  return number.reference;
}

/** Atomically allocates the next customer-facing number for a branch session. */
export async function allocatePosBranchOrderNumber(
  tx: Prisma.TransactionClient,
  merchantId: string,
  branchOrderSessionId: string,
): Promise<number> {
  const [counter] = await tx.$queryRaw<Array<{ lastNumber: number }>>`
    UPDATE "pos_branch_order_sessions"
    SET "lastNumber" = "lastNumber" + 1
    WHERE "id" = ${branchOrderSessionId}::uuid
      AND "merchantId" = ${merchantId}::uuid
      AND "closedAt" IS NULL
    RETURNING "lastNumber"
  `;
  if (!counter)
    throw new InternalServerErrorException('Could not allocate the branch order number.');
  return counter.lastNumber;
}
