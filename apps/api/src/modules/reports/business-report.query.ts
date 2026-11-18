/** Aggregates monthly costs and chart data inside the caller's consistent read transaction. */
import type { Prisma } from '@waffarly/database';
import type { BusinessReportAmountRow, BusinessReportDay } from '@waffarly/contracts';
import type { PeriodCosts } from './business-report.rules.js';
import { reportMonth } from './business-report.rules.js';

export async function readPeriodCosts(
  db: Prisma.TransactionClient,
  merchantId: string,
  branchId: string | null,
  period: ReturnType<typeof reportMonth>,
): Promise<PeriodCosts> {
  const rows = await db.$queryRaw<PeriodCosts[]>`
    WITH scope AS (
      SELECT ${merchantId}::uuid AS merchant, ${branchId}::uuid AS branch,
        ${period.from}::date AS first, ${period.until}::date AS last
    ), payroll AS (
      SELECT l.* FROM "staff_payroll_lines" l
      JOIN "staff_payroll_runs" r ON r."id"=l."payrollRunId" AND r."merchantId"=l."merchantId"
      CROSS JOIN scope s
      WHERE l."merchantId"=s.merchant AND (s.branch IS NULL OR l."branchId"=s.branch)
        AND r."monthStart"=s.first AND r."status" IN ('approved','paid')
    ), waste AS (
      SELECT m.* FROM "stock_movements" m
      JOIN "stock_movement_batches" b ON b."id"=m."batchId" AND b."merchantId"=m."merchantId"
      JOIN "warehouses" w ON w."id"=m."warehouseId" AND w."merchantId"=m."merchantId"
      CROSS JOIN scope s
      WHERE m."merchantId"=s.merchant AND b."kind"='waste'
        AND (s.branch IS NULL OR w."branchId"=s.branch)
        AND m."createdAt">=(s.first::timestamp AT TIME ZONE 'Africa/Cairo')
        AND m."createdAt"<(s.last::timestamp AT TIME ZONE 'Africa/Cairo')
    ) SELECT
      COALESCE((SELECT SUM(e."amount") FROM "merchant_expenses" e, scope s
        WHERE e."merchantId"=s.merchant AND (s.branch IS NULL OR e."branchId"=s.branch)
          AND e."incurredOn">=s.first AND e."incurredOn"<s.last),0)::numeric(30,2)::text AS expenses,
      COALESCE((SELECT SUM("basePay"+"additions"-"deductions") FROM payroll),0)::numeric(30,2)::text AS "payrollCost",
      NOT EXISTS (SELECT 1 FROM "staff_members" e, scope s
        WHERE e."merchantId"=s.merchant AND (s.branch IS NULL OR e."branchId"=s.branch)
          AND e."startDate"<s.last AND (e."endDate" IS NULL OR e."endDate">=s.first)
          AND NOT EXISTS (SELECT 1 FROM payroll p WHERE p."staffMemberId"=e."id")) AS "payrollComplete",
      COALESCE((SELECT SUM(ROUND(ABS("baseDelta")*"baseUnitCost",2)) FROM waste),0)::numeric(30,2)::text AS "wasteCost",
      (SELECT COUNT(*)::int FROM waste WHERE "baseUnitCost" IS NULL) AS "unknownWasteMovements"`;
  return rows[0]!;
}

