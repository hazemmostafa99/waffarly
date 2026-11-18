/** Finds merchant products with the details needed by product management. */
import { NotFoundException } from '@nestjs/common';

import type { CursorPage } from '@waffarly/contracts';
import { assertScopedCursor, type CursorPageQuery } from '../../../../common/http/pagination.js';

import { PrismaService } from '../../../../infrastructure/database/prisma.service.js';

import { productInclude, toProductResponse } from '../product.mapper.js';

export async function listProducts(
  prisma: PrismaService,
  merchantId: string,
  page: CursorPageQuery = { limit: 50 },
): Promise<CursorPage<ReturnType<typeof toProductResponse>>> {
  if (page.cursor) {
    const anchor = await prisma.product.findFirst({
      where: { id: page.cursor, merchantId },
      select: { id: true },
    });
    assertScopedCursor(page.cursor, anchor !== null);
  }
  const products = await prisma.product.findMany({
    where: { merchantId },
    include: productInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
    ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
  });
  const hasMore = products.length > page.limit;
  const items = products.slice(0, page.limit).map(toProductResponse);
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

export async function getProduct(prisma: PrismaService, merchantId: string, id: string) {
  const product = await prisma.product.findFirst({
    where: { id, merchantId },
    include: productInclude,
  });
  if (!product) throw new NotFoundException('Product was not found.');
  return toProductResponse(product);
}
