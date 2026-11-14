/** Sets up branch safes and records and lists their cash movements. */
import { ConflictException, NotFoundException } from '@nestjs/common';

import type { CashSafeMovementSummary, CashSafeSummary, CursorPage } from '@waffarly/contracts';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { formatCents, toCents, toSignedCents } from '../../../common/money/money.js';

import { cashPageSchema, createSafeSchema, safeMovementSchema } from '../cash-custody.schemas.js';
import { cashAmountCents, page } from './custody-records.js';

import { runCashCustodyTransaction } from './cash-write.js';

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

export async function createSafe(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  input: unknown,
): Promise<{ id: string }> {
  const q = parseRequest(createSafeSchema, input);
  return runCashCustodyTransaction(prisma, async (tx) => {
    const prior = await tx.posCashSafe.findFirst({ where: { id: q.requestId, merchantId } });
    if (prior) {
      const opening = await tx.posCashSafeMovement.findFirst({
        where: { merchantId, safeId: prior.id, kind: 'opening' },
      });
      if (
        prior.branchId !== q.branchId ||
        prior.name !== q.name ||
        prior.createdBy !== actor ||
        cashAmountCents(opening?.amount ?? null) !== toCents(q.openingBalance)
      )
        throw new ConflictException('The request was already used with different values.');
      return { id: prior.id };
    }
    if (!(await tx.branch.findFirst({ where: { id: q.branchId, merchantId, archivedAt: null } })))
      throw new NotFoundException('Branch not found.');
    const safe = await tx.posCashSafe.create({
      data: { id: q.requestId, merchantId, branchId: q.branchId, name: q.name, createdBy: actor },
    });
    await tx.posCashSafeMovement.create({
      data: {
        merchantId,
        branchId: q.branchId,
        safeId: safe.id,
        requestId: q.requestId,
        kind: 'opening',
        amount: q.openingBalance,
        reason: 'Opening cash count',
        createdBy: actor,
      },
    });
    return { id: safe.id };
  });
}

export async function safeMovement(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  safeId: string,
  input: unknown,
): Promise<{ id: string }> {
  const q = parseRequest(safeMovementSchema, input);
  const signed = formatCents(toCents(q.amount) * (q.kind === 'withdrawal' ? -1n : 1n));
  return runCashCustodyTransaction(prisma, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "pos_cash_safes" WHERE "id"=${safeId}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
    const safe = await tx.posCashSafe.findFirst({ where: { id: safeId, merchantId } });
    if (!safe) throw new NotFoundException('Safe not found.');
    const prior = await tx.posCashSafeMovement.findFirst({
      where: { merchantId, requestId: q.requestId },
    });
    if (prior) {
      if (
        prior.safeId !== safeId ||
        prior.kind !== q.kind ||
        prior.amount.toFixed(2) !== signed ||
        prior.reason !== q.reason ||
        prior.createdBy !== actor
      )
        throw new ConflictException('The request was already used with different values.');
      return { id: prior.id };
    }
    const balance = await tx.posCashSafeMovement.aggregate({
      where: { merchantId, safeId },
      _sum: { amount: true },
    });
    if (cashAmountCents(balance._sum.amount) + toSignedCents(signed) < 0n)
      throw new ConflictException('The safe does not have enough cash.');
    const movement = await tx.posCashSafeMovement.create({
      data: {
        merchantId,
        branchId: safe.branchId,
        safeId,
        requestId: q.requestId,
        kind: q.kind,
        amount: signed,
        reason: q.reason,
        createdBy: actor,
      },
    });
    return { id: movement.id };
  });
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