export async function readBusinessCharts(
  db: Prisma.TransactionClient,
  merchantId: string,
  branchId: string | null,
  period: ReturnType<typeof reportMonth>,
): Promise<{
  daily: BusinessReportDay[];
  expenseCategories: BusinessReportAmountRow[];
  sources: BusinessReportAmountRow[];
}> {
  const daily = await db.$queryRaw<BusinessReportDay[]>`
    WITH scope AS (
      SELECT ${merchantId}::uuid AS merchant, ${branchId}::uuid AS branch,
        (${period.from}::date::timestamp AT TIME ZONE 'Africa/Cairo') AS first,
        (${period.until}::date::timestamp AT TIME ZONE 'Africa/Cairo') AS last
    ), lines AS (
      SELECT l.*, o."source", o."status", o."cancelledAt", o."stockRestored" FROM "storefront_order_lines" l
      JOIN "storefront_orders" o ON o."id"=l."orderId" AND o."merchantId"=l."merchantId", scope s
      WHERE l."merchantId"=s.merchant AND (s.branch IS NULL OR o."branchId"=s.branch)
    ), events AS (
      SELECT (l."revenueRecognizedAt" AT TIME ZONE 'Africa/Cairo')::date AS day,
        l."recognizedRevenueAmount" AS sales, 0::numeric AS cost, 0::numeric AS expense,
        CASE WHEN l."costSnapshotTotal" IS NULL THEN 1 ELSE 0 END AS missing
        FROM lines l, scope s WHERE l."revenueRecognizedAt">=s.first AND l."revenueRecognizedAt"<s.last
          AND l."cancelledAt" IS NULL AND l."status" NOT IN ('cancelled','rejected')
      UNION ALL
      SELECT (l."costSnapshotAt" AT TIME ZONE 'Africa/Cairo')::date, 0, l."costSnapshotTotal",0,0
        FROM lines l, scope s WHERE l."costSnapshotAt">=s.first AND l."costSnapshotAt"<s.last
          AND ((l."cancelledAt" IS NULL AND l."status" NOT IN ('cancelled','rejected')) OR l."stockRestored"=false)
      UNION ALL
      SELECT (r."issuedAt" AT TIME ZONE 'Africa/Cairo')::date,
        -COALESCE((SELECT SUM(rl."revenueReversalAmount") FROM "pos_order_refund_lines" rl
          WHERE rl."refundId"=r."id" AND rl."merchantId"=r."merchantId"),r."amount"),0,0,0
        FROM "pos_order_refunds" r
        JOIN "storefront_orders" o ON o."id"=r."orderId" AND o."merchantId"=r."merchantId", scope s
        WHERE r."merchantId"=s.merchant AND (s.branch IS NULL OR o."branchId"=s.branch)
          AND r."issuedAt">=s.first AND r."issuedAt"<s.last
      UNION ALL
      SELECT e."incurredOn",0,0,e."amount",0 FROM "merchant_expenses" e, scope s
        WHERE e."merchantId"=s.merchant AND (s.branch IS NULL OR e."branchId"=s.branch)
          AND e."incurredOn">=${period.from}::date AND e."incurredOn"<${period.until}::date
    ), days AS (
      SELECT generate_series(${period.from}::date,${period.to}::date,'1 day')::date AS day
    ) SELECT d.day::text AS date, COALESCE(SUM(e.sales),0)::numeric(30,2)::text AS "netSales",
      CASE WHEN COALESCE(SUM(e.missing),0)>0 THEN NULL ELSE COALESCE(SUM(e.cost),0)::numeric(30,2)::text END AS "consumedCost",
      COALESCE(SUM(e.cost),0)::numeric(30,2)::text AS "recordedConsumedCost",
      COALESCE(SUM(e.expense),0)::numeric(30,2)::text AS expenses
      FROM days d LEFT JOIN events e USING(day) GROUP BY d.day ORDER BY d.day`;

  const expenseCategories = await db.$queryRaw<BusinessReportAmountRow[]>`
    WITH categories AS (
      SELECT e."category", SUM(e."amount") AS amount,
        ROW_NUMBER() OVER (ORDER BY SUM(e."amount") DESC, e."category") AS rank
      FROM "merchant_expenses" e WHERE e."merchantId"=${merchantId}::uuid
        AND (${branchId}::uuid IS NULL OR e."branchId"=${branchId}::uuid)
        AND e."incurredOn">=${period.from}::date AND e."incurredOn"<${period.until}::date
      GROUP BY e."category"
    ), grouped AS (
      SELECT 'category:' || category AS id, category AS label, amount, rank FROM categories WHERE rank<=8
      UNION ALL
      SELECT 'remaining_categories', 'Remaining categories', SUM(amount), 9 FROM categories
        WHERE rank>8 HAVING COUNT(*)>0
    ) SELECT id, label, amount::numeric(30,2)::text AS amount FROM grouped ORDER BY rank`;

  const sources = await db.$queryRaw<BusinessReportAmountRow[]>`
    WITH events AS (
      SELECT o."source", SUM(l."recognizedRevenueAmount") AS amount
      FROM "storefront_order_lines" l
      JOIN "storefront_orders" o ON o."id"=l."orderId" AND o."merchantId"=l."merchantId"
      WHERE l."merchantId"=${merchantId}::uuid AND (${branchId}::uuid IS NULL OR o."branchId"=${branchId}::uuid)
        AND o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected')
        AND l."revenueRecognizedAt">=(${period.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
        AND l."revenueRecognizedAt"<(${period.until}::date::timestamp AT TIME ZONE 'Africa/Cairo')
      GROUP BY o."source"
      UNION ALL
      SELECT o."source", -SUM(COALESCE((SELECT SUM(rl."revenueReversalAmount") FROM "pos_order_refund_lines" rl
        WHERE rl."refundId"=r."id" AND rl."merchantId"=r."merchantId"),r."amount"))
      FROM "pos_order_refunds" r
      JOIN "storefront_orders" o ON o."id"=r."orderId" AND o."merchantId"=r."merchantId"
      WHERE r."merchantId"=${merchantId}::uuid AND (${branchId}::uuid IS NULL OR o."branchId"=${branchId}::uuid)
        AND r."issuedAt">=(${period.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
        AND r."issuedAt"<(${period.until}::date::timestamp AT TIME ZONE 'Africa/Cairo')
      GROUP BY o."source"
    ) SELECT source AS id, source AS label, SUM(amount)::text AS amount FROM events
      GROUP BY source ORDER BY SUM(amount) DESC, source`;
  return { daily, expenseCategories, sources };
}
