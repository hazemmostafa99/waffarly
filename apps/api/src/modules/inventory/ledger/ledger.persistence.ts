import { ConflictException, NotFoundException } from '@nestjs/common';
import type { StockMovementBatchResult } from '@waffarly/contracts';
import { Prisma } from '@waffarly/database';
import type { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { movementInclude, toBatchResult } from './ledger.mapper.js';
import type { InventoryMovementBatchCommand } from './ledger.rules.js';

export async function lockPostingScope(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  movements: InventoryMovementBatchCommand['movements'],
): Promise<void> {
  const warehouseIds = [...new Set(movements.map((line) => line.warehouseId))].sort();
  const itemIds = [...new Set(movements.map((line) => line.stockItemId))].sort();
  const locations = await transaction.warehouse.findMany({
    where: { merchantId, id: { in: warehouseIds } },
    select: { id: true, branchId: true },
  });
  if (locations.length !== warehouseIds.length)
    throw new NotFoundException('Warehouse was not found.');
  const branchIds = [...new Set(locations.map((location) => location.branchId))].sort();
  const branches = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "branches"
    WHERE "merchantId" = ${merchantId}::uuid AND "id" IN (${Prisma.join(branchIds.map((id) => Prisma.sql`${id}::uuid`))})
      AND "archivedAt" IS NULL ORDER BY "id" FOR SHARE`);
  if (branches.length !== branchIds.length)
    throw new NotFoundException('Active branch was not found.');
  const items = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "stock_items"
    WHERE "merchantId" = ${merchantId}::uuid AND "id" IN (${Prisma.join(itemIds.map((id) => Prisma.sql`${id}::uuid`))})
      AND "archivedAt" IS NULL ORDER BY "id" FOR SHARE`);
  if (items.length !== itemIds.length)
    throw new NotFoundException('Active stock item was not found.');
  const warehouses = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "warehouses"
    WHERE "merchantId" = ${merchantId}::uuid AND "id" IN (${Prisma.join(warehouseIds.map((id) => Prisma.sql`${id}::uuid`))})
      AND "archivedAt" IS NULL ORDER BY "id" FOR SHARE`);
  if (warehouses.length !== warehouseIds.length)
    throw new NotFoundException('Active warehouse was not found.');
}

export async function findExistingBatch(
  client: PrismaService | Prisma.TransactionClient,
  merchantId: string,
  requestId: string,
  sourceType: string,
  sourceId: string,
) {
  return client.stockMovementBatch.findFirst({
    where: {
      merchantId,
      OR: [{ requestId }, { sourceType, sourceId }],
    },
    include: { movements: { include: movementInclude, orderBy: { position: 'asc' } } },
  });
}

export function replayBatch(
  batch: NonNullable<Awaited<ReturnType<typeof findExistingBatch>>>,
  fingerprint: string,
): StockMovementBatchResult {
  if (batch.fingerprint !== fingerprint) {
    throw new ConflictException(
      'This source or request ID was already used with different movement details.',
    );
  }
  return toBatchResult(batch, true);
}
