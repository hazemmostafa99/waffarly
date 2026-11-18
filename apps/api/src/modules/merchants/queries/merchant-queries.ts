/** Lists merchants with their owner and subscription status. */
import type { MerchantSummary, CursorPage } from '@waffarly/contracts';

import { assertScopedCursor, type CursorPageQuery } from '../../../common/http/pagination.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { toMerchantSummary } from '../merchant-record.mapper.js';

export async function listMerchants(
  prisma: PrismaService,
  page: CursorPageQuery = { limit: 50 },
): Promise<CursorPage<MerchantSummary>> {
  if (page.cursor) {
    const anchor = await prisma.merchant.findUnique({
      where: { id: page.cursor },
      select: { id: true },
    });
    assertScopedCursor(page.cursor, anchor !== null);
  }
  const merchants = await prisma.merchant.findMany({
    include: {
      owner: { select: { username: true } },
      subscription: {
        select: {
          status: true,
          periods: {
            where: { startsAt: { lte: new Date() }, coverageEndsAt: { gt: new Date() } },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
    ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
  });
  const hasMore = merchants.length > page.limit;
  const items = merchants.slice(0, page.limit).map(toMerchantSummary);
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}
