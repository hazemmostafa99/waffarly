/** Reports saved product revenue and consumption, respecting cancellation and stock restoration. */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OwnerProductProfitabilityReport, OwnerProfitabilityDimensionRow } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { formatCents } from '../../common/money/money.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

export type ProductProfitabilityQuery = {
  from: string;
  to: string;
  branchId?: string;
  limit: number;
};

type ProductMetricRow = {
  productId: string;
  productName: string;
  quantitySold: bigint;
  quantityRefunded: bigint;
  revenueCents: string;
  refundCents: string;
  costCents: string;
  salesLines: bigint;
  unknownCostLines: bigint;
};

type TotalsRow = Omit<ProductMetricRow, 'productId' | 'productName'> & {
  unallocatedRefundCents: string;
  unallocatedRefundCount: bigint;
};

type DimensionMetricRow = {
  dimensionType: 'menu' | 'branch';
  dimensionId: string;
  dimensionName: string;
  quantitySold: bigint;
  quantityRefunded: bigint;
  revenueCents: string;
  refundCents: string;
  costCents: string;
  salesLines: bigint;
  unknownCostLines: bigint;
};

@Injectable()
export class ProductProfitabilityReportService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(
    merchantId: string, query: ProductProfitabilityQuery,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<OwnerProductProfitabilityReport> {
    if (query.branchId) {
      const branch = await db.branch.findFirst({
        where: { id: query.branchId, merchantId },
        select: { id: true },
      });
      if (!branch) throw new NotFoundException('Branch was not found.');
    }
    const branchId = query.branchId ?? null;
    const rows = await db.$queryRaw<ProductMetricRow[]>`
      WITH sales AS (
        SELECT l."productId", MAX(l."productName") AS "productName",
          SUM(l."quantity")::bigint AS "quantitySold",
          COUNT(*)::bigint AS "salesLines",
          COUNT(*) FILTER (WHERE l."costSnapshotTotal" IS NULL)::bigint AS "unknownCostLines",
          COALESCE(SUM(l."recognizedRevenueAmount"), 0) AS revenue
        FROM "storefront_order_lines" l
        JOIN "storefront_orders" o ON o."id" = l."orderId" AND o."merchantId" = l."merchantId"
        WHERE l."merchantId" = ${merchantId}::uuid
          AND o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected')
          AND l."revenueRecognizedAt" >= (${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
          AND l."revenueRecognizedAt" < ((${query.to}::date + 1)::timestamp AT TIME ZONE 'Africa/Cairo')
          AND (${branchId}::uuid IS NULL OR o."branchId" = ${branchId}::uuid)
        GROUP BY l."productId"
      ), refunds AS (
        SELECT l."productId", SUM(r."quantity")::bigint AS "quantityRefunded",
          COALESCE(SUM(r."revenueReversalAmount"), 0) AS amount
        FROM "pos_order_refund_lines" r
        JOIN "pos_order_refunds" f ON f."id" = r."refundId" AND f."merchantId" = r."merchantId"
        JOIN "storefront_order_lines" l ON l."id" = r."orderLineId" AND l."merchantId" = r."merchantId"
        JOIN "storefront_orders" o ON o."id" = r."orderId" AND o."merchantId" = r."merchantId"
        WHERE r."merchantId" = ${merchantId}::uuid
          AND f."issuedAt" >= (${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
          AND f."issuedAt" < ((${query.to}::date + 1)::timestamp AT TIME ZONE 'Africa/Cairo')
          AND (${branchId}::uuid IS NULL OR o."branchId" = ${branchId}::uuid)
        GROUP BY l."productId"
      ), costs AS (
        SELECT l."productId", COALESCE(SUM(l."costSnapshotTotal"), 0) AS amount
        FROM "storefront_order_lines" l
        JOIN "storefront_orders" o ON o."id" = l."orderId" AND o."merchantId" = l."merchantId"
        WHERE l."merchantId" = ${merchantId}::uuid
          AND ((o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected')) OR o."stockRestored"=false)
          AND l."costSnapshotAt" >= (${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
          AND l."costSnapshotAt" < ((${query.to}::date + 1)::timestamp AT TIME ZONE 'Africa/Cairo')
          AND (${branchId}::uuid IS NULL OR o."branchId" = ${branchId}::uuid)
        GROUP BY l."productId"
      ), keys AS (
        SELECT "productId" FROM sales UNION SELECT "productId" FROM refunds UNION SELECT "productId" FROM costs
      )
      SELECT k."productId", COALESCE(s."productName", p."name", 'Deleted product') AS "productName",
        COALESCE(s."quantitySold", 0)::bigint AS "quantitySold",
        COALESCE(r."quantityRefunded", 0)::bigint AS "quantityRefunded",
        TRUNC(COALESCE(s.revenue, 0) * 100)::text AS "revenueCents",
        TRUNC(COALESCE(r.amount, 0) * 100)::text AS "refundCents",
        TRUNC(COALESCE(c.amount, 0) * 100)::text AS "costCents",
        COALESCE(s."salesLines", 0)::bigint AS "salesLines",
        COALESCE(s."unknownCostLines", 0)::bigint AS "unknownCostLines"
      FROM keys k
      LEFT JOIN sales s ON s."productId" = k."productId"
      LEFT JOIN refunds r ON r."productId" = k."productId"
      LEFT JOIN costs c ON c."productId" = k."productId"
      LEFT JOIN "products" p ON p."id" = k."productId" AND p."merchantId" = ${merchantId}::uuid
      ORDER BY (COALESCE(s."unknownCostLines", 0) > 0) ASC,
        CASE WHEN COALESCE(s."unknownCostLines", 0) = 0
          THEN COALESCE(s.revenue, 0) - COALESCE(r.amount, 0) - COALESCE(c.amount, 0)
        END DESC,
        COALESCE(s.revenue, 0) - COALESCE(r.amount, 0) - COALESCE(c.amount, 0) DESC,
        "productName" ASC
      LIMIT ${query.limit}`;

    const totals = await db.$queryRaw<TotalsRow[]>`
      WITH event_totals AS (
        SELECT
          COALESCE((SELECT SUM(l."quantity") FROM "storefront_order_lines" l
            JOIN "storefront_orders" o ON o."id"=l."orderId" AND o."merchantId"=l."merchantId"
            WHERE l."merchantId"=${merchantId}::uuid
              AND o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected')
              AND l."revenueRecognizedAt">=(${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
              AND l."revenueRecognizedAt"< ((${query.to}::date+1)::timestamp AT TIME ZONE 'Africa/Cairo')
              AND (${branchId}::uuid IS NULL OR o."branchId"=${branchId}::uuid)), 0)::bigint AS "quantitySold",
          COALESCE((SELECT COUNT(*) FROM "storefront_order_lines" l
            JOIN "storefront_orders" o ON o."id"=l."orderId" AND o."merchantId"=l."merchantId"
            WHERE l."merchantId"=${merchantId}::uuid
              AND o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected')
              AND l."revenueRecognizedAt">=(${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
              AND l."revenueRecognizedAt"< ((${query.to}::date+1)::timestamp AT TIME ZONE 'Africa/Cairo')
              AND (${branchId}::uuid IS NULL OR o."branchId"=${branchId}::uuid)), 0)::bigint AS "salesLines",
          COALESCE((SELECT COUNT(*) FROM "storefront_order_lines" l
            JOIN "storefront_orders" o ON o."id"=l."orderId" AND o."merchantId"=l."merchantId"
            WHERE l."merchantId"=${merchantId}::uuid
              AND o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected') AND l."costSnapshotTotal" IS NULL
              AND l."revenueRecognizedAt">=(${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
              AND l."revenueRecognizedAt"< ((${query.to}::date+1)::timestamp AT TIME ZONE 'Africa/Cairo')
              AND (${branchId}::uuid IS NULL OR o."branchId"=${branchId}::uuid)), 0)::bigint AS "unknownCostLines",
          COALESCE((SELECT SUM(l."recognizedRevenueAmount") FROM "storefront_order_lines" l
            JOIN "storefront_orders" o ON o."id"=l."orderId" AND o."merchantId"=l."merchantId"
            WHERE l."merchantId"=${merchantId}::uuid
              AND o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected')
              AND l."revenueRecognizedAt">=(${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
              AND l."revenueRecognizedAt"< ((${query.to}::date+1)::timestamp AT TIME ZONE 'Africa/Cairo')
              AND (${branchId}::uuid IS NULL OR o."branchId"=${branchId}::uuid)), 0) AS revenue,
          COALESCE((SELECT SUM(l."costSnapshotTotal") FROM "storefront_order_lines" l
            JOIN "storefront_orders" o ON o."id"=l."orderId" AND o."merchantId"=l."merchantId"
            WHERE l."merchantId"=${merchantId}::uuid
              AND ((o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected')) OR o."stockRestored"=false)
              AND l."costSnapshotAt">=(${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
              AND l."costSnapshotAt"< ((${query.to}::date+1)::timestamp AT TIME ZONE 'Africa/Cairo')
              AND (${branchId}::uuid IS NULL OR o."branchId"=${branchId}::uuid)), 0) AS cost,
          COALESCE((SELECT SUM(r."quantity") FROM "pos_order_refund_lines" r
            JOIN "pos_order_refunds" f ON f."id"=r."refundId" AND f."merchantId"=r."merchantId"
            JOIN "storefront_orders" o ON o."id"=r."orderId" AND o."merchantId"=r."merchantId"
            WHERE r."merchantId"=${merchantId}::uuid
              AND f."issuedAt">=(${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
              AND f."issuedAt"< ((${query.to}::date+1)::timestamp AT TIME ZONE 'Africa/Cairo')
              AND (${branchId}::uuid IS NULL OR o."branchId"=${branchId}::uuid)), 0)::bigint AS "quantityRefunded",
          COALESCE((SELECT SUM(r."revenueReversalAmount") FROM "pos_order_refund_lines" r
            JOIN "pos_order_refunds" f ON f."id"=r."refundId" AND f."merchantId"=r."merchantId"
            JOIN "storefront_orders" o ON o."id"=r."orderId" AND o."merchantId"=r."merchantId"
            WHERE r."merchantId"=${merchantId}::uuid
              AND f."issuedAt">=(${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
              AND f."issuedAt"< ((${query.to}::date+1)::timestamp AT TIME ZONE 'Africa/Cairo')
              AND (${branchId}::uuid IS NULL OR o."branchId"=${branchId}::uuid)), 0) AS refunds
      )
      SELECT "quantitySold", "quantityRefunded", "salesLines", "unknownCostLines",
        TRUNC(revenue*100)::text AS "revenueCents", TRUNC(refunds*100)::text AS "refundCents",
        TRUNC(cost*100)::text AS "costCents",
        COALESCE((SELECT TRUNC(SUM(r."amount")*100)::text FROM "pos_order_refunds" r
          JOIN "storefront_orders" o ON o."id"=r."orderId" AND o."merchantId"=r."merchantId"
          WHERE r."merchantId"=${merchantId}::uuid
            AND r."issuedAt">=(${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
            AND r."issuedAt"< ((${query.to}::date+1)::timestamp AT TIME ZONE 'Africa/Cairo')
            AND (${branchId}::uuid IS NULL OR o."branchId"=${branchId}::uuid)
            AND NOT EXISTS (SELECT 1 FROM "pos_order_refund_lines" rl WHERE rl."refundId"=r."id" AND rl."merchantId"=r."merchantId")), '0') AS "unallocatedRefundCents",
        COALESCE((SELECT COUNT(*) FROM "pos_order_refunds" r
          JOIN "storefront_orders" o ON o."id"=r."orderId" AND o."merchantId"=r."merchantId"
          WHERE r."merchantId"=${merchantId}::uuid
            AND r."issuedAt">=(${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
            AND r."issuedAt"< ((${query.to}::date+1)::timestamp AT TIME ZONE 'Africa/Cairo')
            AND (${branchId}::uuid IS NULL OR o."branchId"=${branchId}::uuid)
            AND NOT EXISTS (SELECT 1 FROM "pos_order_refund_lines" rl WHERE rl."refundId"=r."id" AND rl."merchantId"=r."merchantId")), 0)::bigint AS "unallocatedRefundCount"
      FROM event_totals`;

    const summary = totals[0]!;
    const dimensions = await db.$queryRaw<DimensionMetricRow[]>`
      WITH base_lines AS (
        SELECT l."id" AS "lineId", l."menuSectionIdAtSale", l."menuSectionNameAtSale",
          o."branchId", o."branchName", l."quantity",
          CASE WHEN o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected') THEN l."recognizedRevenueAmount" END AS "recognizedRevenueAmount",
          CASE WHEN o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected') THEN l."revenueRecognizedAt" END AS "revenueRecognizedAt",
          CASE WHEN (o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected')) OR o."stockRestored"=false THEN l."costSnapshotTotal" END AS "costSnapshotTotal",
          CASE WHEN (o."cancelledAt" IS NULL AND o."status" NOT IN ('cancelled','rejected')) OR o."stockRestored"=false THEN l."costSnapshotAt" END AS "costSnapshotAt"
        FROM "storefront_order_lines" l
        JOIN "storefront_orders" o ON o."id"=l."orderId" AND o."merchantId"=l."merchantId"
        WHERE l."merchantId"=${merchantId}::uuid
          AND (${branchId}::uuid IS NULL OR o."branchId"=${branchId}::uuid)
      ), dimension_lines AS (
        SELECT "lineId", 'menu'::text AS "dimensionType",
          COALESCE("menuSectionIdAtSale"::text, 'unassigned') AS "dimensionId",
          COALESCE("menuSectionNameAtSale", 'Unassigned') AS "dimensionName",
          "quantity", "recognizedRevenueAmount", "revenueRecognizedAt", "costSnapshotTotal", "costSnapshotAt"
        FROM base_lines
        UNION ALL
        SELECT "lineId", 'branch'::text AS "dimensionType",
          COALESCE("branchId"::text, 'unassigned') AS "dimensionId",
          COALESCE("branchName", 'Unassigned') AS "dimensionName",
          "quantity", "recognizedRevenueAmount", "revenueRecognizedAt", "costSnapshotTotal", "costSnapshotAt"
        FROM base_lines
      ), sales AS (
        SELECT "dimensionType", "dimensionId", "dimensionName",
          SUM("quantity")::bigint AS "quantitySold", COUNT(*)::bigint AS "salesLines",
          COUNT(*) FILTER (WHERE "costSnapshotTotal" IS NULL)::bigint AS "unknownCostLines",
          COALESCE(SUM("recognizedRevenueAmount"), 0) AS amount
        FROM dimension_lines
        WHERE "revenueRecognizedAt">=(${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
          AND "revenueRecognizedAt"< ((${query.to}::date+1)::timestamp AT TIME ZONE 'Africa/Cairo')
        GROUP BY "dimensionType", "dimensionId", "dimensionName"
      ), refunds AS (
        SELECT d."dimensionType", d."dimensionId", d."dimensionName",
          SUM(r."quantity")::bigint AS "quantityRefunded", COALESCE(SUM(r."revenueReversalAmount"),0) AS amount
        FROM "pos_order_refund_lines" r
        JOIN "pos_order_refunds" f ON f."id"=r."refundId" AND f."merchantId"=r."merchantId"
        JOIN dimension_lines d ON d."lineId"=r."orderLineId"
        WHERE r."merchantId"=${merchantId}::uuid
          AND f."issuedAt">=(${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
          AND f."issuedAt"< ((${query.to}::date+1)::timestamp AT TIME ZONE 'Africa/Cairo')
        GROUP BY d."dimensionType", d."dimensionId", d."dimensionName"
      ), costs AS (
        SELECT "dimensionType", "dimensionId", "dimensionName", COALESCE(SUM("costSnapshotTotal"),0) AS amount
        FROM dimension_lines
        WHERE "costSnapshotAt">=(${query.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')
          AND "costSnapshotAt"< ((${query.to}::date+1)::timestamp AT TIME ZONE 'Africa/Cairo')
        GROUP BY "dimensionType", "dimensionId", "dimensionName"
      ), keys AS (
        SELECT "dimensionType", "dimensionId", "dimensionName" FROM sales
        UNION SELECT "dimensionType", "dimensionId", "dimensionName" FROM refunds
        UNION SELECT "dimensionType", "dimensionId", "dimensionName" FROM costs
      ), ranked AS (
        SELECT k."dimensionType", k."dimensionId", k."dimensionName",
          COALESCE(s."quantitySold",0)::bigint AS "quantitySold",
          COALESCE(r."quantityRefunded",0)::bigint AS "quantityRefunded",
          TRUNC(COALESCE(s.amount,0)*100)::text AS "revenueCents",
          TRUNC(COALESCE(r.amount,0)*100)::text AS "refundCents",
          TRUNC(COALESCE(c.amount,0)*100)::text AS "costCents",
          COALESCE(s."salesLines",0)::bigint AS "salesLines",
          COALESCE(s."unknownCostLines",0)::bigint AS "unknownCostLines",
          ROW_NUMBER() OVER (PARTITION BY k."dimensionType"
            ORDER BY (COALESCE(s."unknownCostLines",0)>0) ASC,
              CASE WHEN COALESCE(s."unknownCostLines",0)=0
                THEN COALESCE(s.amount,0)-COALESCE(r.amount,0)-COALESCE(c.amount,0)
              END DESC,
              (COALESCE(s.amount,0)-COALESCE(r.amount,0)-COALESCE(c.amount,0)) DESC,
              k."dimensionName") AS rank
        FROM keys k LEFT JOIN sales s USING ("dimensionType","dimensionId","dimensionName")
        LEFT JOIN refunds r USING ("dimensionType","dimensionId","dimensionName")
        LEFT JOIN costs c USING ("dimensionType","dimensionId","dimensionName")
      )
      SELECT "dimensionType", "dimensionId", "dimensionName", "quantitySold", "quantityRefunded",
        "revenueCents", "refundCents", "costCents", "salesLines", "unknownCostLines"
      FROM ranked WHERE rank<=${query.limit}
      ORDER BY "dimensionType", ("unknownCostLines">0) ASC,
        CASE WHEN "unknownCostLines"=0
          THEN "revenueCents"::numeric-"refundCents"::numeric-"costCents"::numeric
        END DESC,
        ("revenueCents"::numeric-"refundCents"::numeric-"costCents"::numeric) DESC,
        "dimensionName"`;
    const revenueCents = BigInt(summary.revenueCents);
    const refundCents = BigInt(summary.refundCents);
    const costCents = BigInt(summary.costCents);
    const unallocatedRefundCents = BigInt(summary.unallocatedRefundCents);
    const totalRefundCents = refundCents + unallocatedRefundCents;
    const grossProfitCents = revenueCents - totalRefundCents - costCents;
    const netRevenueCents = revenueCents - totalRefundCents;
    const hasUnknownCosts = Number(summary.unknownCostLines) > 0;
    return {
      from: query.from,
      to: query.to,
      timezone: 'Africa/Cairo',
      branchId,
      generatedAt: new Date().toISOString(),
      totals: {
        quantitySold: Number(summary.quantitySold),
        quantityRefunded: Number(summary.quantityRefunded),
        revenue: formatCents(revenueCents),
        refundRevenue: formatCents(totalRefundCents),
        cost: hasUnknownCosts ? null : formatCents(costCents),
        grossProfit: hasUnknownCosts ? null : formatCents(grossProfitCents),
        marginPercent:
          !hasUnknownCosts && netRevenueCents > 0n
            ? Number((grossProfitCents * 10_000n / netRevenueCents)) / 100
            : null,
        salesLines: Number(summary.salesLines),
        unknownCostLines: Number(summary.unknownCostLines),
        unallocatedRefundAmount: formatCents(unallocatedRefundCents),
        unallocatedRefundCount: Number(summary.unallocatedRefundCount),
      },
      products: rows.map((row) => {
        const revenue = BigInt(row.revenueCents);
        const refund = BigInt(row.refundCents);
        const cost = BigInt(row.costCents);
        const grossProfit = revenue - refund - cost;
        const netRevenue = revenue - refund;
        const rowHasUnknownCosts = row.unknownCostLines > 0;
        return {
          productId: row.productId,
          productName: row.productName,
          quantitySold: Number(row.quantitySold),
          quantityRefunded: Number(row.quantityRefunded),
          revenue: formatCents(revenue),
          refundRevenue: formatCents(refund),
          cost: rowHasUnknownCosts ? null : formatCents(cost),
          grossProfit: rowHasUnknownCosts ? null : formatCents(grossProfit),
          marginPercent:
            !rowHasUnknownCosts && netRevenue > 0n
              ? Number(grossProfit * 10_000n / netRevenue) / 100
              : null,
          salesLines: Number(row.salesLines),
          unknownCostLines: Number(row.unknownCostLines),
        };
      }),
      menuSections: dimensions.filter((row) => row.dimensionType === 'menu').map(toDimensionRow),
      branches: dimensions.filter((row) => row.dimensionType === 'branch').map(toDimensionRow),
      truncated: rows.length === query.limit,
    };
  }
}

function toDimensionRow(row: DimensionMetricRow): OwnerProfitabilityDimensionRow {
  const revenue = BigInt(row.revenueCents);
  const refunds = BigInt(row.refundCents);
  const cost = BigInt(row.costCents);
  const grossProfit = revenue - refunds - cost;
  const netRevenue = revenue - refunds;
  const rowHasUnknownCosts = row.unknownCostLines > 0;
  return {
    dimensionId: row.dimensionId,
    dimensionName: row.dimensionName,
    quantitySold: Number(row.quantitySold),
    quantityRefunded: Number(row.quantityRefunded),
    revenue: formatCents(revenue),
    refundRevenue: formatCents(refunds),
    cost: rowHasUnknownCosts ? null : formatCents(cost),
    grossProfit: rowHasUnknownCosts ? null : formatCents(grossProfit),
    marginPercent:
      !rowHasUnknownCosts && netRevenue > 0n
        ? Number(grossProfit * 10_000n / netRevenue) / 100
        : null,
    salesLines: Number(row.salesLines),
    unknownCostLines: Number(row.unknownCostLines),
  };
}
