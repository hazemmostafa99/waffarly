import type { CursorPage, StockBalance, StockMovement } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import type { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  listStockBalancesSchema,
  listStockMovementsSchema,
  type StockBalanceListQuery,
  type StockMovementListQuery,
} from '../inventory.schemas.js';
import { balanceInclude, movementInclude, toBalance, toMovement } from './ledger.mapper.js';

export async function listBalances(
  prisma: PrismaService,
  merchantId: string,
  input: StockBalanceListQuery,
): Promise<CursorPage<StockBalance>> {
  const query = parseRequest(listStockBalancesSchema, input);
  const where: Prisma.StockBalanceWhereInput = {
    merchantId,
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.stockItemId ? { stockItemId: query.stockItemId } : {}),
    ...(query.condition ? { condition: query.condition } : {}),
    ...(query.branchId ? { warehouse: { branchId: query.branchId } } : {}),
    ...(query.search
      ? {
          OR: [
            { stockItem: { name: { contains: query.search, mode: 'insensitive' } } },
            { warehouse: { name: { contains: query.search, mode: 'insensitive' } } },
            {
              warehouse: {
                branch: { name: { contains: query.search, mode: 'insensitive' } },
              },
            },
          ],
        }
      : {}),
  };
  if (query.cursor) {
    const anchor = await prisma.stockBalance.findFirst({
      where: { ...where, id: query.cursor },
      select: { id: true },
    });
    assertScopedCursor(query.cursor, anchor !== null);
  }
  const rows = await prisma.stockBalance.findMany({
    where,
    include: balanceInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, query.limit).map(toBalance);
  return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
}

export async function listMovements(
  prisma: PrismaService,
  merchantId: string,
  input: StockMovementListQuery,
): Promise<CursorPage<StockMovement>> {
  const query = parseRequest(listStockMovementsSchema, input);
  const where: Prisma.StockMovementWhereInput = {
    merchantId,
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.stockItemId ? { stockItemId: query.stockItemId } : {}),
    ...(query.condition ? { condition: query.condition } : {}),
    ...(query.branchId ? { warehouse: { branchId: query.branchId } } : {}),
    ...(query.kind ? { batch: { kind: query.kind } } : {}),
  };
  if (query.cursor) {
    const anchor = await prisma.stockMovement.findFirst({
      where: { ...where, id: query.cursor },
      select: { id: true },
    });
    assertScopedCursor(query.cursor, anchor !== null);
  }
  const rows = await prisma.stockMovement.findMany({
    where,
    include: movementInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, query.limit).map(toMovement);
  return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
}
