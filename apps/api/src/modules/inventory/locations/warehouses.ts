/** Manages branch warehouses and chooses the warehouse used for order consumption. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import type {
  CreateInventoryWarehouseRequest,
  InventoryBranch,
  SetDefaultConsumptionWarehouseRequest,
  UpdateInventoryWarehouseRequest,
} from '@waffarly/contracts';

import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  createInventoryWarehouseSchema,
  setDefaultConsumptionWarehouseSchema,
  stockItemRevisionSchema,
  updateInventoryWarehouseSchema,
} from '../inventory.schemas.js';

import { branchInclude, MAX_WAREHOUSES_PER_BRANCH, toBranch } from './branch.mapper.js';

import { assertMutableBranch, assertMutableWarehouse } from './location-access.js';

export async function createWarehouse(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  branchId: string,
  input: CreateInventoryWarehouseRequest,
): Promise<InventoryBranch> {
  const parsed = parseRequest(createInventoryWarehouseSchema, input);
  try {
    return await prisma.$transaction(async (transaction) => {
      const changed = await transaction.branch.updateMany({
        where: { id: branchId, merchantId, revision: parsed.revision, archivedAt: null },
        data: { revision: { increment: 1 }, updatedBy: actor },
      });
      if (changed.count !== 1) await assertMutableBranch(transaction, merchantId, branchId);
      const warehouseCount = await transaction.warehouse.count({
        where: { merchantId, branchId },
      });
      if (warehouseCount >= MAX_WAREHOUSES_PER_BRANCH) {
        throw new ConflictException('A branch can have at most 100 warehouses.');
      }
      await transaction.warehouse.create({
        data: { merchantId, branchId, name: parsed.name, createdBy: actor, updatedBy: actor },
      });
      return toBranch(
        await transaction.branch.findFirstOrThrow({
          where: { id: branchId, merchantId },
          include: branchInclude,
        }),
      );
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException('A warehouse with this name already exists in the branch.');
    }
    throw error;
  }
}

export async function updateWarehouse(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  branchId: string,
  warehouseId: string,
  input: UpdateInventoryWarehouseRequest,
): Promise<InventoryBranch> {
  const parsed = parseRequest(updateInventoryWarehouseSchema, input);
  try {
    return await prisma.$transaction(async (transaction) => {
      const branchLock = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "branches"
          WHERE "id" = ${branchId}::uuid AND "merchantId" = ${merchantId}::uuid
            AND "archivedAt" IS NULL
          FOR UPDATE`;
      if (branchLock.length !== 1) throw new NotFoundException('Active branch was not found.');
      const changed = await transaction.warehouse.updateMany({
        where: {
          id: warehouseId,
          branchId,
          merchantId,
          revision: parsed.revision,
          archivedAt: null,
          branch: { archivedAt: null },
        },
        data: { name: parsed.name, updatedBy: actor, revision: { increment: 1 } },
      });
      if (changed.count !== 1)
        await assertMutableWarehouse(transaction, merchantId, branchId, warehouseId);
      await transaction.branch.updateMany({
        where: { id: branchId, merchantId },
        data: { revision: { increment: 1 }, updatedBy: actor },
      });
      return toBranch(
        await transaction.branch.findFirstOrThrow({
          where: { id: branchId, merchantId },
          include: branchInclude,
        }),
      );
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException('A warehouse with this name already exists in the branch.');
    }
    throw error;
  }
}

export async function setDefaultConsumptionWarehouse(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  branchId: string,
  input: SetDefaultConsumptionWarehouseRequest,
): Promise<InventoryBranch> {
  const parsed = parseRequest(setDefaultConsumptionWarehouseSchema, input);
  return prisma.$transaction(async (transaction) => {
    const changed = await transaction.branch.updateMany({
      where: { id: branchId, merchantId, revision: parsed.revision, archivedAt: null },
      data: { revision: { increment: 1 }, updatedBy: actor },
    });
    if (changed.count !== 1) await assertMutableBranch(transaction, merchantId, branchId);
    const target = await transaction.warehouse.findFirst({
      where: {
        id: parsed.warehouseId,
        merchantId,
        branchId,
        archivedAt: null,
        branch: { archivedAt: null },
      },
      select: { id: true, isDefaultConsumption: true },
    });
    if (!target) throw new NotFoundException('Active warehouse was not found in this branch.');
    if (!target.isDefaultConsumption) {
      await transaction.warehouse.updateMany({
        where: { merchantId, branchId, isDefaultConsumption: true },
        data: { isDefaultConsumption: false, revision: { increment: 1 }, updatedBy: actor },
      });
      await transaction.warehouse.update({
        where: { id: target.id },
        data: { isDefaultConsumption: true, revision: { increment: 1 }, updatedBy: actor },
      });
    }
    return toBranch(
      await transaction.branch.findFirstOrThrow({
        where: { id: branchId, merchantId },
        include: branchInclude,
      }),
    );
  });
}

export async function setWarehouseArchived(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  branchId: string,
  warehouseId: string,
  archived: boolean,
  input: { revision: number },
): Promise<InventoryBranch> {
  const { revision } = parseRequest(stockItemRevisionSchema, input);
  return prisma.$transaction(async (transaction) => {
    const branchLock = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "branches"
        WHERE "id" = ${branchId}::uuid AND "merchantId" = ${merchantId}::uuid
          AND "archivedAt" IS NULL
        FOR UPDATE`;
    if (branchLock.length !== 1) throw new NotFoundException('Active branch was not found.');
    const warehouseLock = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "warehouses"
        WHERE "id" = ${warehouseId}::uuid AND "branchId" = ${branchId}::uuid
          AND "merchantId" = ${merchantId}::uuid
        FOR UPDATE`;
    if (warehouseLock.length !== 1) throw new NotFoundException('Warehouse was not found.');
    const warehouse = await transaction.warehouse.findFirst({
      where: { id: warehouseId, branchId, merchantId },
      select: { id: true, isDefaultConsumption: true, archivedAt: true },
    });
    if (!warehouse) throw new NotFoundException('Warehouse was not found.');
    if (archived && warehouse.isDefaultConsumption) {
      throw new ConflictException('Choose another default consumption warehouse first.');
    }
    if (archived) {
      const cancellable = await transaction.storefrontOrder.findFirst({
        where: {
          merchantId,
          OR: [
            {
              status: 'accepted',
              lines: { some: { stockHandling: 'recipe_acceptance' } },
              stockBatches: {
                some: {
                  role: 'consumption',
                  batch: { is: { movements: { some: { warehouseId } } } },
                },
              },
            },
            {
              source: 'pos',
              status: { in: ['pending', 'accepted'] },
              stockBatches: {
                some: {
                  role: 'consumption',
                  batch: { is: { movements: { some: { warehouseId } } } },
                },
              },
              lines: { some: { stockHandling: 'direct_sale' } },
            },
          ],
        },
        select: { id: true },
      });
      if (cancellable)
        throw new ConflictException(
          'A location used by an order awaiting preparation cannot be archived.',
        );
      const balance = await transaction.stockBalance.findFirst({
        where: { merchantId, warehouseId, quantity: { not: 0 } },
        select: { id: true },
      });
      if (balance) {
        throw new ConflictException('A warehouse with non-zero stock cannot be archived.');
      }
    }
    const changed = await transaction.warehouse.updateMany({
      where: {
        id: warehouseId,
        branchId,
        merchantId,
        revision,
        archivedAt: archived ? null : { not: null },
      },
      data: {
        archivedAt: archived ? new Date() : null,
        revision: { increment: 1 },
        updatedBy: actor,
      },
    });
    if (changed.count !== 1) {
      await assertMutableWarehouse(transaction, merchantId, branchId, warehouseId);
    }
    await transaction.branch.updateMany({
      where: { id: branchId, merchantId },
      data: { revision: { increment: 1 }, updatedBy: actor },
    });
    return toBranch(
      await transaction.branch.findFirstOrThrow({
        where: { id: branchId, merchantId },
        include: branchInclude,
      }),
    );
  });
}
