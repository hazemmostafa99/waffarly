import type { Prisma, PrismaClient } from '@waffarly/database';

export interface DeliveryBalanceRow {
  pendingTotalCount: number;
  pendingTotalBalance: string;
  orderId: string;
  branchId: string;
  sourceShiftId: string;
  followupShiftId: string | null;
  revision: number;
  orderRevision: number;
  orderStatus: string;
  courierName: string;
  status: 'out_for_delivery' | 'delivered' | 'failed';
  dispatchedAt: Date;
  deliveredAt: Date | null;
  failureReason: string | null;
  custodianEmployeeId: string;
  custodianName: string;
  customerDue: string;
  courierCashHeld: string;
}

/** Shared drawer/follow-up projection; courier remittance is never a second sale. */
export async function readDeliveryBalances(
  db: PrismaClient | Prisma.TransactionClient,
  merchantId: string,
  filter: {
    branchId?: string | undefined;
    shiftId?: string;
    orderId?: string;
    cursor?: string | undefined;
    limit: number;
    pendingOnly?: boolean;
  },
): Promise<DeliveryBalanceRow[]> {
  return db.$queryRaw<DeliveryBalanceRow[]>`
    SELECT d."orderId", d."branchId", o."posShiftId" AS "sourceShiftId",
      CAST(COUNT(*) OVER () AS int) AS "pendingTotalCount",
      (SUM(COALESCE(due.amount, 0) + COALESCE(held.amount, 0)) OVER ())::text AS "pendingTotalBalance",
      d."followupShiftId", d."revision", o."revision" AS "orderRevision",
      o."status" AS "orderStatus", d."courierName", d."status", d."dispatchedAt",
      d."deliveredAt", d."failureReason", d."custodianEmployeeId", e."displayName" AS "custodianName",
      COALESCE(due.amount, 0)::text AS "customerDue", COALESCE(held.amount, 0)::text AS "courierCashHeld"
    FROM "pos_deliveries" d
    JOIN "storefront_orders" o ON o."id" = d."orderId" AND o."merchantId" = d."merchantId"
    JOIN "branches" b ON b."id" = d."branchId" AND b."merchantId" = d."merchantId" AND b."archivedAt" IS NULL
    JOIN "pos_employees" e ON e."id" = d."custodianEmployeeId" AND e."merchantId" = d."merchantId"
    LEFT JOIN LATERAL (
      SELECT SUM(GREATEST(c."amount" - COALESCE((SELECT SUM(p."amount") FROM "pos_order_payments" p
        WHERE p."merchantId" = c."merchantId" AND p."orderId" = c."orderId" AND p."checkId" = c."id"), 0), 0)) AS amount
      FROM "pos_order_checks" c WHERE c."orderId" = d."orderId" AND c."merchantId" = d."merchantId" AND c."cancelledAt" IS NULL
    ) due ON true
    LEFT JOIN LATERAL (
      SELECT SUM(p."amount" - COALESCE((SELECT SUM(r."amount") FROM "pos_delivery_remittances" r
        WHERE r."paymentId" = p."id" AND r."merchantId" = p."merchantId"), 0)) AS amount
      FROM "pos_order_payments" p WHERE p."orderId" = d."orderId" AND p."merchantId" = d."merchantId" AND p."cashCustody" = 'courier'
    ) held ON true
    WHERE d."merchantId" = ${merchantId}::uuid
      AND (${filter.branchId ?? null}::uuid IS NULL OR d."branchId" = ${filter.branchId ?? null}::uuid)
      AND (${filter.shiftId ?? null}::uuid IS NULL OR d."followupShiftId" = ${filter.shiftId ?? null}::uuid)
      AND (${filter.orderId ?? null}::uuid IS NULL OR d."orderId" = ${filter.orderId ?? null}::uuid)
      AND (${filter.cursor ?? null}::uuid IS NULL OR d."orderId" < ${filter.cursor ?? null}::uuid)
      AND (${filter.pendingOnly ?? true} = false OR d."status" <> 'delivered' OR COALESCE(due.amount, 0) > 0 OR COALESCE(held.amount, 0) > 0)
    ORDER BY d."orderId" DESC LIMIT ${filter.limit}
  `;
}
