/** Reads stock movement details and shows the availability of items across warehouses. */
import { NotFoundException } from '@nestjs/common';
import type { InventoryHealthPage, InventoryStockHealth, StockMovement } from '@waffarly/contracts';
import { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { listInventoryHealthSchema, type InventoryHealthListQuery } from '../inventory.schemas.js';

import { movementInclude, toMovement } from '../ledger/ledger.mapper.js';
import { decimalText } from '../ledger/ledger.rules.js';
import { healthInclude } from './threshold.mapper.js';

export async function getMovement(
  prisma: PrismaService,
  merchantId: string,
  id: string,
): Promise<StockMovement> {
  const movement = await prisma.stockMovement.findFirst({
    where: { merchantId, id },
    include: movementInclude,
  });
  if (!movement) throw new NotFoundException('Stock movement was not found.');
  return toMovement(movement);
}

export async function listHealth(
  prisma: PrismaService,
  merchantId: string,
  input: InventoryHealthListQuery,
): Promise<InventoryHealthPage> {
  const query = parseRequest(listInventoryHealthSchema, input);
  const where: Prisma.StockReorderThresholdWhereInput = {
    merchantId,
    stockItem: { archivedAt: null },
    warehouse: { archivedAt: null, branch: { archivedAt: null } },
    ...(query.branchId
      ? {
          warehouse: { branchId: query.branchId, archivedAt: null, branch: { archivedAt: null } },
        }
      : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.stockItemId ? { stockItemId: query.stockItemId } : {}),
    ...(query.search
      ? {
          OR: [
            { stockItem: { name: { contains: query.search, mode: 'insensitive' } } },
            { warehouse: { name: { contains: query.search, mode: 'insensitive' } } },
            { warehouse: { branch: { name: { contains: query.search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
  if (query.cursor) {
    const anchor = await prisma.stockReorderThreshold.findFirst({
      where: { ...where, id: query.cursor },
      select: { id: true },
    });
    assertScopedCursor(query.cursor, anchor !== null);
  }

  const [rows, summary] = await Promise.all([
    prisma.stockReorderThreshold.findMany({
      where,
      include: healthInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
    getHealthSummary(prisma, merchantId, query),
  ]);
  const pageRows = rows.slice(0, query.limit);
  const balances = pageRows.length
    ? await prisma.stockBalance.findMany({
        where: {
          merchantId,
          condition: 'available',
          OR: pageRows.map((row) => ({
            warehouseId: row.warehouseId,
            stockItemId: row.stockItemId,
          })),
        },
        select: { warehouseId: true, stockItemId: true, quantity: true },
      })
    : [];
  const balanceByPair = new Map(
    balances.map((balance) => [`${balance.warehouseId}:${balance.stockItemId}`, balance.quantity]),
  );
  const items: InventoryStockHealth[] = pageRows.map((row) => {
    const available = balanceByPair.get(`${row.warehouseId}:${row.stockItemId}`);
    const availableQuantity = available?.toFixed(6) ?? '0';
    const minimumAvailableQuantity = row.minimumAvailableQuantity.toFixed(6);
    return {
      thresholdId: row.id,
      warehouseId: row.warehouse.id,
      warehouseName: row.warehouse.name,
      branchId: row.warehouse.branchId,
      branchName: row.warehouse.branch.name,
      stockItemId: row.stockItem.id,
      stockItemName: row.stockItem.name,
      baseUnit: row.stockItem.baseUnit as InventoryStockHealth['baseUnit'],
      minimumAvailableQuantity: decimalText(minimumAvailableQuantity),
      availableQuantity: decimalText(availableQuantity),
      state: available?.gt(row.minimumAvailableQuantity) ? 'healthy' : 'low',
      revision: row.revision,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
  return {
    items,
    nextCursor: rows.length > query.limit ? pageRows.at(-1)!.id : null,
    summary,
  };
}

export function getHealthSummary(
  prisma: PrismaService,
  merchantId: string,
  query: InventoryHealthListQuery,
) {
  const filters: Prisma.Sql[] = [
    Prisma.sql`t."merchantId" = ${merchantId}::uuid`,
    Prisma.sql`i."archivedAt" IS NULL`,
    Prisma.sql`w."archivedAt" IS NULL`,
    Prisma.sql`b."archivedAt" IS NULL`,
  ];
  if (query.branchId) filters.push(Prisma.sql`w."branchId" = ${query.branchId}::uuid`);
  if (query.warehouseId) filters.push(Prisma.sql`t."warehouseId" = ${query.warehouseId}::uuid`);
  if (query.stockItemId) filters.push(Prisma.sql`t."stockItemId" = ${query.stockItemId}::uuid`);
  if (query.search) {
    const search = `%${query.search}%`;
    filters.push(
      Prisma.sql`(i."name" ILIKE ${search} OR w."name" ILIKE ${search} OR b."name" ILIKE ${search})`,
    );
  }
  return prisma
    .$queryRaw<
      Array<{
        configuredItemLocations: number;
        lowStockItemLocations: number;
        healthyItemLocations: number;
      }>
    >(
      Prisma.sql`
        SELECT COUNT(*)::int AS "configuredItemLocations",
          COUNT(*) FILTER (WHERE COALESCE(sb."quantity", 0) <= t."minimumAvailableQuantity")::int AS "lowStockItemLocations",
          COUNT(*) FILTER (WHERE COALESCE(sb."quantity", 0) > t."minimumAvailableQuantity")::int AS "healthyItemLocations"
        FROM "stock_reorder_thresholds" t
        JOIN "stock_items" i ON i."id" = t."stockItemId" AND i."merchantId" = t."merchantId"
        JOIN "warehouses" w ON w."id" = t."warehouseId" AND w."merchantId" = t."merchantId"
        JOIN "branches" b ON b."id" = w."branchId" AND b."merchantId" = w."merchantId"
        LEFT JOIN "stock_balances" sb ON sb."merchantId" = t."merchantId"
          AND sb."warehouseId" = t."warehouseId" AND sb."stockItemId" = t."stockItemId"
          AND sb."condition" = 'available'
        WHERE ${Prisma.join(filters, ' AND ')}
      `,
    )
    .then((rows) => ({
      configuredItemLocations: Number(rows[0]?.configuredItemLocations ?? 0),
      lowStockItemLocations: Number(rows[0]?.lowStockItemLocations ?? 0),
      healthyItemLocations: Number(rows[0]?.healthyItemLocations ?? 0),
    }));
}
