import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import type { OwnerPosOperationsReport } from '@waffarly/contracts';
import { formatCents } from '../../common/money/money.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

export type PosOperationsReportQuery = {
  from: string;
  to: string;
  branchId?: string;
};

type OrderTotalsRow = {
  placedCount: bigint;
  cancelledCount: bigint;
  acceptedCount: bigint;
  completedCount: bigint;
  paidCount: bigint;
  settledCheckCount: bigint;
  orderValueCents: string;
  outstandingCents: string;
  acceptedToStartSeconds: bigint | null;
  startToReadySeconds: bigint | null;
};

type TenderTotalsRow = {
  cashCents: string;
  terminalCents: string;
  courierCashCents?: string;
  deliveryDrawerCents?: string;
};
type CashierActivityRow = {
  deliveryCashReceivedCents?: string;
  employeeId: string | null;
  employeeName: string | null;
  ordersOpened: bigint;
  cancelledOrders: bigint;
  orderValueCents: string;
  paymentCount: bigint;
  cashCollectedCents: string;
  terminalCollectedCents: string;
  refundCount: bigint;
  cashRefundedCents: string;
  terminalRefundedCents: string;
};

@Injectable()
export class PosOperationsReportService {
  private readonly logger = new Logger(PosOperationsReportService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(
    merchantId: string,
    query: PosOperationsReportQuery,
  ): Promise<OwnerPosOperationsReport> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      to <= from ||
      to.getTime() - from.getTime() > 93 * 24 * 60 * 60 * 1000
    )
      throw new BadRequestException('Choose a valid operations report range of up to 93 days.');

