/**
 * Shows website orders to the owner and the combined order work list for a branch.
 */
import type { CursorPage, StorefrontOrderSummary } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor, type CursorPageQuery } from '../../../common/http/pagination.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { toSummary } from '../mapping/order.mapper.js';
import { posKitchenTicketInclude } from '../kitchen/pos-kitchen.persistence.js';

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
        source: 'storefront',
        branchId,
        status: { in: ['pending', 'accepted', 'preparing', 'ready'] },
      },
      {
        lines: { some: { stockHandling: 'recipe_acceptance' } },
        OR: [
          { status: 'pending', OR: [{ source: 'storefront', branchId: null }, { branchId }] },
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
      (order.source === 'storefront' && order.fulfillmentType === 'pickup' && order.posShiftId)
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
