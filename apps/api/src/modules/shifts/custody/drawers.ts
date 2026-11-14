/** Shows drawer cash, its movement history and cash available to carry into another shift. */
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import type {
  CashDrawerSummary,
  CashSafeMovementSummary,
  CursorPage,
  PosEmployeeSession,
} from '@waffarly/contracts';

import type { Prisma } from '@waffarly/database';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { formatCents, toCents, toSignedCents } from '../../../common/money/money.js';
import { buildShiftReconciliation } from '../reconciliation/shift-reconciliation.js';

import { readDrawerLedger } from '../cash-drawer-ledger.js';
import { cashPageSchema, type CashPageQuery } from '../cash-custody.schemas.js';
import { cashAmountCents, page } from './custody-records.js';

import { requireEmployeeCashBranch } from './custody-access.js';

export function drawerLedger(
  prisma: PrismaService,
  merchantId: string,
  shiftId: string,
  input: unknown,
): Promise<CursorPage<CashSafeMovementSummary>> {
  return readDrawerLedger(prisma, merchantId, shiftId, parseRequest(cashPageSchema, input));
}

export async function carryoverOptions(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  input: unknown,
): Promise<CursorPage<CashDrawerSummary>> {
  const q = parseRequest(cashPageSchema, input);
  await requireEmployeeCashBranch(prisma, employee, q.branchId ?? '');
  if (
    !q.registerId ||
    !(await prisma.posRegister.findFirst({
      where: {
        id: q.registerId,
        merchantId: employee.merchantId,
        branchId: q.branchId!,
        active: true,
      },
    }))
  )
    throw new NotFoundException('Register not found.');
  return drawers(prisma, employee.merchantId, q, undefined, true);
}

export async function drawers(
  prisma: PrismaService,
  merchantId: string,
  input: unknown,
  employee?: PosEmployeeSession,
  closedOnly = false,
): Promise<CursorPage<CashDrawerSummary>> {
  const q: CashPageQuery = parseRequest(cashPageSchema, input);
  return prisma.$transaction(
    async (tx) => {
      if (employee) {
        if (!q.branchId) throw new ForbiddenException('Choose an assigned branch.');
        await requireEmployeeCashBranch(prisma, employee, q.branchId, false, tx);
      }
      const where: Prisma.PosShiftWhereInput = {
        merchantId,
        ...(q.branchId ? { branchId: q.branchId } : {}),
        ...(q.registerId ? { registerId: q.registerId } : {}),
        ...(closedOnly ? { status: 'closed' } : {}),
        ...(employee ? { openedByEmployeeId: employee.id, status: 'closed' } : {}),
        ...(q.shiftId ? { id: q.shiftId } : {}),
      };
      if (q.cursor)
        assertScopedCursor(
          q.cursor,
          !!(await tx.posShift.findFirst({ where: { ...where, id: q.cursor } })),
        );
      const records = await tx.posShift.findMany({
        where,
        include: {
          register: { select: { name: true } },
          openedBy: { select: { id: true, displayName: true } },
          branch: { select: { name: true } },
          closeReport: true,
        },
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      });
      const items = await Promise.all(
        records.slice(0, q.limit).map(async (shift): Promise<CashDrawerSummary> => {
          const report = shift.closeReport;
          const live = report ?? (await buildShiftReconciliation(tx, shift));
          const groups = await tx.posCashTransfer.groupBy({
            by: ['status', 'destinationSafeId', 'manualMovementId'],
            where: { merchantId, sourceShiftId: shift.id },
            _sum: { amount: true, receivedAmount: true },
          });
          let pending = 0n,
            received = 0n,
            carried = 0n,
            allocatedAfterClose = 0n,
            trackedDrops = 0n;
          for (const group of groups) {
            const amount = cashAmountCents(group._sum.amount);
            if (!group.manualMovementId) allocatedAfterClose += amount;
            else trackedDrops += amount;
            if (group.status === 'pending') pending += amount;
            else if (group.destinationSafeId)
              received += cashAmountCents(group._sum.receivedAmount);
            else carried += amount;
          }
          const expected =
            typeof live.expectedCash === 'string'
              ? live.expectedCash
              : live.expectedCash.toFixed(2);
          const drop =
            typeof live.cashDrop === 'string'
              ? toCents(live.cashDrop)
              : cashAmountCents(live.cashDrop);
          return {
            id: shift.id,
            branchId: shift.branchId,
            branchName: shift.branch.name,
            registerId: shift.registerId,
            registerName: shift.register.name,
            cashierName: shift.openedBy.displayName,
            status: shift.status,
            openedAt: shift.openedAt.toISOString(),
            closedAt: shift.closedAt?.toISOString() ?? null,
            expectedCash: expected,
            countedCash: report?.countedCash.toFixed(2) ?? null,
            variance: report?.variance.toFixed(2) ?? null,
            remainingCash: formatCents(
              report
                ? cashAmountCents(report.countedCash) - allocatedAfterClose
                : toSignedCents(expected),
            ),
            pendingAmount: formatCents(pending),
            receivedInSafe: formatCents(received),
            carriedForward: formatCents(carried),
            legacyDropAmount: formatCents(drop - trackedDrops),
          };
        }),
      );
      return page(items, records.length > q.limit);
    },
    { isolationLevel: 'RepeatableRead', timeout: 15000 },
  );
}
