/** Finds available registers, current shifts and eligible cash handover recipients. */
import { toShiftSummary } from '../shift.mapper.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import type {
  CursorPage,
  PosDeliveryHandoverRecipient,
  PosEmployeeSession,
  PosRegisterOption,
  PosShiftSummary,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import {
  deliveryHandoverRecipientsSchema,
  posCurrentShiftSchema,
  posRegisterListSchema,
} from '../shifts.schemas.js';

import { shiftInclude } from '../shift-records.js';
import {
  readCurrentShiftPermissions,
  assertShiftBranchAssignment,
  requireShiftAccess,
} from '../access/shift-access.rules.js';

export async function listDeliveryHandoverRecipients(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  input: unknown,
): Promise<CursorPage<PosDeliveryHandoverRecipient>> {
  requireShiftAccess(employee);
  const q = parseRequest(deliveryHandoverRecipientsSchema, input);
  assertShiftBranchAssignment(employee, q.branchId);
  const permissions = await readCurrentShiftPermissions(prisma, employee, q.branchId);
  if (!permissions.includes('open_register_shift'))
    throw new ForbiddenException('This employee is not authorized to use register shifts.');
  const where: Prisma.PosEmployeeWhereInput = {
    merchantId: employee.merchantId,
    id: { not: employee.id },
    active: true,
    branches: { some: { branchId: q.branchId, branch: { archivedAt: null } } },
    OR: [
      { role: { in: ['cashier', 'supervisor', 'branch_manager'] } },
      { role: null, permissions: { hasEvery: ['sell', 'open_register_shift'] } },
    ],
  };
  if (q.cursor)
    assertScopedCursor(
      q.cursor,
      !!(await prisma.posEmployee.findFirst({
        where: { AND: [where, { id: q.cursor }] },
        select: { id: true },
      })),
    );
  const records = await prisma.posEmployee.findMany({
    where,
    select: { id: true, username: true, displayName: true },
    orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const items = records.slice(0, q.limit);
  return { items, nextCursor: records.length > q.limit ? (items.at(-1)?.id ?? null) : null };
}

export async function listForEmployee(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  input: unknown,
): Promise<PosRegisterOption[]> {
  requireShiftAccess(employee);
  const query = parseRequest(posRegisterListSchema, input);
  assertShiftBranchAssignment(employee, query.branchId);
  const records = await prisma.posRegister.findMany({
    where: {
      merchantId: employee.merchantId,
      branchId: query.branchId,
      active: true,
      branch: { archivedAt: null },
    },
    select: { id: true, branchId: true, name: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: 100,
  });
  return records;
}

export async function getCurrentShift(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  registerId: string,
): Promise<PosShiftSummary | null> {
  requireShiftAccess(employee);
  const query = parseRequest(posCurrentShiftSchema, { registerId });
  const register = await prisma.posRegister.findFirst({
    where: { id: query.registerId, merchantId: employee.merchantId },
    select: { id: true, branchId: true, active: true },
  });
  if (!register || !register.active) throw new NotFoundException('Register was not found.');
  assertShiftBranchAssignment(employee, register.branchId);
  const current = await prisma.posShift.findFirst({
    where: { merchantId: employee.merchantId, registerId, status: 'open' },
    include: shiftInclude,
  });
  return current ? toShiftSummary(current) : null;
}

export async function getShiftBranch(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  shiftId: string,
): Promise<string> {
  requireShiftAccess(employee);
  const shift = await prisma.posShift.findFirst({
    where: { id: shiftId, merchantId: employee.merchantId },
    select: { branchId: true },
  });
  if (!shift) throw new NotFoundException('The register shift was not found.');
  assertShiftBranchAssignment(employee, shift.branchId);
  return shift.branchId;
}
