/** Finds merchant stock items and converts entered amounts into their base units. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import type {
  CursorPage,
  StockItem,
  StockItemConversion,
  StockItemConversionRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  convertStockItemSchema,
  listStockItemsSchema,
  type StockItemListQuery,
} from '../inventory.schemas.js';
import { convertToBaseQuantity, normalizeStockQuantity } from '../stock-quantity.js';
import { includeUnits, toItem } from './stock-item.mapper.js';

export async function listStockItems(
  prisma: PrismaService,
  merchantId: string,
  input: StockItemListQuery,
): Promise<CursorPage<StockItem>> {
  const query = parseRequest(listStockItemsSchema, input);
  const where: Prisma.StockItemWhereInput = {
    merchantId,
    ...(query.status === 'all'
      ? {}
      : { archivedAt: query.status === 'active' ? null : { not: null } }),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
  };
  if (query.cursor) {
    const anchor = await prisma.stockItem.findFirst({
      where: { ...where, id: query.cursor },
      select: { id: true },
    });
    assertScopedCursor(query.cursor, anchor !== null);
  }
  const rows = await prisma.stockItem.findMany({
    where,
    include: includeUnits,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, query.limit).map(toItem);
  return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
}

export async function getStockItem(
  prisma: PrismaService,
  merchantId: string,
  id: string,
): Promise<StockItem> {
  const item = await prisma.stockItem.findFirst({
    where: { id, merchantId },
    include: includeUnits,
  });
  if (!item) throw new NotFoundException('Stock item was not found.');
  return toItem(item);
}

export async function convertStockItemQuantity(
  prisma: PrismaService,
  merchantId: string,
  id: string,
  input: StockItemConversionRequest,
): Promise<StockItemConversion> {
  const parsed = parseRequest(convertStockItemSchema, input);
  const item = await getStockItem(prisma, merchantId, id);
  if (item.archivedAt)
    throw new ConflictException('Archived stock items cannot be used for conversion.');
  return {
    itemId: item.id,
    unitCode: parsed.unitCode,
    quantity: normalizeStockQuantity(parsed.quantity),
    baseUnit: item.baseUnit,
    baseQuantity: convertToBaseQuantity(
      parsed.quantity,
      parsed.unitCode,
      item.baseUnit,
      item.units,
    ),
  };
}
