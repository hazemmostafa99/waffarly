/** Saves and removes the stock levels used to warn that an item needs replenishment. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import type {
  InventoryReorderThreshold,
  ClearInventoryReorderThresholdResult,
  UpdateInventoryReorderThresholdRequest,
} from '@waffarly/contracts';

import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  deleteInventoryReorderThresholdSchema,
  updateInventoryReorderThresholdSchema,
} from '../inventory.schemas.js';
import { normalizeNonNegativeStockQuantity } from '../stock-quantity.js';

import { toThreshold } from './threshold.mapper.js';

export async function saveThreshold(
  prisma: PrismaService,
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
    return await prisma.$transaction(async (transaction) => {
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
          throw new ConflictException('A reorder threshold already exists. Reload before saving.');
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
    const current = await prisma.stockReorderThreshold.findUnique({
      where: { merchantId_warehouseId_stockItemId: { merchantId, warehouseId, stockItemId } },
    });
    if (current?.minimumAvailableQuantity.toFixed(6) === minimumAvailableQuantity)
      return toThreshold(current);
    throw new ConflictException('A reorder threshold changed. Reload before saving.');
  }
}

export async function deleteThreshold(
  prisma: PrismaService,
  merchantId: string,
  warehouseId: string,
  stockItemId: string,
  input: { revision: number },
): Promise<ClearInventoryReorderThresholdResult> {
  const parsed = parseRequest(deleteInventoryReorderThresholdSchema, input);
  const existing = await prisma.stockReorderThreshold.findUnique({
    where: { merchantId_warehouseId_stockItemId: { merchantId, warehouseId, stockItemId } },
    select: { id: true },
  });
  if (!existing) return { cleared: true };
  const removed = await prisma.stockReorderThreshold.deleteMany({
    where: { id: existing.id, merchantId, revision: parsed.revision },
  });
  if (removed.count !== 1) {
    const current = await prisma.stockReorderThreshold.findUnique({
      where: { merchantId_warehouseId_stockItemId: { merchantId, warehouseId, stockItemId } },
      select: { id: true },
    });
    if (current)
      throw new ConflictException('Reorder threshold changed. Reload before clearing it.');
  }
  return { cleared: true };
}
