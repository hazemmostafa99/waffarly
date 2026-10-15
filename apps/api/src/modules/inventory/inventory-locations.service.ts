import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateInventoryBranchRequest,
  CreateInventoryWarehouseRequest,
  InventoryBranch,
  InventoryPolicy,
  InventoryWarehouse,
  NegativeStockPolicy,
  SetDefaultConsumptionWarehouseRequest,
  UpdateInventoryBranchRequest,
  UpdateInventoryPolicyRequest,
  UpdateInventoryWarehouseRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  createInventoryBranchSchema,
  createInventoryWarehouseSchema,
  inventoryPolicyUpdateSchema,
  listInventoryBranchesSchema,
  setDefaultConsumptionWarehouseSchema,
  stockItemRevisionSchema,
  updateInventoryBranchSchema,
  updateInventoryWarehouseSchema,
  type InventoryBranchListQuery,
} from './inventory.schemas.js';

import { getWarehouse, listWarehouses } from './locations/warehouse.queries.js';
const branchInclude = {
  warehouses: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.BranchInclude;
const MAX_WAREHOUSES_PER_BRANCH = 100;
type BranchRecord = Prisma.BranchGetPayload<{ include: typeof branchInclude }>;

@Injectable()
export class InventoryLocationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listBranches(merchantId: string, input: InventoryBranchListQuery) {
    const query = parseRequest(listInventoryBranchesSchema, input);
    const where: Prisma.BranchWhereInput = {
      merchantId,
      ...(query.status === 'all'
        ? {}
        : { archivedAt: query.status === 'active' ? null : { not: null } }),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    if (query.cursor) {
      const anchor = await this.prisma.branch.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const rows = await this.prisma.branch.findMany({
      where,
      include: branchInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, query.limit).map(toBranch);
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
  }

  listWarehouses(merchantId: string, input: InventoryBranchListQuery) {
    return listWarehouses(this.prisma, merchantId, input);
  }

  getWarehouse(merchantId: string, id: string) {
    return getWarehouse(this.prisma, merchantId, id);
  }

  async getBranch(merchantId: string, id: string): Promise<InventoryBranch> {
    const branch = await this.prisma.branch.findFirst({
      where: { merchantId, id },
      include: branchInclude,
    });
    if (!branch) throw new NotFoundException('Branch was not found.');
    return toBranch(branch);
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
      return await this.getBranch(merchantId, id);
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
            warehouseId: warehouseId,
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

  async getPolicy(merchantId: string): Promise<InventoryPolicy> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        negativeStockPolicy: true,
        inventoryPolicyRevision: true,
        inventoryPolicyUpdatedAt: true,
      },
    });
    if (!merchant) throw new NotFoundException('Merchant was not found.');
    return {
      negativeStockPolicy: merchant.negativeStockPolicy as NegativeStockPolicy,
      revision: merchant.inventoryPolicyRevision,
      updatedAt: merchant.inventoryPolicyUpdatedAt?.toISOString() ?? null,
    };
  }

  async updatePolicy(
    merchantId: string,
    actor: string,
    input: UpdateInventoryPolicyRequest,
  ): Promise<InventoryPolicy> {
    const parsed = parseRequest(inventoryPolicyUpdateSchema, input);
    const changed = await this.prisma.merchant.updateMany({
      where: { id: merchantId, inventoryPolicyRevision: parsed.revision },
      data: {
        negativeStockPolicy: parsed.negativeStockPolicy,
        inventoryPolicyRevision: { increment: 1 },
        inventoryPolicyUpdatedBy: actor,
        inventoryPolicyUpdatedAt: new Date(),
      },
    });
    if (changed.count !== 1) {
      const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
      if (!merchant) throw new NotFoundException('Merchant was not found.');
      throw new ConflictException('Inventory policy changed. Reload it before trying again.');
    }
    return this.getPolicy(merchantId);
  }
}

async function assertMutableBranch(
  client: PrismaService | Prisma.TransactionClient,
  merchantId: string,
  id: string,
): Promise<never> {
  const branch = await client.branch.findFirst({
    where: { id, merchantId },
    select: { id: true },
  });
  if (!branch) throw new NotFoundException('Branch was not found.');
  throw new ConflictException('Branch changed or is archived. Reload it before trying again.');
}

async function assertMutableWarehouse(
  client: PrismaService | Prisma.TransactionClient,
  merchantId: string,
  branchId: string,
  id: string,
): Promise<never> {
  const warehouse = await client.warehouse.findFirst({
    where: { id, merchantId, branchId },
    select: { id: true },
  });
  if (!warehouse) throw new NotFoundException('Warehouse was not found.');
  throw new ConflictException('Warehouse changed or is archived. Reload it before trying again.');
}

function toBranch(record: BranchRecord): InventoryBranch {
  const warehouses: InventoryWarehouse[] = record.warehouses.map((warehouse) => ({
    id: warehouse.id,
    branchId: warehouse.branchId,
    name: warehouse.name,
    isDefaultConsumption: warehouse.isDefaultConsumption && !warehouse.archivedAt,
    archivedAt: warehouse.archivedAt?.toISOString() ?? null,
    revision: warehouse.revision,
    createdAt: warehouse.createdAt.toISOString(),
    updatedAt: warehouse.updatedAt.toISOString(),
  }));
  return {
    id: record.id,
    name: record.name,
    address: record.address,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    revision: record.revision,
    defaultConsumptionWarehouseId:
      warehouses.find((warehouse) => warehouse.isDefaultConsumption)?.id ?? null,
    warehouses,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
