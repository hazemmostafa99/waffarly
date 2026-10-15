import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { StockMovementBatchResult } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { randomUUID } from 'node:crypto';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { convertToBaseQuantity } from '../stock-quantity.js';
import { movementInclude, toBatchResult } from './ledger.mapper.js';
import { findExistingBatch, lockPostingScope, replayBatch } from './ledger.persistence.js';
import {
  absoluteDecimal,
  normalizeSignedDecimal,
  postingSchema,
  type InventoryMovementBatchCommand,
} from './ledger.rules.js';

export async function postPreparedMovementBatch(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  actor: string,
  input: InventoryMovementBatchCommand,
  fingerprint: string,
): Promise<StockMovementBatchResult> {
  const command = parseRequest(postingSchema, input) as InventoryMovementBatchCommand;
  const duplicate = await findExistingBatch(
    transaction,
    merchantId,
    command.requestId,
    command.sourceType,
    command.sourceId,
  );
  if (duplicate) return replayBatch(duplicate, fingerprint);

  await lockPostingScope(transaction, merchantId, command.movements);
  const merchantLock = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "merchants" WHERE "id" = ${merchantId}::uuid FOR SHARE`;
  if (merchantLock.length !== 1) throw new NotFoundException('Merchant was not found.');
  const itemIds = [...new Set(command.movements.map((line) => line.stockItemId))].sort();
  const warehouseIds = [...new Set(command.movements.map((line) => line.warehouseId))].sort();
  const [items, warehouses, merchant] = await Promise.all([
    transaction.stockItem.findMany({
      where: { merchantId, id: { in: itemIds }, archivedAt: null },
      include: { units: true },
    }),
    transaction.warehouse.findMany({
      where: {
        merchantId,
        id: { in: warehouseIds },
        archivedAt: null,
        branch: { archivedAt: null },
      },
      select: { id: true, name: true, branch: { select: { id: true, name: true } } },
    }),
    transaction.merchant.findUnique({
      where: { id: merchantId },
      select: { negativeStockPolicy: true },
    }),
  ]);
  if (!merchant) throw new NotFoundException('Merchant was not found.');
  if (items.length !== itemIds.length)
    throw new NotFoundException('Active stock item was not found.');
  if (warehouses.length !== warehouseIds.length)
    throw new NotFoundException('Active warehouse was not found.');
  const itemById = new Map(items.map((item) => [item.id, item]));
  const warehouseById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

  for (const line of command.movements) {
    const item = itemById.get(line.stockItemId)!;
    const converted = convertToBaseQuantity(
      line.enteredQuantity,
      line.unitCode,
      item.baseUnit as Parameters<typeof convertToBaseQuantity>[2],
      item.units.map((unit) => ({
        code: unit.code,
        name: unit.name,
        baseQuantity: unit.baseQuantity.toFixed(6),
      })),
    );
    if (absoluteDecimal(line.baseDelta) !== converted) {
      throw new BadRequestException('Movement quantity does not match its base-unit delta.');
    }
  }

  const created = await transaction.stockMovementBatch.createMany({
    data: [
      {
        id: randomUUID(),
        merchantId,
        requestId: command.requestId,
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        fingerprint,
        kind: command.kind,
        reason: command.reason,
        createdBy: actor,
      },
    ],
    skipDuplicates: true,
  });
  if (created.count === 0) {
    const existing = await findExistingBatch(
      transaction,
      merchantId,
      command.requestId,
      command.sourceType,
      command.sourceId,
    );
    if (existing) return replayBatch(existing, fingerprint);
    throw new ConflictException('This movement command conflicts with an existing source.');
  }
  const batch = await transaction.stockMovementBatch.findUniqueOrThrow({
    where: { merchantId_requestId: { merchantId, requestId: command.requestId } },
    select: { id: true },
  });

  await transaction.stockMovement.createMany({
    data: command.movements.map((line, position) => ({
      merchantId,
      batchId: batch.id,
      warehouseId: line.warehouseId,
      stockItemId: line.stockItemId,
      warehouseName: warehouseById.get(line.warehouseId)!.name,
      branchName: warehouseById.get(line.warehouseId)!.branch.name,
      stockItemName: itemById.get(line.stockItemId)!.name,
      baseUnit: itemById.get(line.stockItemId)!.baseUnit,
      condition: line.condition,
      unitCode: line.unitCode,
      enteredQuantity: line.enteredQuantity,
      baseDelta: normalizeSignedDecimal(line.baseDelta),
      position,
      createdBy: actor,
    })),
  });

  const balancesInOrder = [...command.movements].sort((left, right) =>
    `${left.warehouseId}:${left.stockItemId}:${left.condition}`.localeCompare(
      `${right.warehouseId}:${right.stockItemId}:${right.condition}`,
    ),
  );
  for (const movement of balancesInOrder) {
    const delta = normalizeSignedDecimal(movement.baseDelta);
    const balanceKey = {
      merchantId,
      warehouseId: movement.warehouseId,
      stockItemId: movement.stockItemId,
      condition: movement.condition,
    };
    if (
      delta.startsWith('-') &&
      movement.condition === 'available' &&
      merchant.negativeStockPolicy === 'prevent'
    ) {
      const updated = await transaction.stockBalance.updateMany({
        where: { ...balanceKey, quantity: { gte: delta.slice(1) } },
        data: { quantity: { decrement: delta.slice(1) }, updatedBy: actor },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Insufficient Available stock for this movement.');
      }
    } else {
      await transaction.stockBalance.upsert({
        where: { merchantId_warehouseId_stockItemId_condition: balanceKey },
        create: { ...balanceKey, quantity: delta, updatedBy: actor },
        update: { quantity: { increment: delta }, updatedBy: actor },
      });
    }
  }

  const result = await transaction.stockMovementBatch.findUniqueOrThrow({
    where: { id: batch.id },
    include: { movements: { include: movementInclude, orderBy: { position: 'asc' } } },
  });
  return toBatchResult(result, false);
}
