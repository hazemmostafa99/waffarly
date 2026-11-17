/** Lists recorded cash transfers within the permitted merchant and branch scope. */

import type { CashTransferSummary, CursorPage, PosEmployeeSession } from '@waffarly/contracts';

import type { Prisma } from '@waffarly/database';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

import { cashPageSchema } from '../cash-custody.schemas.js';
import { page, toCashTransferSummary, transferInclude } from './custody-records.js';

import { requireEmployeeCashBranch } from './custody-access.js';
import { assertPosRegisterAssignment } from '../access/shift-access.rules.js';

export async function listTransfers(
  prisma: PrismaService,
  merchantId: string,
  input: unknown,
  employee?: PosEmployeeSession,
): Promise<CursorPage<CashTransferSummary>> {
  const q = parseRequest(cashPageSchema, input);
  if (employee) {
    await requireEmployeeCashBranch(prisma, employee, q.branchId ?? '');
    if (q.registerId) assertPosRegisterAssignment(employee, q.registerId);
  }
  const registerId = employee?.deviceRegister?.id ?? q.registerId;
  const where: Prisma.PosCashTransferWhereInput = {
    merchantId,
    ...(q.branchId ? { branchId: q.branchId } : {}),
    ...(q.safeId ? { destinationSafeId: q.safeId } : {}),
    ...(q.shiftId ? { sourceShiftId: q.shiftId } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(registerId ? { sourceShift: { registerId } } : {}),
    ...(employee
      ? {
          OR: [
            { createdBy: `pos:${employee.id}` },
            { sourceShift: { openedByEmployeeId: employee.id } },
          ],
        }
      : {}),
  };
  if (q.cursor)
    assertScopedCursor(
      q.cursor,
      !!(await prisma.posCashTransfer.findFirst({ where: { ...where, id: q.cursor } })),
    );
  const records = await prisma.posCashTransfer.findMany({
    where,
    include: transferInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const items = records.slice(0, q.limit).map(toCashTransferSummary);
  const actorIds = [
    ...new Set(
      items
        .flatMap((row) => [row.createdBy, row.receivedBy])
        .filter((actor): actor is string => !!actor && actor.startsWith('pos:'))
        .map((actor) => actor.slice(4)),
    ),
  ];
  const employees = await prisma.posEmployee.findMany({
    where: { merchantId, id: { in: actorIds } },
    select: { id: true, displayName: true },
  });
  const actorName = (actor: string | null) =>
    actor === null
      ? null
      : actor.startsWith('owner:')
        ? actor.slice(6)
        : (employees.find((employee) => `pos:${employee.id}` === actor)?.displayName ?? actor);
  return page(
    items.map((row) => ({
      ...row,
      createdByName: actorName(row.createdBy)!,
      receivedByName: actorName(row.receivedBy),
    })),
    records.length > q.limit,
  );
}
