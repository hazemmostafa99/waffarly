/**
 * Reads the merchant order inbox and combined branch queue for online and POS work.
 */
import type {
  CursorPage,
  StorefrontOrderListItem,
  StorefrontOrderListPage,
  StorefrontOrderListQuery,
  StorefrontOrderListStats,
  StorefrontOrderSource,
  StorefrontOrderSummary,
} from '@waffarly/contracts';
import { Prisma } from '@waffarly/database';
import type { StorefrontOrderStatus } from '@waffarly/contracts';
import { assertScopedCursor, type CursorPageQuery } from '../../../common/http/pagination.js';
import { formatCents, toCents } from '../../../common/money/money.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { toSummary } from '../mapping/order.mapper.js';
import { posKitchenTicketInclude } from '../kitchen/pos-kitchen.persistence.js';

const storefrontStatuses: StorefrontOrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'completed',
  'cancelled',
  'rejected',
];

export async function listOwnerOrderInbox(
  prisma: PrismaService,
  merchantId: string,
  page: StorefrontOrderListQuery = { limit: 25 },
): Promise<StorefrontOrderListPage> {
  const filterSql = ownerOrderSqlWhere(merchantId, page);
  let cursorCreatedAt: Date | null = null;
  if (page.cursor) {
    const anchor = await prisma.$queryRaw<Array<{ createdAt: Date }>>`
      SELECT "createdAt"
      FROM "storefront_orders"
      WHERE "id" = ${page.cursor}::uuid AND ${filterSql}
      LIMIT 1
    `;
    assertScopedCursor(page.cursor, anchor.length > 0);
    cursorCreatedAt = anchor[0]?.createdAt ?? null;
  }

  const pageWhere = Prisma.join(
    [
      filterSql,
      cursorCreatedAt && page.cursor
        ? Prisma.sql`(
            "createdAt" < ${cursorCreatedAt}
            OR ("createdAt" = ${cursorCreatedAt} AND "id" < ${page.cursor}::uuid)
          )`
        : Prisma.sql`TRUE`,
    ],
    ' AND ',
  );
  const [pageRows, statsRows, report] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "storefront_orders"
      WHERE ${pageWhere}
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT ${page.limit + 1}
    `,
    page.includeStats === false
      ? Promise.resolve([])
      : prisma.$queryRaw<
          Array<{
            totalOrders: number;
            uniqueCustomers: number;
            totalOrderValue: string;
            averageOrderValue: string;
            status: StorefrontOrderStatus | null;
            statusCount: number | null;
          }>
        >`
      WITH filtered AS MATERIALIZED (
        SELECT "status", "total", "customerPhone"
        FROM "storefront_orders"
        WHERE ${filterSql}
      ), aggregates AS (
        SELECT
          COUNT(*)::int AS "totalOrders",
          COUNT(DISTINCT "customerPhone")::int AS "uniqueCustomers",
          COALESCE(ROUND(SUM("total"), 2)::text, '0.00') AS "totalOrderValue",
          COALESCE(ROUND(AVG("total"), 2)::text, '0.00') AS "averageOrderValue"
        FROM filtered
      ), status_counts AS (
        SELECT "status", COUNT(*)::int AS "statusCount"
        FROM filtered
        GROUP BY "status"
      )
      SELECT aggregates.*, status_counts."status", status_counts."statusCount"
      FROM aggregates
      LEFT JOIN status_counts ON TRUE
    `,
    page.report ? buildOwnerOrderReport(prisma, filterSql) : Promise.resolve(undefined),
  ]);

  const hasMore = pageRows.length > page.limit;
  const pageOrderIds = pageRows.slice(0, page.limit).map((row) => row.id);
  const [fetchedOrders, lineQuantities] = await Promise.all([
    pageOrderIds.length
      ? prisma.storefrontOrder.findMany({
          where: { merchantId, id: { in: pageOrderIds } },
          include: {
            lines: {
              take: 1,
              orderBy: { position: 'asc' },
              select: { productName: true },
            },
          },
        })
      : Promise.resolve([]),
    pageOrderIds.length
      ? prisma.storefrontOrderLine.groupBy({
          by: ['orderId'],
          where: { merchantId, orderId: { in: pageOrderIds } },
          _sum: { quantity: true },
        })
      : Promise.resolve([]),
  ]);
  const fetchedById = new Map(fetchedOrders.map((order) => [order.id, order] as const));
  const pageOrders = pageOrderIds.flatMap((id) => {
    const order = fetchedById.get(id);
    return order ? [order] : [];
  });
  const itemCounts = new Map(
    lineQuantities.map((line) => [line.orderId, line._sum.quantity ?? 0] as const),
  );
  const items: StorefrontOrderListItem[] = pageOrders.map((order) => ({
    id: order.id,
    status: order.status as StorefrontOrderStatus,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillmentType: order.fulfillmentType as StorefrontOrderSummary['fulfillmentType'],
    deliveryAddress: order.deliveryAddress,
    currency: 'EGP',
    total: formatCents(toCents(order.total.toString())),
    createdAt: order.createdAt.toISOString(),
    source: order.source,
    ...(order.orderReference ? { orderReference: order.orderReference } : {}),
    ...(order.branchOrderNumber != null ? { branchOrderNumber: order.branchOrderNumber } : {}),
    ...(order.subtotal != null && order.deliveryFee != null
      ? {
          subtotal: formatCents(toCents(order.subtotal.toString())),
          deliveryFee: formatCents(toCents(order.deliveryFee.toString())),
        }
      : {}),
    itemCount: itemCounts.get(order.id) ?? 0,
    previewItemName: order.lines[0]?.productName ?? null,
  }));
  const statusCounts = Object.fromEntries(
    storefrontStatuses.map((status) => [status, 0]),
  ) as Record<StorefrontOrderStatus, number>;
  for (const row of statsRows) {
    if (row.status) statusCounts[row.status] = row.statusCount ?? 0;
  }
  const aggregate = statsRows[0];
  const stats: StorefrontOrderListStats = {
    totalOrders: aggregate?.totalOrders ?? 0,
    uniqueCustomers: aggregate?.uniqueCustomers ?? 0,
    totalOrderValue: aggregate?.totalOrderValue ?? '0.00',
    averageOrderValue: aggregate?.averageOrderValue ?? '0.00',
    statusCounts,
    ...(report ? { report } : {}),
  };
  return {
    items,
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    ...(page.includeStats === false ? {} : { stats }),
  };
}

async function buildOwnerOrderReport(
  prisma: PrismaService,
  filterSql: Prisma.Sql,
): Promise<NonNullable<StorefrontOrderListStats['report']>> {
  const [sourceRows, dailyRows, fulfillmentRows, productRows, activeRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{ source: string; orderCount: number; orderValue: string }>
    >`SELECT "source", COUNT(*)::int AS "orderCount",
        COALESCE(ROUND(SUM("total") FILTER (WHERE "status" NOT IN ('cancelled', 'rejected')), 2)::text, '0.00') AS "orderValue"
      FROM "storefront_orders"
      WHERE ${filterSql}
      GROUP BY "source"`,
    prisma.$queryRaw<
      Array<{ date: string; orderCount: number; orderValue: string }>
    >`SELECT to_char("createdAt" AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') AS "date",
        COUNT(*)::int AS "orderCount",
        COALESCE(ROUND(SUM("total") FILTER (WHERE "status" NOT IN ('cancelled', 'rejected')), 2)::text, '0.00') AS "orderValue"
      FROM "storefront_orders"
      WHERE ${filterSql}
      GROUP BY 1
      ORDER BY 1`,
    prisma.$queryRaw<
      Array<{ fulfillmentType: string; orderCount: number }>
    >`SELECT "fulfillmentType", COUNT(*)::int AS "orderCount"
      FROM "storefront_orders"
      WHERE ${filterSql}
      GROUP BY "fulfillmentType"`,
    prisma.$queryRaw<
      Array<{ name: string; quantity: number; value: string }>
    >`WITH filtered_orders AS MATERIALIZED (
        SELECT "id", "merchantId"
        FROM "storefront_orders"
        WHERE ${filterSql}
          AND "status" NOT IN ('cancelled', 'rejected')
      )
      SELECT line."productName" AS "name",
        SUM(line."quantity")::int AS "quantity",
        COALESCE(ROUND(SUM(line."lineTotal"), 2)::text, '0.00') AS "value"
      FROM "storefront_order_lines" AS line
      JOIN filtered_orders AS orders
        ON orders."id" = line."orderId"
        AND orders."merchantId" = line."merchantId"
      GROUP BY line."productName"
      ORDER BY SUM(line."quantity") DESC, SUM(line."lineTotal") DESC
      LIMIT 5`,
    prisma.$queryRaw<
      Array<{ activeOrderCount: number; activeOrderValue: string; activeUniqueCustomers: number }>
    >`SELECT
        COUNT(*) FILTER (WHERE "status" NOT IN ('cancelled', 'rejected'))::int AS "activeOrderCount",
        COALESCE(ROUND(SUM("total") FILTER (WHERE "status" NOT IN ('cancelled', 'rejected')), 2)::text, '0.00') AS "activeOrderValue",
        COUNT(DISTINCT "customerPhone") FILTER (WHERE "status" NOT IN ('cancelled', 'rejected'))::int AS "activeUniqueCustomers"
      FROM "storefront_orders"
      WHERE ${filterSql}`,
  ]);

  const sources: Record<StorefrontOrderSource, { orderCount: number; orderValue: string }> = {
    waffarly: { orderCount: 0, orderValue: '0.00' },
    storefront: { orderCount: 0, orderValue: '0.00' },
    pos: { orderCount: 0, orderValue: '0.00' },
  };
  for (const row of sourceRows) {
    if (row.source === 'waffarly' || row.source === 'storefront' || row.source === 'pos')
      sources[row.source] = { orderCount: row.orderCount, orderValue: row.orderValue };
  }

  const fulfillmentCounts: Record<'pickup' | 'delivery' | 'dine_in' | 'takeaway', number> = {
    pickup: 0,
    delivery: 0,
    dine_in: 0,
    takeaway: 0,
  };
  for (const row of fulfillmentRows) {
    if (
      row.fulfillmentType === 'pickup' ||
      row.fulfillmentType === 'delivery' ||
      row.fulfillmentType === 'dine_in' ||
      row.fulfillmentType === 'takeaway'
    )
      fulfillmentCounts[row.fulfillmentType] = row.orderCount;
  }

  return {
    activeOrderCount: activeRows[0]?.activeOrderCount ?? 0,
    activeOrderValue: activeRows[0]?.activeOrderValue ?? '0.00',
    activeUniqueCustomers: activeRows[0]?.activeUniqueCustomers ?? 0,
    sources,
    dailyTrend: dailyRows,
    fulfillmentCounts,
    topProducts: productRows,
  };
}

export async function listOwnerStorefrontOrders(
  prisma: PrismaService,
  merchantId: string,
  page: CursorPageQuery = { limit: 25 },
): Promise<CursorPage<StorefrontOrderSummary>> {
  const where = { merchantId, source: 'storefront' } satisfies Prisma.StorefrontOrderWhereInput;
  if (page.cursor) {
    const anchor = await prisma.storefrontOrder.findFirst({
      where: { ...where, id: page.cursor },
      select: { id: true },
    });
    assertScopedCursor(page.cursor, anchor !== null);
  }
  const orders = await prisma.storefrontOrder.findMany({
    where,
    include: {
      lines: {
        orderBy: { position: 'asc' },
        include: {
          selections: { orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }] },
          variantAttributes: { orderBy: { position: 'asc' } },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
    ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
  });
  const hasMore = orders.length > page.limit;
  const items = orders.slice(0, page.limit).map(toSummary);
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

export async function getOwnerOrder(
  prisma: PrismaService,
  merchantId: string,
  orderId: string,
): Promise<StorefrontOrderSummary | null> {
  const order = await prisma.storefrontOrder.findFirst({
    where: { id: orderId, merchantId },
    include: {
      diningSession: { select: { table: { select: { code: true } } } },
      lines: {
        orderBy: { position: 'asc' },
        include: {
          selections: { orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }] },
          variantAttributes: { orderBy: { position: 'asc' } },
        },
      },
    },
  });
  return order ? toSummary(order) : null;
}

function ownerOrderSqlWhere(merchantId: string, query: StorefrontOrderListQuery) {
  const clauses = [Prisma.sql`"merchantId" = ${merchantId}::uuid`];
  if (query.source) clauses.push(Prisma.sql`"source" = ${query.source}`);
  if (query.status) clauses.push(Prisma.sql`"status" = ${query.status}`);
  if (query.fulfillment) clauses.push(Prisma.sql`"fulfillmentType" = ${query.fulfillment}`);
  if (query.from)
    clauses.push(Prisma.sql`"createdAt" >= ${cairoDayStart(query.from)}`);
  if (query.to)
    clauses.push(Prisma.sql`"createdAt" < ${cairoDayStart(addCalendarDay(query.to))}`);
  if (query.search) {
    const terms = query.search
      .split(/\s+/)
      .map((term) => term.replace(/^#/, ''))
      .filter(Boolean);
    for (const term of terms) {
      const pattern = `%${term}%`;
      clauses.push(
        Prisma.sql`(
          "id"::text ILIKE ${pattern}
          OR COALESCE("orderReference", '') ILIKE ${pattern}
          OR COALESCE("branchOrderNumber"::text, '') ILIKE ${pattern}
          OR COALESCE("customerName", '') ILIKE ${pattern}
          OR COALESCE("customerPhone", '') ILIKE ${pattern}
          OR COALESCE("deliveryAddress", '') ILIKE ${pattern}
          OR EXISTS (
            SELECT 1 FROM "storefront_order_lines" AS line
            WHERE line."orderId" = "storefront_orders"."id"
              AND line."merchantId" = "storefront_orders"."merchantId"
              AND (
                line."productName" ILIKE ${pattern}
                OR COALESCE(line."variantName", '') ILIKE ${pattern}
                OR EXISTS (
                  SELECT 1 FROM "storefront_order_line_selections" AS selection
                  WHERE selection."orderLineId" = line."id"
                    AND (
                      selection."groupName" ILIKE ${pattern}
                      OR selection."optionName" ILIKE ${pattern}
                    )
                )
              )
            )
        )`,
      );
    }
  }
  return Prisma.join(clauses, ' AND ');
}

function addCalendarDay(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(utcDateFromParts(year!, month! - 1, day! + 1)).toISOString().slice(0, 10);
}

function cairoDayStart(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const target = utcDateFromParts(year!, month! - 1, day!);
  let instant = target;
  const formatter = new Intl.DateTimeFormat('en-GB-u-nu-latn', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const localDateAt = (milliseconds: number) => {
    const parts = formatter.formatToParts(new Date(milliseconds));
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const year = String(value('year')).padStart(4, '0');
    const month = String(value('month')).padStart(2, '0');
    const day = String(value('day')).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(instant));
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const localAsUtc = utcDateTimeFromParts(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second'),
    );
    instant += target - localAsUtc;
  }
  if (localDateAt(instant) !== date) {
    let low = target - 36 * 60 * 60 * 1000;
    let high = target + 36 * 60 * 60 * 1000;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (localDateAt(middle) >= date) high = middle;
      else low = middle;
    }
    instant = high;
  }
  return new Date(instant);
}

function utcDateFromParts(year: number, month: number, day: number) {
  return utcDateTimeFromParts(year, month, day);
}

function utcDateTimeFromParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.valueOf();
}

export async function listBranchOrderQueue(
  prisma: PrismaService,
  merchantId: string,
  branchId: string,
  page: CursorPageQuery = { limit: 25 },
): Promise<CursorPage<StorefrontOrderSummary>> {
  const where: Prisma.StorefrontOrderWhereInput = {
    merchantId,
    delivery: { is: null },
    OR: [
      {
        source: { in: ['waffarly', 'storefront'] },
        branchId,
        status: { in: ['pending', 'accepted', 'preparing', 'ready'] },
      },
      {
        lines: { some: { stockHandling: { in: ['recipe_acceptance', 'direct_acceptance'] } } },
        OR: [
          {
            status: 'pending',
            OR: [{ source: { in: ['waffarly', 'storefront'] }, branchId: null }, { branchId }],
          },
          { status: { in: ['accepted', 'preparing', 'ready'] }, branchId },
        ],
      },
      {
        source: 'pos',
        branchId,
        status: { in: ['pending', 'accepted', 'preparing', 'ready'] },
        kitchenTicket: { isNot: null },
      },
      {
        source: 'pos',
        branchId,
        status: 'cancelled',
        kitchenTicket: { is: { cancellationAcknowledgedAt: null } },
      },
    ],
  };
  if (page.cursor) {
    const anchor = await prisma.storefrontOrder.findFirst({
      where: { ...where, id: page.cursor },
      select: { id: true },
    });
    assertScopedCursor(page.cursor, anchor !== null);
  }
  const orders = await prisma.storefrontOrder.findMany({
    where,
    include: {
      kitchenTicket: posKitchenTicketInclude,
      diningSession: { select: { table: { select: { code: true } } } },
      checks: { select: { settledAt: true } },
      lines: {
        orderBy: { position: 'asc' },
        include: {
          selections: { orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }] },
          variantAttributes: { orderBy: { position: 'asc' } },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
    ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
  });
  const hasMore = orders.length > page.limit;
  const items = orders.slice(0, page.limit).map((order) => {
    const summary = toSummary(order);
    return (order.source === 'pos' && order.kitchenTicket) ||
      (isOnlineOrderSource(order.source) &&
        order.fulfillmentType === 'pickup' &&
        order.posShiftId)
      ? {
          ...summary,
          handoverEligible:
            order.status === 'ready' &&
            order.checks.length > 0 &&
            order.checks.every((check) => check.settledAt !== null),
        }
      : summary;
  });
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

function isOnlineOrderSource(source: string): source is 'waffarly' | 'storefront' {
  return source === 'waffarly' || source === 'storefront';
}
