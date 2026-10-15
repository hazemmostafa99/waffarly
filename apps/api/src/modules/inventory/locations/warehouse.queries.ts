import { NotFoundException } from '@nestjs/common';
import type { CursorPage, InventoryWarehouseSummary } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import type { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  listInventoryBranchesSchema,
  type InventoryBranchListQuery,
} from '../inventory.schemas.js';

const include = { branch: { select: { name: true, archivedAt: true } } } as const;
type WarehouseRecord = Prisma.WarehouseGetPayload<{ include: typeof include }>;

export async function listWarehouses(
  prisma: PrismaService,
  merchantId: string,
  input: InventoryBranchListQuery,
): Promise<CursorPage<InventoryWarehouseSummary>> {
  const query = parseRequest(listInventoryBranchesSchema, input);
  const where: Prisma.WarehouseWhereInput = {
    merchantId,
    ...(query.status === 'active'
      ? { archivedAt: null, branch: { archivedAt: null } }
      : query.status === 'archived'
        ? { OR: [{ archivedAt: { not: null } }, { branch: { archivedAt: { not: null } } }] }
        : {}),
    ...(query.search
      ? {
          AND: [
            {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { branch: { name: { contains: query.search, mode: 'insensitive' } } },
              ],
            },
          ],
        }
      : {}),
  };
  if (query.cursor) {
    const anchor = await prisma.warehouse.findFirst({
      where: { ...where, id: query.cursor },
      select: { id: true },
    });
    assertScopedCursor(query.cursor, anchor !== null);
  }
  const rows = await prisma.warehouse.findMany({
    where,
    include,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, query.limit).map(toWarehouse);
  return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
}

export async function getWarehouse(
  prisma: PrismaService,
  merchantId: string,
  id: string,
): Promise<InventoryWarehouseSummary> {
  const record = await prisma.warehouse.findFirst({ where: { merchantId, id }, include });
  if (!record) throw new NotFoundException('Warehouse was not found.');
  return toWarehouse(record);
}

function toWarehouse(record: WarehouseRecord): InventoryWarehouseSummary {
  return {
    id: record.id,
    branchId: record.branchId,
    branchName: record.branch.name,
    branchArchivedAt: record.branch.archivedAt?.toISOString() ?? null,
    name: record.name,
    isDefaultConsumption: record.isDefaultConsumption,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    revision: record.revision,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
