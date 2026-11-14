/** Maintains stock branches, warehouses and consumption defaults. */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateInventoryBranchRequest,
  CreateInventoryWarehouseRequest,
  InventoryBranch,
  SetDefaultConsumptionWarehouseRequest,
  UpdateInventoryBranchRequest,
  UpdateInventoryWarehouseRequest,
} from '@waffarly/contracts';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  createInventoryBranchSchema,
  createInventoryWarehouseSchema,
  setDefaultConsumptionWarehouseSchema,
  stockItemRevisionSchema,
  updateInventoryBranchSchema,
  updateInventoryWarehouseSchema,
  type InventoryBranchListQuery,
} from './inventory.schemas.js';
import { branchInclude, MAX_WAREHOUSES_PER_BRANCH, toBranch } from './locations/branch.mapper.js';
import { getBranch, listBranches } from './locations/branch.query.js';
import { assertMutableBranch, assertMutableWarehouse } from './locations/location-access.js';
import { getWarehouse, listWarehouses } from './locations/warehouse.queries.js';

@Injectable()
export class InventoryLocationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listBranches(merchantId: string, input: InventoryBranchListQuery) {
    return listBranches(this.prisma, merchantId, input);
  }

  listWarehouses(merchantId: string, input: InventoryBranchListQuery) {
    return listWarehouses(this.prisma, merchantId, input);
  }

  getWarehouse(merchantId: string, id: string) {
    return getWarehouse(this.prisma, merchantId, id);
  }

  async getBranch(merchantId: string, id: string): Promise<InventoryBranch> {
    return getBranch(this.prisma, merchantId, id);
  }

  async createBranch(
    merchantId: string,
    actor: string,
    input: CreateInventoryBranchRequest,
  ): Promise<InventoryBranch> {
    const parsed = parseRequest(createInventoryBranchSchema, input);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const branch = await transaction.branch.create({
          data: {
            merchantId,
            name: parsed.name,
            address: parsed.address || null,
            createdBy: actor,
            updatedBy: actor,
          },
        });
        await transaction.warehouse.create({
          data: {
            merchantId,
            branchId: branch.id,
            name: parsed.defaultWarehouseName,
            isDefaultConsumption: true,
            createdBy: actor,
            updatedBy: actor,
          },
        });
        return toBranch(
          await transaction.branch.findFirstOrThrow({
            where: { id: branch.id, merchantId },
            include: branchInclude,
          }),
        );
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A branch or warehouse with this name already exists.');
      }
      throw error;
    }
  }

  async updateBranch(
    merchantId: string,
    actor: string,
    id: string,
    input: UpdateInventoryBranchRequest,
  ): Promise<InventoryBranch> {
    const parsed = parseRequest(updateInventoryBranchSchema, input);
    try {
      const changed = await this.prisma.branch.updateMany({
        where: { id, merchantId, revision: parsed.revision, archivedAt: null },
        data: {
          name: parsed.name,
          address: parsed.address || null,
          updatedBy: actor,
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1) await assertMutableBranch(this.prisma, merchantId, id);
      return await getBranch(this.prisma, merchantId, id);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A branch with this name already exists.');
      }
      throw error;
    }
  }

  async setBranchArchived(
    merchantId: string,
    actor: string,
    id: string,
    archived: boolean,
    input: { revision: number },
  ): Promise<InventoryBranch> {
    const { revision } = parseRequest(stockItemRevisionSchema, input);
    return this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "branches"
        WHERE "id" = ${id}::uuid AND "merchantId" = ${merchantId}::uuid
        FOR UPDATE`;
      if (locked.length !== 1) throw new NotFoundException('Branch was not found.');
      if (archived) {
        await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "warehouses"
          WHERE "branchId" = ${id}::uuid AND "merchantId" = ${merchantId}::uuid
          ORDER BY "id" FOR UPDATE`;
        const cancellable = await transaction.storefrontOrder.findFirst({
          where: {
            merchantId,
            branchId: id,
            status: 'accepted',
            lines: { some: { stockHandling: 'recipe_acceptance' } },
          },
          select: { id: true },
        });
        if (cancellable)
          throw new ConflictException(
            'A location used by an order awaiting preparation cannot be archived.',
          );
        const balance = await transaction.stockBalance.findFirst({
          where: { merchantId, warehouse: { branchId: id }, quantity: { not: 0 } },
          select: { id: true },
        });
        if (balance) {
          throw new ConflictException('A branch with non-zero stock cannot be archived.');
        }
      }
      const changed = await transaction.branch.updateMany({
        where: { id, merchantId, revision, archivedAt: archived ? null : { not: null } },
        data: {
          archivedAt: archived ? new Date() : null,
          updatedBy: actor,
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1) await assertMutableBranch(transaction, merchantId, id);
      return toBranch(
        await transaction.branch.findFirstOrThrow({
          where: { id, merchantId },
          include: branchInclude,
        }),
      );
    });
  }

  async createWarehouse(
    merchantId: string,
    actor: string,
    branchId: string,
    input: CreateInventoryWarehouseRequest,
  ): Promise<InventoryBranch> {
    const parsed = parseRequest(createInventoryWarehouseSchema, input);
    try {
      return await this.prisma.$transaction(async (transaction) => {
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

  async updateWarehouse(
    merchantId: string,
    actor: string,
    branchId: string,
    warehouseId: string,
    input: UpdateInventoryWarehouseRequest,
  ): Promise<InventoryBranch> {
    const parsed = parseRequest(updateInventoryWarehouseSchema, input);
    try {
      return await this.prisma.$transaction(async (transaction) => {
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

  async setDefaultConsumptionWarehouse(
    merchantId: string,
    actor: string,
    branchId: string,
    input: SetDefaultConsumptionWarehouseRequest,
  ): Promise<InventoryBranch> {
    const parsed = parseRequest(setDefaultConsumptionWarehouseSchema, input);
    return this.prisma.$transaction(async (transaction) => {
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

  async setWarehouseArchived(
    merchantId: string,
    actor: string,
    branchId: string,
    warehouseId: string,
    archived: boolean,
    input: { revision: number },
  ): Promise<InventoryBranch> {
    const { revision } = parseRequest(stockItemRevisionSchema, input);
    return this.prisma.$transaction(async (transaction) => {
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
}
