/** Finds the registers belonging to a merchant and returns a bounded page. */

import type {
  CursorPage,
  PosEmployeeSession,
  PosRegisterOption,
  PosRegisterSummary,
} from '@waffarly/contracts';

import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { ownerPosRegisterListSchema, type OwnerPosRegisterListQuery } from '../shifts.schemas.js';

import { registerInclude } from '../shift-records.js';
import { toRegisterSummary } from '../shift.mapper.js';
import { assertShiftBranchAssignment } from '../access/shift-access.rules.js';
import { posRegisterListSchema } from '../shifts.schemas.js';

export async function listOwnerRegisters(
  prisma: PrismaService,
  merchantId: string,
  input: OwnerPosRegisterListQuery,
): Promise<CursorPage<PosRegisterSummary>> {
  const query = parseRequest(ownerPosRegisterListSchema, input);
  if (query.cursor) {
    const anchor = await prisma.posRegister.findFirst({
      where: {
        id: query.cursor,
        merchantId,
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.status === 'active'
          ? { active: true }
          : query.status === 'inactive'
            ? { active: false }
            : {}),
      },
      select: { id: true },
    });
    assertScopedCursor(query.cursor, anchor !== null);
  }

  const records = await prisma.posRegister.findMany({
    where: {
      merchantId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status === 'active'
        ? { active: true }
        : query.status === 'inactive'
          ? { active: false }
          : {}),
    },
    include: registerInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = records.length > query.limit;
  const items = records.slice(0, query.limit).map(toRegisterSummary);
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

/** Finds active registers available to an employee on one assigned branch. */
export async function listRegistersForEmployee(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  input: unknown,
): Promise<PosRegisterOption[]> {
  const query = parseRequest(posRegisterListSchema, input);
  assertShiftBranchAssignment(employee, query.branchId);
  if (employee.deviceRegister) return [employee.deviceRegister];
  return prisma.posRegister.findMany({
    where: {
      merchantId: employee.merchantId,
      branchId: query.branchId,
      active: true,
      deviceId: null,
      branch: { archivedAt: null },
    },
    select: { id: true, branchId: true, name: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: 100,
  });
}
