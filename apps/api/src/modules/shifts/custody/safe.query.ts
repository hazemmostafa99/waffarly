/** Finds merchant safes and reads their recorded cash movements. */
import { NotFoundException } from '@nestjs/common';

import type { CashSafeMovementSummary, CashSafeSummary, CursorPage } from '@waffarly/contracts';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { formatCents } from '../../../common/money/money.js';

import { cashPageSchema } from '../cash-custody.schemas.js';
import { cashAmountCents, page } from './custody-records.js';

export async function listSafes(
  prisma: PrismaService,
  merchantId: string,
  input: unknown,
): Promise<CursorPage<CashSafeSummary>> {
  const q = parseRequest(cashPageSchema, input);
  return prisma.$transaction(
    async (tx) => {
      const where = { merchantId, ...(q.branchId ? { branchId: q.branchId } : {}) };
      if (q.cursor)
        assertScopedCursor(
          q.cursor,
          !!(await tx.posCashSafe.findFirst({ where: { ...where, id: q.cursor } })),
        );
      const records = await tx.posCashSafe.findMany({
        where,
        include: { branch: { select: { name: true } } },
        orderBy: { id: 'desc' },
        take: q.limit + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      });
      const items = await Promise.all(
        records.slice(0, q.limit).map(async (safe) => {
          const [balance, pending] = await Promise.all([
            tx.posCashSafeMovement.aggregate({
              where: { merchantId, safeId: safe.id },
              _sum: { amount: true },
            }),
            tx.posCashTransfer.aggregate({
              where: { merchantId, destinationSafeId: safe.id, status: 'pending' },
              _sum: { amount: true },
            }),
          ]);
          return {
            id: safe.id,
            branchId: safe.branchId,
            branchName: safe.branch.name,
            name: safe.name,
            balance: formatCents(cashAmountCents(balance._sum.amount)),
            pendingAmount: formatCents(cashAmountCents(pending._sum.amount)),
          };
        }),
      );
      return page(items, records.length > q.limit);
    },
    { isolationLevel: 'RepeatableRead', timeout: 15000 },
  );
}

export async function safeLedger(
  prisma: PrismaService,
  merchantId: string,
  safeId: string,
  input: unknown,
): Promise<CursorPage<CashSafeMovementSummary>> {
  const q = parseRequest(cashPageSchema, input);
  const where = { merchantId, safeId };
  if (!(await prisma.posCashSafe.findFirst({ where: { id: safeId, merchantId } })))
    throw new NotFoundException('Safe not found.');
  if (q.cursor)
    assertScopedCursor(
      q.cursor,
      !!(await prisma.posCashSafeMovement.findFirst({ where: { ...where, id: q.cursor } })),
    );
  return prisma.$transaction(
    async (tx) => {
      const records = await tx.posCashSafeMovement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      });
      const employees = await tx.posEmployee.findMany({
        where: {
          merchantId,
          id: {
            in: records
              .filter((row) => row.createdBy.startsWith('pos:'))
              .map((row) => row.createdBy.slice(4)),
          },
        },
        select: { id: true, displayName: true },
      });
      const items = await Promise.all(
        records.slice(0, q.limit).map(async (row) => {
          const total = await tx.posCashSafeMovement.aggregate({
            where: {
              ...where,
              OR: [
                { createdAt: { lt: row.createdAt } },
                { createdAt: row.createdAt, id: { lte: row.id } },
              ],
            },
            _sum: { amount: true },
          });
          return {
            id: row.id,
            kind: row.kind,
            amount: row.amount.toFixed(2),
            balanceAfter: formatCents(cashAmountCents(total._sum.amount)),
            reason: row.reason,
            createdBy: row.createdBy.startsWith('owner:')
              ? row.createdBy.slice(6)
              : (employees.find((employee) => `pos:${employee.id}` === row.createdBy)
                  ?.displayName ?? row.createdBy),
            createdAt: row.createdAt.toISOString(),
            transferId: row.transferId,
          };
        }),
      );
      return page(items, records.length > q.limit);
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
