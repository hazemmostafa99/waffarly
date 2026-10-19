import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  InventoryHealthPage,
  InventoryReorderThreshold,
  InventoryStockHealth,
  ClearInventoryReorderThresholdResult,
  StockMovement,
  UpdateInventoryReorderThresholdRequest,
} from '@waffarly/contracts';
import { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  deleteInventoryReorderThresholdSchema,
  listInventoryHealthSchema,
  updateInventoryReorderThresholdSchema,
  type InventoryHealthListQuery,
} from './inventory.schemas.js';
import { normalizeNonNegativeStockQuantity } from './stock-quantity.js';
import { movementInclude, toMovement } from './ledger/ledger.mapper.js';
import { decimalText } from './ledger/ledger.rules.js';

const healthInclude = {
  warehouse: {
    select: { id: true, name: true, branchId: true, branch: { select: { name: true } } },
  },
  stockItem: { select: { id: true, name: true, baseUnit: true } },
} satisfies Prisma.StockReorderThresholdInclude;

@Injectable()
export class InventoryVisibilityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMovement(merchantId: string, id: string): Promise<StockMovement> {
    const movement = await this.prisma.stockMovement.findFirst({
      where: { merchantId, id },
      include: movementInclude,
    });
    if (!movement) throw new NotFoundException('Stock movement was not found.');
    return toMovement(movement);
  }

  async listHealth(
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
      const anchor = await this.prisma.stockReorderThreshold.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }

    const [rows, summary] = await Promise.all([
      this.prisma.stockReorderThreshold.findMany({
        where,
        include: healthInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.getHealthSummary(merchantId, query),
    ]);
    const pageRows = rows.slice(0, query.limit);
    const balances = pageRows.length
      ? await this.prisma.stockBalance.findMany({
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
      balances.map((balance) => [
        `${balance.warehouseId}:${balance.stockItemId}`,
        balance.quantity,
      ]),
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

  async saveThreshold(
    merchantId: string,
    actor: string,
    warehouseId: string,
    stockItemId: string,
    input: UpdateInventoryReorderThresholdRequest,
  ): Promise<InventoryReorderThreshold> {
    const parsed = parseRequest(updateInventoryReorderThresholdSchema, input);
    const minimumAvailableQuantity = normalizeNonNegativeStockQuantity(
      parsed.minimumAvailableQuantity,
    );
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const warehouse = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT w."id" FROM "warehouses" w
        JOIN "branches" b ON b."id" = w."branchId" AND b."merchantId" = w."merchantId"
        WHERE w."id" = ${warehouseId}::uuid AND w."merchantId" = ${merchantId}::uuid
          AND w."archivedAt" IS NULL AND b."archivedAt" IS NULL
        FOR SHARE OF b, w`;
        if (warehouse.length !== 1) throw new NotFoundException('Active warehouse was not found.');
        const item = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "stock_items"
        WHERE "id" = ${stockItemId}::uuid AND "merchantId" = ${merchantId}::uuid
          AND "archivedAt" IS NULL
        FOR SHARE`;
        if (item.length !== 1) throw new NotFoundException('Active stock item was not found.');

        const existing = await transaction.stockReorderThreshold.findUnique({
          where: { merchantId_warehouseId_stockItemId: { merchantId, warehouseId, stockItemId } },
        });
        if (parsed.revision === null) {
          if (existing) {
            if (existing.minimumAvailableQuantity.toFixed(6) === minimumAvailableQuantity)
              return toThreshold(existing);
            throw new ConflictException(
              'A reorder threshold already exists. Reload before saving.',
            );
          }
          return toThreshold(
            await transaction.stockReorderThreshold.create({
              data: {
                merchantId,
                warehouseId,
                stockItemId,
                minimumAvailableQuantity,
                createdBy: actor,
                updatedBy: actor,
              },
            }),
          );
        }

        if (!existing)
          throw new ConflictException('Reorder threshold changed. Reload before saving.');
        if (existing.revision !== parsed.revision) {
          if (existing.minimumAvailableQuantity.toFixed(6) === minimumAvailableQuantity)
            return toThreshold(existing);
          throw new ConflictException('Reorder threshold changed. Reload before saving.');
        }
        const updated = await transaction.stockReorderThreshold.updateMany({
          where: { id: existing.id, merchantId, revision: parsed.revision },
          data: {
            minimumAvailableQuantity,
            revision: { increment: 1 },
            updatedBy: actor,
          },
        });
        if (updated.count !== 1)
          throw new ConflictException('Reorder threshold changed. Reload before saving.');
        return toThreshold(
          await transaction.stockReorderThreshold.findUniqueOrThrow({
            where: { id_merchantId: { id: existing.id, merchantId } },
          }),
        );
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const current = await this.prisma.stockReorderThreshold.findUnique({
        where: { merchantId_warehouseId_stockItemId: { merchantId, warehouseId, stockItemId } },
      });
      if (current?.minimumAvailableQuantity.toFixed(6) === minimumAvailableQuantity)
        return toThreshold(current);
      throw new ConflictException('A reorder threshold changed. Reload before saving.');
    }
  }

  async deleteThreshold(
    merchantId: string,
    warehouseId: string,
    stockItemId: string,
    input: { revision: number },
  ): Promise<ClearInventoryReorderThresholdResult> {
    const parsed = parseRequest(deleteInventoryReorderThresholdSchema, input);
    const existing = await this.prisma.stockReorderThreshold.findUnique({
      where: { merchantId_warehouseId_stockItemId: { merchantId, warehouseId, stockItemId } },
      select: { id: true },
    });
    if (!existing) return { cleared: true };
    const removed = await this.prisma.stockReorderThreshold.deleteMany({
      where: { id: existing.id, merchantId, revision: parsed.revision },
    });
    if (removed.count !== 1) {
      const current = await this.prisma.stockReorderThreshold.findUnique({
        where: { merchantId_warehouseId_stockItemId: { merchantId, warehouseId, stockItemId } },
        select: { id: true },
      });
      if (current)
        throw new ConflictException('Reorder threshold changed. Reload before clearing it.');
    }
    return { cleared: true };
  }

  private getHealthSummary(merchantId: string, query: InventoryHealthListQuery) {
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
    return this.prisma
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
}

function toThreshold(record: {
  id: string;
  warehouseId: string;
  stockItemId: string;
  minimumAvailableQuantity: { toFixed(decimalPlaces: number): string };
  revision: number;
  updatedAt: Date;
}): InventoryReorderThreshold {
  return {
    id: record.id,
    warehouseId: record.warehouseId,
    stockItemId: record.stockItemId,
    minimumAvailableQuantity: decimalText(record.minimumAvailableQuantity.toFixed(6)),
    revision: record.revision,
    updatedAt: record.updatedAt.toISOString(),
  };
}