    if (query.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: query.branchId, merchantId, archivedAt: null },
        select: { id: true },
      });
      if (!branch) throw new BadRequestException('The selected branch is unavailable.');
    }

    const startedAt = performance.now();
    const [orderRows, collectionRows, refundRows, cashierActivityRows] = await Promise.all([
      this.prisma.$queryRaw<OrderTotalsRow[]>`
        WITH scoped_orders AS (
          SELECT o."id", o."status", o."total", o."acceptedAt",
            o."preparationStartedAt", o."readyAt", o."completedAt", o."cancelledAt"
          FROM "storefront_orders" o
          WHERE o."merchantId" = ${merchantId}
            AND o."source" = 'pos'
            AND o."createdAt" >= ${from}
            AND o."createdAt" < ${to}
            AND (${query.branchId ?? null}::uuid IS NULL OR o."branchId" = ${query.branchId ?? null}::uuid)
        ), check_paid AS (
          SELECT p."checkId", SUM(p."amount") AS "paid"
          FROM "pos_order_payments" p
          JOIN scoped_orders o ON o."id" = p."orderId"
          WHERE p."merchantId" = ${merchantId}
          GROUP BY p."checkId"
        ), check_totals AS (
          SELECT c."orderId",
            COUNT(*) FILTER (WHERE c."settledAt" IS NOT NULL AND c."cancelledAt" IS NULL)::bigint AS "settledCount",
            COUNT(*) FILTER (WHERE c."settledAt" IS NULL AND c."cancelledAt" IS NULL)::bigint AS "unsettledCount",
            SUM(GREATEST(TRUNC(c."amount" * 100)::bigint - COALESCE(TRUNC(p."paid" * 100)::bigint, 0), 0))
              FILTER (WHERE c."cancelledAt" IS NULL)::bigint AS "outstandingCents"
          FROM "pos_order_checks" c
          JOIN scoped_orders o ON o."id" = c."orderId"
          LEFT JOIN check_paid p ON p."checkId" = c."id"
          WHERE c."merchantId" = ${merchantId}
          GROUP BY c."orderId"
        )
        SELECT
          COUNT(*)::bigint AS "placedCount",
          COUNT(*) FILTER (WHERE o."cancelledAt" IS NOT NULL OR o."status" = 'cancelled')::bigint AS "cancelledCount",
          COUNT(*) FILTER (WHERE o."acceptedAt" IS NOT NULL AND o."cancelledAt" IS NULL
            AND o."status" <> 'cancelled')::bigint AS "acceptedCount",
          COUNT(*) FILTER (WHERE o."completedAt" IS NOT NULL AND o."cancelledAt" IS NULL
            AND o."status" <> 'cancelled')::bigint AS "completedCount",
          COUNT(*) FILTER (
            WHERE COALESCE(c."settledCount", 0) > 0 AND COALESCE(c."unsettledCount", 0) = 0
              AND o."cancelledAt" IS NULL AND o."status" <> 'cancelled'
          )::bigint AS "paidCount",
          COALESCE(SUM(c."settledCount"), 0)::bigint AS "settledCheckCount",
          COALESCE(TRUNC(SUM(o."total") FILTER (
            WHERE o."cancelledAt" IS NULL AND o."status" <> 'cancelled'
          ) * 100), 0)::text AS "orderValueCents",
          COALESCE(SUM(c."outstandingCents") FILTER (
            WHERE o."cancelledAt" IS NULL AND o."status" <> 'cancelled'
          ), 0)::text AS "outstandingCents",
          ROUND(AVG(EXTRACT(EPOCH FROM (o."preparationStartedAt" - o."acceptedAt")))
            FILTER (WHERE o."acceptedAt" IS NOT NULL AND o."preparationStartedAt" IS NOT NULL
              AND o."cancelledAt" IS NULL AND o."status" <> 'cancelled'))::bigint
            AS "acceptedToStartSeconds",
          ROUND(AVG(EXTRACT(EPOCH FROM (o."readyAt" - o."preparationStartedAt")))
            FILTER (WHERE o."preparationStartedAt" IS NOT NULL AND o."readyAt" IS NOT NULL
              AND o."cancelledAt" IS NULL AND o."status" <> 'cancelled'))::bigint
            AS "startToReadySeconds"
        FROM scoped_orders o
        LEFT JOIN check_totals c ON c."orderId" = o."id"
      `,
      this.prisma.$queryRaw<TenderTotalsRow[]>`
        SELECT
          COALESCE(TRUNC(SUM(p."amount") FILTER (WHERE p."cashCustody" = 'courier') * 100), 0)::text AS "courierCashCents",
          (SELECT COALESCE(TRUNC(SUM(r."amount") * 100), 0)::text FROM "pos_delivery_remittances" r
            WHERE r."merchantId" = ${merchantId}::uuid AND r."createdAt" >= ${from} AND r."createdAt" < ${to}
            AND (${query.branchId ?? null}::uuid IS NULL OR r."branchId" = ${query.branchId ?? null}::uuid)) AS "deliveryDrawerCents",
          COALESCE(TRUNC(SUM(p."amount") FILTER (WHERE p."method" = 'cash') * 100), 0)::text AS "cashCents",
          COALESCE(TRUNC(SUM(p."amount") FILTER (WHERE p."method" = 'terminal') * 100), 0)::text AS "terminalCents"
        FROM "pos_order_payments" p
        JOIN "storefront_orders" o ON o."id" = p."orderId" AND o."merchantId" = p."merchantId"
        WHERE p."merchantId" = ${merchantId}
          AND o."source" = 'pos'
          AND p."createdAt" >= ${from}
          AND p."createdAt" < ${to}
          AND (${query.branchId ?? null}::uuid IS NULL OR o."branchId" = ${query.branchId ?? null}::uuid)
      `,
      this.prisma.$queryRaw<TenderTotalsRow[]>`
        SELECT
          COALESCE(TRUNC(SUM(t."amount") FILTER (WHERE t."method" = 'cash') * 100), 0)::text AS "cashCents",
          COALESCE(TRUNC(SUM(t."amount") FILTER (WHERE t."method" = 'terminal') * 100), 0)::text AS "terminalCents"
        FROM "pos_order_refund_tenders" t
        JOIN "pos_order_refunds" r ON r."id" = t."refundId" AND r."merchantId" = t."merchantId"
        JOIN "storefront_orders" o ON o."id" = r."orderId" AND o."merchantId" = r."merchantId"
        WHERE t."merchantId" = ${merchantId}
          AND o."source" = 'pos'
          AND t."createdAt" >= ${from}
          AND t."createdAt" < ${to}
          AND (${query.branchId ?? null}::uuid IS NULL OR o."branchId" = ${query.branchId ?? null}::uuid)
      `,
      this.prisma.$queryRaw<CashierActivityRow[]>`
        WITH order_activity AS (
          SELECT o."createdByPosEmployeeId" AS "employeeId",
            COUNT(*)::bigint AS "ordersOpened",
            COUNT(*) FILTER (WHERE o."cancelledAt" IS NOT NULL OR o."status" = 'cancelled')::bigint AS "cancelledOrders",
            COALESCE(TRUNC(SUM(o."total") FILTER (
              WHERE o."cancelledAt" IS NULL AND o."status" <> 'cancelled'
            ) * 100), 0)::text AS "orderValueCents"
          FROM "storefront_orders" o
          WHERE o."merchantId" = ${merchantId}
            AND o."source" = 'pos'
            AND o."createdAt" >= ${from}
            AND o."createdAt" < ${to}
            AND (${query.branchId ?? null}::uuid IS NULL OR o."branchId" = ${query.branchId ?? null}::uuid)
          GROUP BY o."createdByPosEmployeeId"
        ), collection_activity AS (
          SELECT p."operatorEmployeeId" AS "employeeId",
            COUNT(*)::bigint AS "paymentCount",
            COALESCE(TRUNC(SUM(p."amount") FILTER (WHERE p."method" = 'cash') * 100), 0)::text AS "cashCollectedCents",
            COALESCE(TRUNC(SUM(p."amount") FILTER (WHERE p."method" = 'terminal') * 100), 0)::text AS "terminalCollectedCents"
          FROM "pos_order_payments" p
          JOIN "storefront_orders" o ON o."id" = p."orderId" AND o."merchantId" = p."merchantId"
          WHERE p."merchantId" = ${merchantId}
            AND o."source" = 'pos'
            AND p."createdAt" >= ${from}
            AND p."createdAt" < ${to}
            AND (${query.branchId ?? null}::uuid IS NULL OR o."branchId" = ${query.branchId ?? null}::uuid)
          GROUP BY p."operatorEmployeeId"
        ), refund_activity AS (
          SELECT r."createdByEmployeeId" AS "employeeId",
            COUNT(DISTINCT r."id")::bigint AS "refundCount",
            COALESCE(TRUNC(SUM(t."amount") FILTER (WHERE t."method" = 'cash') * 100), 0)::text AS "cashRefundedCents",
            COALESCE(TRUNC(SUM(t."amount") FILTER (WHERE t."method" = 'terminal') * 100), 0)::text AS "terminalRefundedCents"
          FROM "pos_order_refunds" r
          JOIN "pos_order_refund_tenders" t ON t."refundId" = r."id" AND t."merchantId" = r."merchantId"
          JOIN "storefront_orders" o ON o."id" = r."orderId" AND o."merchantId" = r."merchantId"
          WHERE r."merchantId" = ${merchantId}
            AND o."source" = 'pos'
            AND t."createdAt" >= ${from}
            AND t."createdAt" < ${to}
            AND (${query.branchId ?? null}::uuid IS NULL OR o."branchId" = ${query.branchId ?? null}::uuid)
          GROUP BY r."createdByEmployeeId"
        ), delivery_activity AS (
          SELECT r."operatorEmployeeId" AS "employeeId", TRUNC(SUM(r."amount") * 100)::text AS "receivedCents"
          FROM "pos_delivery_remittances" r WHERE r."merchantId" = ${merchantId}::uuid
            AND r."createdAt" >= ${from} AND r."createdAt" < ${to}
            AND (${query.branchId ?? null}::uuid IS NULL OR r."branchId" = ${query.branchId ?? null}::uuid)
          GROUP BY r."operatorEmployeeId"
        ), activity_employees AS (
          SELECT "employeeId" FROM order_activity
          UNION
          SELECT "employeeId" FROM collection_activity
          UNION
          SELECT "employeeId" FROM refund_activity
          UNION SELECT "employeeId" FROM delivery_activity
        )
        SELECT a."employeeId", e."displayName" AS "employeeName",
          COALESCE(d."receivedCents", '0') AS "deliveryCashReceivedCents",
          COALESCE(s."ordersOpened", 0)::bigint AS "ordersOpened",
          COALESCE(s."cancelledOrders", 0)::bigint AS "cancelledOrders",
          COALESCE(s."orderValueCents", '0') AS "orderValueCents",
          COALESCE(c."paymentCount", 0)::bigint AS "paymentCount",
          COALESCE(c."cashCollectedCents", '0') AS "cashCollectedCents",
          COALESCE(c."terminalCollectedCents", '0') AS "terminalCollectedCents",
          COALESCE(r."refundCount", 0)::bigint AS "refundCount",
          COALESCE(r."cashRefundedCents", '0') AS "cashRefundedCents",
          COALESCE(r."terminalRefundedCents", '0') AS "terminalRefundedCents"
        FROM activity_employees a
        LEFT JOIN "pos_employees" e ON e."id" = a."employeeId" AND e."merchantId" = ${merchantId}
        LEFT JOIN order_activity s ON s."employeeId" IS NOT DISTINCT FROM a."employeeId"
        LEFT JOIN collection_activity c ON c."employeeId" IS NOT DISTINCT FROM a."employeeId"
        LEFT JOIN refund_activity r ON r."employeeId" IS NOT DISTINCT FROM a."employeeId"
        LEFT JOIN delivery_activity d ON d."employeeId" IS NOT DISTINCT FROM a."employeeId"
        ORDER BY e."displayName" NULLS LAST, a."employeeId" NULLS LAST
      `,
    ]);

    const orders = orderRows[0];
    const collections = collectionRows[0];
    const refunds = refundRows[0];
    if (!orders || !collections || !refunds)
      throw new Error('Operations report query returned no totals.');
    const cashCollectedCents = BigInt(collections.cashCents);
    const terminalCollectedCents = BigInt(collections.terminalCents);
    const cashRefundedCents = BigInt(refunds.cashCents);
    const terminalRefundedCents = BigInt(refunds.terminalCents);
    const totalCollectedCents = cashCollectedCents + terminalCollectedCents;
    const totalRefundedCents = cashRefundedCents + terminalRefundedCents;
    this.logger.log(
      JSON.stringify({
        event: 'pos_operations_report.query_metrics',
        queryCount: 4,
        elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
      }),
    );

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      branchId: query.branchId ?? null,
      orders: {
        placedCount: Number(orders.placedCount),
        cancelledCount: Number(orders.cancelledCount),
        acceptedCount: Number(orders.acceptedCount),
        completedCount: Number(orders.completedCount),
        paidCount: Number(orders.paidCount),
        value: formatCents(BigInt(orders.orderValueCents)),
        outstanding: formatCents(BigInt(orders.outstandingCents)),
      },
      checks: { settledCount: Number(orders.settledCheckCount) },
      collections: {
        cash: formatCents(cashCollectedCents),
        terminal: formatCents(terminalCollectedCents),
        total: formatCents(totalCollectedCents),
      },
      refunds: {
        cash: formatCents(cashRefundedCents),
        terminal: formatCents(terminalRefundedCents),
        total: formatCents(totalRefundedCents),
      },
      netCollected: formatCents(totalCollectedCents - totalRefundedCents),
      deliveryCash: {
        customerCollections: formatCents(BigInt(collections.courierCashCents ?? '0')),
        drawerReceipts: formatCents(BigInt(collections.deliveryDrawerCents ?? '0')),
      },
      preparation: {
        acceptedToStartSeconds:
          orders.acceptedToStartSeconds === null ? null : Number(orders.acceptedToStartSeconds),
        startToReadySeconds:
          orders.startToReadySeconds === null ? null : Number(orders.startToReadySeconds),
      },
      cashierActivity: cashierActivityRows.map((row) => {
        const cashCollectedCents = BigInt(row.cashCollectedCents);
        const terminalCollectedCents = BigInt(row.terminalCollectedCents);
        const cashRefundedCents = BigInt(row.cashRefundedCents);
        const terminalRefundedCents = BigInt(row.terminalRefundedCents);
        return {
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          ...(row.deliveryCashReceivedCents !== undefined
            ? { deliveryCashReceived: formatCents(BigInt(row.deliveryCashReceivedCents)) }
            : {}),
          ordersOpened: Number(row.ordersOpened),
          cancelledOrders: Number(row.cancelledOrders),
          orderValue: formatCents(BigInt(row.orderValueCents)),
          paymentCount: Number(row.paymentCount),
          collections: {
            cash: formatCents(cashCollectedCents),
            terminal: formatCents(terminalCollectedCents),
            total: formatCents(cashCollectedCents + terminalCollectedCents),
          },
          refundCount: Number(row.refundCount),
          refunds: {
            cash: formatCents(cashRefundedCents),
            terminal: formatCents(terminalRefundedCents),
            total: formatCents(cashRefundedCents + terminalRefundedCents),
          },
          netCollected: formatCents(
            cashCollectedCents + terminalCollectedCents - cashRefundedCents - terminalRefundedCents,
          ),
        };
      }),
    };
  }
}
