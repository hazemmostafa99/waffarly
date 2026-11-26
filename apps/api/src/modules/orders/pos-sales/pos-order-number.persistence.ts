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

/**
 * Gives a website or marketplace order the next number from its branch's open order
 * session, so cashiers see #1, #2, #3 for every order regardless of where it came from.
 * Runs as one statement outside checkout/accept transactions so it never makes them
 * fail; it does nothing when the order already has a number or the branch has no open shift.
 */
export async function assignOnlineOrderBranchNumber(
  db: Pick<Prisma.TransactionClient, '$executeRaw'>,
  merchantId: string,
  orderId: string,
): Promise<void> {
  await db.$executeRaw`
    WITH target AS (
      SELECT o."id", o."branchId" FROM "storefront_orders" o
      WHERE o."id" = ${orderId}::uuid AND o."merchantId" = ${merchantId}::uuid
        AND o."branchOrderNumber" IS NULL AND o."branchId" IS NOT NULL
      FOR UPDATE
    ), session AS (
      SELECT s."branchOrderSessionId" AS "id" FROM "pos_shifts" s
      INNER JOIN target t ON t."branchId" = s."branchId"
      WHERE s."merchantId" = ${merchantId}::uuid AND s."status" = 'open'
      ORDER BY s."openedAt" ASC LIMIT 1
    ), bump AS (
      UPDATE "pos_branch_order_sessions" b SET "lastNumber" = b."lastNumber" + 1
      FROM session
      WHERE b."id" = session."id" AND b."merchantId" = ${merchantId}::uuid AND b."closedAt" IS NULL
      RETURNING b."id", b."lastNumber"
    )
    UPDATE "storefront_orders" o
    SET "branchOrderSessionId" = bump."id", "branchOrderNumber" = bump."lastNumber"
    FROM bump
    WHERE o."id" = ${orderId}::uuid AND o."merchantId" = ${merchantId}::uuid
  `;
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
