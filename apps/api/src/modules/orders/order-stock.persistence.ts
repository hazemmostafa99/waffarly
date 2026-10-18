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

export async function freezeLineStockRequirements(
  tx: Prisma.TransactionClient,
  merchantId: string,
  orderLineId: string,
  requirements: InventoryRequirement[],
) {
  const itemIds = [...new Set(requirements.map((requirement) => requirement.stockItemId))];
  const items = itemIds.length
    ? await tx.stockItem.findMany({
        where: { merchantId, id: { in: itemIds }, archivedAt: null },
        select: { id: true, name: true, baseUnit: true },
      })
    : [];
  if (items.length !== itemIds.length)
    throw new ConflictException('A stock item in the saved order requirement is unavailable.');
  const itemById = new Map(items.map((item) => [item.id, item]));

  await tx.storefrontOrderLine.update({
    where: { id_merchantId: { id: orderLineId, merchantId } },
    data: { stockRequirementsFrozenAt: new Date() },
  });
  if (requirements.length === 0) return;
  await tx.storefrontOrderLineStockRequirement.createMany({
    data: requirements.map((requirement, position) => {
      const item = itemById.get(requirement.stockItemId)!;
      if (item.baseUnit !== requirement.baseUnit)
        throw new ConflictException('A stock item base unit changed while the order was quoted.');
      return {
        orderLineId,
        merchantId,
        stockItemId: item.id,
        stockItemName: item.name,
        baseUnit: requirement.baseUnit,
        quantity: requirement.quantity,
        position,
      };
    }),
  });
}

async function postBatches(
  tx: Prisma.TransactionClient,
  ledger: InventoryLedgerService,
  merchantId: string,
  actor: string,
  orderId: string,
  role: 'consumption' | 'restoration',
  sourceType: string,
  kind: 'recipe_consumption' | 'sale_consumption' | 'recipe_restoration' | 'sale_restoration',
  reason: string,
  movements: InventoryMovementBatchCommand['movements'],
) {
  const last = await tx.storefrontOrderStockBatch.findFirst({
    where: { merchantId, orderId, role },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const firstPosition = (last?.position ?? -1) + 1;
  // Keep the ledger's bounded batch size while posting every chunk in the same order transaction.
  for (let offset = 0; offset < movements.length; offset += 100) {
    const position = firstPosition + offset / 100;
    const result = await ledger.postMovementBatch(tx, merchantId, actor, {
      requestId: randomUUID(),
      sourceType,
      sourceId: `${orderId}:${position}`,
      kind,
      reason,
      movements: movements.slice(offset, offset + 100),
    });
    await tx.storefrontOrderStockBatch.create({
      data: { merchantId, orderId, batchId: result.id, role, position },
    });
  }
}

function toLedgerMovements(
  warehouseId: string,
  requirements: InventoryRequirement[],
  sign: 'debit' | 'credit',
): InventoryMovementBatchCommand['movements'] {
  return requirements.map((requirement) => ({
    warehouseId,
    stockItemId: requirement.stockItemId,
    condition: 'available',
    unitCode: requirement.baseUnit,
    enteredQuantity: requirement.quantity,
    baseDelta: sign === 'debit' ? `-${requirement.quantity}` : requirement.quantity,
  }));
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
    'recipe_order',
    'recipe_consumption',
    `Recipe consumption for order ${orderId}`,
    toLedgerMovements(warehouseId, requirements, 'debit'),
  );
}

export async function consumeDirectOrderRequirements(
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
    'pos_sale',
    'sale_consumption',
    `POS direct-stock sale ${orderId}`,
    toLedgerMovements(warehouseId, requirements, 'debit'),
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
  const grouped = new Map<
    'sale_restoration' | 'recipe_restoration',
    InventoryMovementBatchCommand['movements']
  >();
  for (const source of sources) {
    const kind = source.batch.kind === 'sale_consumption' ? 'sale_restoration' : 'recipe_restoration';
    const movements = source.batch.movements.map((movement) => {
      const delta = movement.baseDelta.toFixed(6);
      if (!delta.startsWith('-') || movement.condition !== 'available')
        throw new ConflictException('Recorded stock consumption cannot be restored safely.');
      const quantity = delta.slice(1);
      return {
        warehouseId: movement.warehouseId,
        stockItemId: movement.stockItemId,
        condition: 'available' as const,
        unitCode: movement.baseUnit,
        enteredQuantity: quantity,
        baseDelta: quantity,
      };
    });
    grouped.set(kind, [...(grouped.get(kind) ?? []), ...movements]);
  }
  for (const [kind, movements] of grouped) {
    await postBatches(
      tx,
      ledger,
      merchantId,
      actor,
      orderId,
      'restoration',
      kind === 'sale_restoration' ? 'pos_sale_cancel' : 'recipe_cancel',
      kind,
      reason,
      movements,
    );
  }
}
