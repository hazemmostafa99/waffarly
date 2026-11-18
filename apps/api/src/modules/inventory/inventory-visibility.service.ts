/** Reports stock health and maintains the reorder thresholds used to highlight shortages. */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ClearInventoryReorderThresholdResult,
  InventoryHealthPage,
  InventoryReorderThreshold,
  StockMovement,
  UpdateInventoryReorderThresholdRequest,
} from '@waffarly/contracts';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  deleteInventoryReorderThresholdSchema,
  updateInventoryReorderThresholdSchema,
  type InventoryHealthListQuery,
} from './inventory.schemas.js';
import { normalizeNonNegativeStockQuantity } from './stock-quantity.js';
import { getMovement, listHealth } from './visibility/stock-health.query.js';
import { toThreshold } from './visibility/threshold.mapper.js';

@Injectable()
export class InventoryVisibilityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMovement(merchantId: string, id: string): Promise<StockMovement> {
    return getMovement(this.prisma, merchantId, id);
  }

  async listHealth(
    merchantId: string,
    input: InventoryHealthListQuery,
  ): Promise<InventoryHealthPage> {
    return listHealth(this.prisma, merchantId, input);
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
}
