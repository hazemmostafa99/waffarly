/** Tracks cash sent between drawers and safes, its receipt and any recorded difference. */
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import type { CashTransferSummary, CursorPage, PosEmployeeSession } from '@waffarly/contracts';

import type { Prisma } from '@waffarly/database';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { toCents } from '../../../common/money/money.js';

import { remainingClosedCash } from '../cash-custody.persistence.js';

import {
  cashPageSchema,
  receiveCashSchema,
  resolveCashSchema,
  transferCashSchema,
} from '../cash-custody.schemas.js';
import {
  transferInclude,
  fingerprintCustodyCommand,
  cashAmountCents,
  page,
  toCashTransferSummary,
} from './custody-records.js';

import { runCashCustodyTransaction } from './cash-write.js';
import { requireEmployeeCashBranch } from './custody-access.js';

export async function listTransfers(
  prisma: PrismaService,
  merchantId: string,
  input: unknown,
  employee?: PosEmployeeSession,
): Promise<CursorPage<CashTransferSummary>> {
  const q = parseRequest(cashPageSchema, input);
  if (employee) await requireEmployeeCashBranch(prisma, employee, q.branchId ?? '');
  const where: Prisma.PosCashTransferWhereInput = {
    merchantId,
    ...(q.branchId ? { branchId: q.branchId } : {}),
    ...(q.safeId ? { destinationSafeId: q.safeId } : {}),
    ...(q.shiftId ? { sourceShiftId: q.shiftId } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.registerId ? { sourceShift: { registerId: q.registerId } } : {}),
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

export async function transferClosedCash(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  shiftId: string,
  input: unknown,
  employee?: PosEmployeeSession,
): Promise<CashTransferSummary> {
  const q = parseRequest(transferCashSchema, input);
  const hash = fingerprintCustodyCommand({ shiftId, actor, ...q });
  return runCashCustodyTransaction(prisma, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "pos_shifts" WHERE "id"=${shiftId}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
    const shift = await tx.posShift.findFirst({ where: { id: shiftId, merchantId } });
    if (!shift) throw new NotFoundException('Shift not found.');
    if (employee) {
      await requireEmployeeCashBranch(prisma, employee, shift.branchId, false, tx);
      if (shift.openedByEmployeeId !== employee.id)
        await requireEmployeeCashBranch(prisma, employee, shift.branchId, true, tx);
    }
    const prior = await tx.posCashTransfer.findFirst({
      where: { merchantId, requestId: q.requestId },
      include: transferInclude,
    });
    if (prior) {
      if (prior.fingerprint !== hash)
        throw new ConflictException('The request was already used with different values.');
      return toCashTransferSummary(prior);
    }
    if (shift.status !== 'closed')
      throw new ConflictException('Use the cash-drop action for an open shift.');
    if (toCents(q.amount) > (await remainingClosedCash(tx, merchantId, shiftId)))
      throw new ConflictException('The amount exceeds the remaining shift custody.');
    const safe = await tx.posCashSafe.findFirst({
      where: { id: q.safeId, merchantId, branchId: shift.branchId },
    });
    if (!safe) throw new NotFoundException('Select a safe in the same branch.');
    return toCashTransferSummary(
      await tx.posCashTransfer.create({
        data: {
          merchantId,
          branchId: shift.branchId,
          sourceShiftId: shift.id,
          destinationSafeId: safe.id,
          amount: q.amount,
          requestId: q.requestId,
          reference: q.reference,
          reason: q.reason,
          createdBy: actor,
          fingerprint: hash,
        },
        include: transferInclude,
      }),
    );
  });
}

export async function receive(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  id: string,
  input: unknown,
  employee?: PosEmployeeSession,
): Promise<CashTransferSummary> {
  const q = parseRequest(receiveCashSchema, input);
  const hash = fingerprintCustodyCommand({ id, actor, ...q });
  return runCashCustodyTransaction(prisma, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "pos_cash_transfers" WHERE "id"=${id}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
    const transfer = await tx.posCashTransfer.findFirst({
      where: { id, merchantId },
      include: transferInclude,
    });
    if (!transfer || !transfer.destinationSafeId)
      throw new NotFoundException('Safe transfer not found.');
    if (employee) await requireEmployeeCashBranch(prisma, employee, transfer.branchId, true, tx);
    if (transfer.receiptRequestId === q.requestId && transfer.receiptFingerprint === hash)
      return toCashTransferSummary(transfer);
    if (transfer.status !== 'pending')
      throw new ConflictException('This transfer was already received.');
    if (transfer.createdBy === actor)
      throw new ForbiddenException('A different person must confirm receipt.');
    const differs = cashAmountCents(transfer.amount) !== toCents(q.receivedAmount);
    if (differs && !q.note) throw new ConflictException('Explain the receipt difference.');
    await tx.posCashSafeMovement.create({
      data: {
        merchantId,
        branchId: transfer.branchId,
        safeId: transfer.destinationSafeId,
        transferId: id,
        requestId: q.requestId,
        kind: 'receipt',
        amount: q.receivedAmount,
        reason: transfer.reference,
        createdBy: actor,
      },
    });
    return toCashTransferSummary(
      await tx.posCashTransfer.update({
        where: { id },
        data: {
          status: differs ? 'discrepancy' : 'received',
          receivedAmount: q.receivedAmount,
          receivedBy: actor,
          receivedAt: new Date(),
          receiptRequestId: q.requestId,
          receiptFingerprint: hash,
          receiptNote: q.note || null,
        },
        include: transferInclude,
      }),
    );
  });
}

export async function receiveForEmployee(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  branchId: string,
  id: string,
  input: unknown,
): Promise<CashTransferSummary> {
  const record = await prisma.posCashTransfer.findFirst({
    where: { id, merchantId: employee.merchantId, branchId },
  });
  if (!record) throw new NotFoundException('Transfer not found.');
  await requireEmployeeCashBranch(prisma, employee, branchId, true);
  return receive(prisma, employee.merchantId, `pos:${employee.id}`, id, input, employee);
}

export async function resolve(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  id: string,
  input: unknown,
): Promise<CashTransferSummary> {
  const q = parseRequest(resolveCashSchema, input);
  return runCashCustodyTransaction(prisma, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "pos_cash_transfers" WHERE "id"=${id}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
    const transfer = await tx.posCashTransfer.findFirst({ where: { merchantId, id } });
    if (!transfer) throw new NotFoundException('Transfer not found.');
    if (
      transfer.status === 'resolved' &&
      transfer.resolutionNote === q.note &&
      transfer.resolvedBy === actor
    )
      return toCashTransferSummary(
        await tx.posCashTransfer.findUniqueOrThrow({ where: { id }, include: transferInclude }),
      );
    if (transfer.status !== 'discrepancy')
      throw new ConflictException('Only a receipt difference can be acknowledged.');
    return toCashTransferSummary(
      await tx.posCashTransfer.update({
        where: { id },
        data: {
          status: 'resolved',
          resolutionNote: q.note,
          resolvedBy: actor,
          resolvedAt: new Date(),
        },
        include: transferInclude,
      }),
    );
  });
}
