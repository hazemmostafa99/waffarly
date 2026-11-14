/** Lists, creates, updates, archives and restores merchant branches. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import type {
  CreateInventoryBranchRequest,
  InventoryBranch,
  UpdateInventoryBranchRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  createInventoryBranchSchema,
  listInventoryBranchesSchema,
  stockItemRevisionSchema,
  updateInventoryBranchSchema,
  type InventoryBranchListQuery,
} from '../inventory.schemas.js';

import { branchInclude, toBranch } from './branch.mapper.js';
import { assertMutableBranch } from './location-access.js';

export async function listBranches(
  prisma: PrismaService,
  merchantId: string,
  input: InventoryBranchListQuery,
) {
  const query = parseRequest(listInventoryBranchesSchema, input);
  const where: Prisma.BranchWhereInput = {
    merchantId,
    ...(query.status === 'all'
      ? {}
      : { archivedAt: query.status === 'active' ? null : { not: null } }),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
  };
  if (query.cursor) {
    const anchor = await prisma.branch.findFirst({
      where: { ...where, id: query.cursor },
      select: { id: true },
    });
    assertScopedCursor(query.cursor, anchor !== null);
  }
  const rows = await prisma.branch.findMany({
    where,
    include: branchInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, query.limit).map(toBranch);
  return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
}

export async function getBranch(
  prisma: PrismaService,
  merchantId: string,
  id: string,
): Promise<InventoryBranch> {
  const branch = await prisma.branch.findFirst({
    where: { merchantId, id },
    include: branchInclude,
  });
  if (!branch) throw new NotFoundException('Branch was not found.');
  return toBranch(branch);
}

export async function createBranch(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  input: CreateInventoryBranchRequest,
): Promise<InventoryBranch> {
  const parsed = parseRequest(createInventoryBranchSchema, input);
  try {
    return await prisma.$transaction(async (transaction) => {
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

export async function updateBranch(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  id: string,
  input: UpdateInventoryBranchRequest,
): Promise<InventoryBranch> {
  const parsed = parseRequest(updateInventoryBranchSchema, input);
  try {
    const changed = await prisma.branch.updateMany({
      where: { id, merchantId, revision: parsed.revision, archivedAt: null },
      data: {
        name: parsed.name,
        address: parsed.address || null,
        updatedBy: actor,
        revision: { increment: 1 },
      },
    });
    if (changed.count !== 1) await assertMutableBranch(prisma, merchantId, id);
    return await getBranch(prisma, merchantId, id);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException('A branch with this name already exists.');
    }
    throw error;
  }
}

export async function setBranchArchived(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  id: string,
  archived: boolean,
  input: { revision: number },
): Promise<InventoryBranch> {
  const { revision } = parseRequest(stockItemRevisionSchema, input);
  return prisma.$transaction(async (transaction) => {
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
