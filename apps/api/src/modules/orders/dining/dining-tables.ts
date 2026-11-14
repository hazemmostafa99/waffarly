/**
 * Manages dining tables and shows the tables an employee can use at a branch.
 */
export { buildCheckValues } from '../billing/split-order-checks.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type {
  CreatePosDiningTableRequest,
  CursorPage,
  PosDiningTableOption,
  PosDiningTableSummary,
  PosEmployeeSession,
  UpdatePosDiningTableRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { toCents, formatCents } from '../../../common/money/money.js';
import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  createPosDiningTableSchema,
  ownerPosDiningTableListSchema,
  updatePosDiningTableSchema,
  type OwnerPosDiningTableListQuery,
} from './pos-dining.schemas.js';

import { assertDiningSellAccess, assertDiningBranchAccess } from './dining-access.rules.js';
const tableInclude = {
  branch: { select: { id: true, name: true } },
} satisfies Prisma.PosDiningTableInclude;

export async function listOwnerTables(
  prisma: PrismaService,
  merchantId: string,
  input: OwnerPosDiningTableListQuery,
): Promise<CursorPage<PosDiningTableSummary>> {
  const query = parseRequest(ownerPosDiningTableListSchema, input);
  const where: Prisma.PosDiningTableWhereInput = {
    merchantId,
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.status === 'active'
      ? { active: true }
      : query.status === 'inactive'
        ? { active: false }
        : {}),
  };
  if (query.cursor) {
    const anchor = await prisma.posDiningTable.findFirst({
      where: { ...where, id: query.cursor },
      select: { id: true },
    });
    assertScopedCursor(query.cursor, anchor !== null);
  }
  const records = await prisma.posDiningTable.findMany({
    where,
    include: tableInclude,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = records.length > query.limit;
  const items = records.slice(0, query.limit).map(toTableSummary);
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

export async function createTable(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  input: CreatePosDiningTableRequest,
): Promise<PosDiningTableSummary> {
  const request = parseRequest(createPosDiningTableSchema, input);
  try {
    const record = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id: request.branchId, merchantId, archivedAt: null },
        select: { id: true },
      });
      if (!branch) throw new ConflictException('Select an active branch for this table.');
      return tx.posDiningTable.create({
        data: {
          merchantId,
          branchId: branch.id,
          code: request.code,
          capacity: request.capacity,
          createdBy: actor,
          updatedBy: actor,
        },
        include: tableInclude,
      });
    });
    return toTableSummary(record);
  } catch (error) {
    if (isUniqueConstraintError(error))
      throw new ConflictException('A table with this code already exists at the branch.');
    throw error;
  }
}

export async function updateTable(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  tableId: string,
  input: UpdatePosDiningTableRequest,
): Promise<PosDiningTableSummary> {
  const request = parseRequest(updatePosDiningTableSchema, input);
  try {
    const record = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "pos_dining_tables" WHERE "id" = ${tableId}::uuid AND "merchantId" = ${merchantId}::uuid FOR UPDATE`;
      const current = await tx.posDiningTable.findFirst({
        where: { id: tableId, merchantId },
        select: { id: true, branchId: true, revision: true },
      });
      if (!current) throw new NotFoundException('The table was not found.');
      if (current.revision !== request.revision)
        throw new ConflictException('This table changed. Reload it before saving.');
      const session = await tx.posDiningSession.findFirst({
        where: { merchantId, tableId, status: 'open' },
        select: { id: true },
      });
      if (session)
        throw new ConflictException('An occupied table cannot be edited or deactivated.');
      const updated = await tx.posDiningTable.updateMany({
        where: { id: tableId, merchantId, revision: request.revision },
        data: {
          code: request.code,
          capacity: request.capacity,
          active: request.active,
          revision: { increment: 1 },
          updatedBy: actor,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('This table changed. Reload it before saving.');
      return tx.posDiningTable.findFirstOrThrow({
        where: { id: tableId, merchantId },
        include: tableInclude,
      });
    });
    return toTableSummary(record);
  } catch (error) {
    if (isUniqueConstraintError(error))
      throw new ConflictException('A table with this code already exists at the branch.');
    throw error;
  }
}

export async function listTablesForEmployee(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  branchId: string,
): Promise<PosDiningTableOption[]> {
  assertDiningSellAccess(employee);
  assertDiningBranchAccess(employee, branchId);
  const tables = await prisma.posDiningTable.findMany({
    where: { merchantId: employee.merchantId, branchId, active: true },
    include: {
      branch: { select: { name: true } },
      sessions: {
        where: { status: 'open' },
        take: 1,
        include: { _count: { select: { orders: true } }, orders: { select: { total: true } } },
      },
    },
    orderBy: [{ code: 'asc' }, { id: 'asc' }],
    take: 100,
  });
  return tables.map((table) => {
    const session = table.sessions[0];
    const outstandingCents =
      session?.orders.reduce((sum, order) => sum + toCents(order.total.toString()), 0n) ?? 0n;
    return {
      id: table.id,
      branchId: table.branchId,
      branchName: table.branch.name,
      code: table.code,
      capacity: table.capacity,
      active: table.active,
      revision: table.revision,
      occupancy: session ? 'occupied' : 'available',
      sessionId: session?.id ?? null,
      sessionRevision: session?.revision ?? null,
      openedAt: session?.openedAt.toISOString() ?? null,
      orderCount: session?._count.orders ?? 0,
      outstandingTotal: formatCents(outstandingCents),
    };
  });
}

function toTableSummary(table: {
  id: string;
  branchId: string;
  code: string;
  capacity: number;
  active: boolean;
  revision: number;
  branch: { id?: string; name: string };
}): PosDiningTableSummary {
  return {
    id: table.id,
    branchId: table.branchId,
    branchName: table.branch.name,
    code: table.code,
    capacity: table.capacity,
    active: table.active,
    revision: table.revision,
  };
}
