/** Reads current custody and outstanding balances without creating cash or business records. */
import type { Prisma } from '@waffarly/database';
import type { BusinessReportBalances } from '@waffarly/contracts';

export async function readBusinessBalances(
  db: Prisma.TransactionClient,
  merchantId: string,
  branchId: string | null,
): Promise<BusinessReportBalances> {
  const rows = await db.$queryRaw<BusinessReportBalances[]>`
    WITH scope AS (SELECT ${merchantId}::uuid AS merchant, ${branchId}::uuid AS branch),
    shifts AS (
      SELECT sh.* FROM "pos_shifts" sh, scope s
      WHERE sh."merchantId"=s.merchant AND (s.branch IS NULL OR sh."branchId"=s.branch)
    ), drawer_events AS (
      SELECT sh."id" AS shift, sh."openingFloat" AS amount FROM shifts sh
      UNION ALL
      SELECT m."shiftId", m."amount" FROM "pos_shift_cash_movements" m
        JOIN shifts sh ON sh."id"=m."shiftId" AND sh."merchantId"=m."merchantId"
      UNION ALL
      SELECT m."shiftId", m."amount" FROM "pos_shift_refund_movements" m
        JOIN shifts sh ON sh."id"=m."shiftId" AND sh."merchantId"=m."merchantId"
      UNION ALL
      SELECT m."shiftId", CASE WHEN m."kind"='cash_in' THEN m."amount" ELSE -m."amount" END
        FROM "pos_shift_manual_cash_movements" m
        JOIN shifts sh ON sh."id"=m."shiftId" AND sh."merchantId"=m."merchantId"
      UNION ALL
      SELECT m."shiftId", m."amount" FROM "pos_delivery_remittances" m
        JOIN shifts sh ON sh."id"=m."shiftId" AND sh."merchantId"=m."merchantId"
      UNION ALL
      SELECT m."shiftId", m."variance" FROM "pos_shift_close_reports" m
        JOIN shifts sh ON sh."id"=m."shiftId" AND sh."merchantId"=m."merchantId"
      UNION ALL
      SELECT t."sourceShiftId", -t."amount" FROM "pos_cash_transfers" t, scope s
        WHERE t."merchantId"=s.merchant AND (s.branch IS NULL OR t."branchId"=s.branch)
          AND t."manualMovementId" IS NULL
    ), invoices AS (
      SELECT i."id", i."totalAmount",
        i."totalAmount"
          + COALESCE((SELECT SUM(c."amountDelta") FROM "purchase_invoice_corrections" c
            WHERE c."invoiceId"=i."id" AND c."merchantId"=i."merchantId"),0)
          - COALESCE((SELECT SUM(c."amount") FROM "purchase_supplier_credit_notes" c
            WHERE c."invoiceId"=i."id" AND c."merchantId"=i."merchantId"),0)
          - COALESCE((SELECT SUM(p."amount") FROM "purchase_supplier_payments" p
            WHERE p."invoiceId"=i."id" AND p."merchantId"=i."merchantId"),0) AS due
      FROM "purchase_invoices" i
      JOIN "warehouses" w ON w."id"=i."warehouseId" AND w."merchantId"=i."merchantId", scope s
      WHERE i."merchantId"=s.merchant AND i."status"='confirmed'
        AND (s.branch IS NULL OR w."branchId"=s.branch)
    ), expenses AS (
      SELECT e."amount"-COALESCE((SELECT SUM(p."amount") FROM "expense_payments" p
        WHERE p."expenseId"=e."id" AND p."merchantId"=e."merchantId"),0) AS due
      FROM "merchant_expenses" e, scope s
      WHERE e."merchantId"=s.merchant AND (s.branch IS NULL OR e."branchId"=s.branch)
    ), salaries AS (
      SELECT l."netDue"-COALESCE((SELECT SUM(p."amount") FROM "staff_payroll_payments" p
        WHERE p."payrollLineId"=l."id" AND p."merchantId"=l."merchantId"),0) AS due
      FROM "staff_payroll_lines" l
      JOIN "staff_payroll_runs" r ON r."id"=l."payrollRunId" AND r."merchantId"=l."merchantId", scope s
      WHERE l."merchantId"=s.merchant AND r."status" IN ('approved','paid')
        AND (s.branch IS NULL OR l."branchId"=s.branch)
    ), tenders AS (
      SELECT p.* FROM "pos_order_payments" p
      JOIN "storefront_orders" o ON o."id"=p."orderId" AND o."merchantId"=p."merchantId", scope s
      WHERE p."merchantId"=s.merchant AND (s.branch IS NULL OR o."branchId"=s.branch)
    ) SELECT
      COALESCE((SELECT SUM(m."amount") FROM "pos_cash_safe_movements" m, scope s
        WHERE m."merchantId"=s.merchant AND (s.branch IS NULL OR m."branchId"=s.branch)),0)::numeric(30,2)::text AS "safeCash",
      COALESCE((SELECT SUM(amount) FROM drawer_events),0)::numeric(30,2)::text AS "drawerCash",
      COALESCE((SELECT SUM(t."amount") FROM "pos_cash_transfers" t, scope s
        WHERE t."merchantId"=s.merchant AND t."status"='pending'
          AND t."destinationSafeId" IS NOT NULL AND (s.branch IS NULL OR t."branchId"=s.branch)),0)::numeric(30,2)::text AS "pendingTransfers",
      COALESCE((SELECT SUM(p."amount"-COALESCE((SELECT SUM(r."amount") FROM "pos_delivery_remittances" r
        WHERE r."paymentId"=p."id" AND r."merchantId"=p."merchantId"),0))
        FROM tenders p WHERE p."cashCustody"='courier'),0)::numeric(30,2)::text AS "courierCash",
      COALESCE((SELECT SUM(GREATEST(due,0)) FROM invoices),0)::numeric(30,2)::text AS "supplierDue",
      COALESCE((SELECT SUM(GREATEST(-due,0)) FROM invoices),0)::numeric(30,2)::text AS "supplierCredit",
      (SELECT COUNT(*)::int FROM invoices WHERE "totalAmount" IS NULL) AS "unknownSupplierInvoices",
      COALESCE((SELECT SUM(due) FROM expenses),0)::numeric(30,2)::text AS "expenseDue",
      COALESCE((SELECT SUM(due) FROM salaries),0)::numeric(30,2)::text AS "payrollDue",
      COALESCE((SELECT SUM(a."amount"-COALESCE((SELECT SUM(r."amount") FROM "staff_advance_repayments" r
        WHERE r."advanceId"=a."id" AND r."merchantId"=a."merchantId"),0)) FROM "staff_advances" a, scope s
        WHERE a."merchantId"=s.merchant AND a."cancelledAt" IS NULL
          AND (s.branch IS NULL OR a."branchId"=s.branch)),0)::numeric(30,2)::text AS "staffAdvances",
      COALESCE((SELECT SUM(GREATEST(c."amount"-COALESCE((SELECT SUM(p."amount") FROM "pos_order_payments" p
        WHERE p."checkId"=c."id" AND p."merchantId"=c."merchantId"),0),0)) FROM "pos_order_checks" c
        JOIN "storefront_orders" o ON o."id"=c."orderId" AND o."merchantId"=c."merchantId", scope s
        WHERE c."merchantId"=s.merchant AND c."cancelledAt" IS NULL
          AND o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected')
          AND (s.branch IS NULL OR o."branchId"=s.branch)),0)::numeric(30,2)::text AS "openCheckDue",
      COALESCE((SELECT SUM(m."amount") FROM "pos_shift_manual_cash_movements" m
        JOIN shifts sh ON sh."id"=m."shiftId" AND sh."merchantId"=m."merchantId"
        WHERE m."kind"='cash_drop' AND NOT EXISTS (SELECT 1 FROM "pos_cash_transfers" t
          WHERE t."manualMovementId"=m."id" AND t."merchantId"=m."merchantId")),0)::numeric(30,2)::text AS "unverifiedDrops",
      COALESCE((SELECT SUM(ABS(t."amount"-t."receivedAmount")) FROM "pos_cash_transfers" t, scope s
        WHERE t."merchantId"=s.merchant AND t."receivedAt" IS NOT NULL AND t."resolvedAt" IS NULL
          AND (s.branch IS NULL OR t."branchId"=s.branch)),0)::numeric(30,2)::text AS "unresolvedTransferDifference"`;
  return rows[0]!;
}
