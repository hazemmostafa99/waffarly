import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@waffarly/database';
import { randomUUID } from 'node:crypto';
import { InventoryLedgerService, type InventoryMovementBatchCommand } from '../inventory/index.js';
import type { InventoryRequirement } from '../catalog/index.js';

export async function resolveConsumptionWarehouse(
  tx: Prisma.TransactionClient,
  merchantId: string,
  branchId: string,
) {
  const branchLock = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT "id" FROM "branches" WHERE "id" = ${branchId}::uuid AND "merchantId" = ${merchantId}::uuid AND "archivedAt" IS NULL FOR SHARE`;
  if (branchLock.length !== 1)
    throw new ConflictException('Choose an active branch owned by this merchant.');
  const warehouse = await tx.warehouse.findFirst({
    where: { merchantId, branchId, archivedAt: null, isDefaultConsumption: true },
    include: { branch: { select: { name: true } } },
  });
  if (!warehouse)
    throw new ConflictException('The branch needs an active default consumption warehouse.');
  const lock = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT "id" FROM "warehouses" WHERE "id" = ${warehouse.id}::uuid AND "merchantId" = ${merchantId}::uuid AND "archivedAt" IS NULL FOR SHARE`;
  if (lock.length !== 1)
    throw new ConflictException('The default consumption warehouse is unavailable.');
  return warehouse;
}

async function postBatches(
  tx: Prisma.TransactionClient,
  ledger: InventoryLedgerService,
  merchantId: string,
  actor: string,
  orderId: string,
  role: 'consumption' | 'restoration',
  reason: string,
  movements: InventoryMovementBatchCommand['movements'],
) {
  // Keep the ledger's bounded batch size while posting every chunk in the same order transaction.
  for (let offset = 0; offset < movements.length; offset += 100) {
    const position = offset / 100;
    const result = await ledger.postMovementBatch(tx, merchantId, actor, {
      requestId: randomUUID(),
      sourceType: role === 'consumption' ? 'recipe_order' : 'recipe_cancel',
      sourceId: `${orderId}:${position}`,
      kind: role === 'consumption' ? 'recipe_consumption' : 'recipe_restoration',
      reason,
      movements: movements.slice(offset, offset + 100),
    });
    await tx.storefrontOrderStockBatch.create({
      data: { merchantId, orderId, batchId: result.id, role, position },
    });
  }
}

export async function consumeOrderRequirements(
  tx: Prisma.TransactionClient,
  ledger: InventoryLedgerService,
  merchantId: string,
  actor: string,
  orderId: string,
  warehouseId: string,
  requirements: InventoryRequirement[],
) {
  await postBatches(
    tx,
    ledger,
    merchantId,
    actor,
    orderId,
    'consumption',
    `Recipe consumption for order ${orderId}`,
    requirements.map((requirement) => ({
      warehouseId,
      stockItemId: requirement.stockItemId,
      condition: 'available',
      unitCode: requirement.baseUnit,
      enteredQuantity: requirement.quantity,
      baseDelta: `-${requirement.quantity}`,
    })),
  );
}

export async function restoreOrderConsumption(
  tx: Prisma.TransactionClient,
  ledger: InventoryLedgerService,
  merchantId: string,
  actor: string,
  orderId: string,
  reason: string,
) {
  const sources = await tx.storefrontOrderStockBatch.findMany({
    where: { merchantId, orderId, role: 'consumption' },
    include: { batch: { include: { movements: { orderBy: { position: 'asc' } } } } },
    orderBy: { position: 'asc' },
  });
  const movements = sources.flatMap((source) =>
    source.batch.movements.map((movement) => {
      const delta = movement.baseDelta.toFixed(6);
      if (!delta.startsWith('-') || movement.condition !== 'available')
        throw new ConflictException('Recorded recipe consumption cannot be restored safely.');
      const quantity = delta.slice(1);
      return {
        warehouseId: movement.warehouseId,
        stockItemId: movement.stockItemId,
        condition: 'available' as const,
        unitCode: movement.baseUnit,
        enteredQuantity: quantity,
        baseDelta: quantity,
      };
    }),
  );
  await postBatches(tx, ledger, merchantId, actor, orderId, 'restoration', reason, movements);
}
