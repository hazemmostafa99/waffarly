/** Finds tenant-owned stock branches and their warehouses. */
import { NotFoundException } from '@nestjs/common';
import type { InventoryBranch } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  listInventoryBranchesSchema,
  type InventoryBranchListQuery,
} from '../inventory.schemas.js';

import { branchInclude, toBranch } from './branch.mapper.js';

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
