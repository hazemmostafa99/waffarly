/** Records safe movements and cash handoffs while keeping custody and receiving confirmation attributable. */
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CashDrawerSummary,
  CashSafeMovementSummary,
  CashSafeSummary,
  CashTransferSummary,
  CursorPage,
  PosEmployeeSession,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { formatCents, toCents, toSignedCents } from '../../common/money/money.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { remainingClosedCash } from './cash-custody.persistence.js';
import {
  createSafeSchema,
  receiveCashSchema,
  resolveCashSchema,
  safeMovementSchema,
  transferCashSchema,
} from './cash-custody.schemas.js';
import { runCashCustodyTransaction } from './custody/cash-write.js';
import { requireEmployeeCashBranch } from './custody/custody-access.js';
import {
  cashAmountCents,
  fingerprintCustodyCommand,
  toCashTransferSummary,
  transferInclude,
} from './custody/custody-records.js';
import { carryoverOptions, drawerLedger, drawers } from './custody/drawers.js';
import { listSafes, safeLedger } from './custody/safe.query.js';
import { listTransfers } from './custody/transfer.query.js';

@Injectable()
export class CashCustodyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async employeeBranch(
    employee: PosEmployeeSession,
    branchId: string,
    manage = false,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    return requireEmployeeCashBranch(this.prisma, employee, branchId, manage, db);
  }

  async listSafes(merchantId: string, input: unknown): Promise<CursorPage<CashSafeSummary>> {
    return listSafes(this.prisma, merchantId, input);
  }

  async createSafe(merchantId: string, actor: string, input: unknown): Promise<{ id: string }> {
    const q = parseRequest(createSafeSchema, input);
    return runCashCustodyTransaction(this.prisma, async (tx) => {
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

  async listTransfers(
    merchantId: string,
    input: unknown,
    employee?: PosEmployeeSession,
  ): Promise<CursorPage<CashTransferSummary>> {
    return listTransfers(this.prisma, merchantId, input, employee);
  }

  async transferClosedCash(
    merchantId: string,
    actor: string,
    shiftId: string,
    input: unknown,
    employee?: PosEmployeeSession,
  ): Promise<CashTransferSummary> {
    const q = parseRequest(transferCashSchema, input);
    const hash = fingerprintCustodyCommand({ shiftId, actor, ...q });
    return runCashCustodyTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "pos_shifts" WHERE "id"=${shiftId}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
      const shift = await tx.posShift.findFirst({ where: { id: shiftId, merchantId } });
      if (!shift) throw new NotFoundException('Shift not found.');
      if (employee) {
        await requireEmployeeCashBranch(this.prisma, employee, shift.branchId, false, tx);
        if (shift.openedByEmployeeId !== employee.id)
          await requireEmployeeCashBranch(this.prisma, employee, shift.branchId, true, tx);
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

  async receive(
    merchantId: string,
    actor: string,
    id: string,
    input: unknown,
    employee?: PosEmployeeSession,
  ): Promise<CashTransferSummary> {
    const q = parseRequest(receiveCashSchema, input);
    const hash = fingerprintCustodyCommand({ id, actor, ...q });
    return runCashCustodyTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "pos_cash_transfers" WHERE "id"=${id}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
      const transfer = await tx.posCashTransfer.findFirst({
        where: { id, merchantId },
        include: transferInclude,
      });
      if (!transfer || !transfer.destinationSafeId)
        throw new NotFoundException('Safe transfer not found.');
      if (employee)
        await requireEmployeeCashBranch(this.prisma, employee, transfer.branchId, true, tx);
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

  async receiveForEmployee(
    employee: PosEmployeeSession,
    branchId: string,
    id: string,
    input: unknown,
  ): Promise<CashTransferSummary> {
    const record = await this.prisma.posCashTransfer.findFirst({
      where: { id, merchantId: employee.merchantId, branchId },
    });
    if (!record) throw new NotFoundException('Transfer not found.');
    await requireEmployeeCashBranch(this.prisma, employee, branchId, true);
    return this.receive(employee.merchantId, `pos:${employee.id}`, id, input, employee);
  }

  async resolve(
    merchantId: string,
    actor: string,
    id: string,
    input: unknown,
  ): Promise<CashTransferSummary> {
    const q = parseRequest(resolveCashSchema, input);
    return runCashCustodyTransaction(this.prisma, async (tx) => {
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

  async safeMovement(
    merchantId: string,
    actor: string,
    safeId: string,
    input: unknown,
  ): Promise<{ id: string }> {
    const q = parseRequest(safeMovementSchema, input);
    const signed = formatCents(toCents(q.amount) * (q.kind === 'withdrawal' ? -1n : 1n));
    return runCashCustodyTransaction(this.prisma, async (tx) => {
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

  async safeLedger(
    merchantId: string,
    safeId: string,
    input: unknown,
  ): Promise<CursorPage<CashSafeMovementSummary>> {
    return safeLedger(this.prisma, merchantId, safeId, input);
  }

  drawerLedger(
    merchantId: string,
    shiftId: string,
    input: unknown,
  ): Promise<CursorPage<CashSafeMovementSummary>> {
    return drawerLedger(this.prisma, merchantId, shiftId, input);
  }

  async carryoverOptions(
    employee: PosEmployeeSession,
    input: unknown,
  ): Promise<CursorPage<CashDrawerSummary>> {
    return carryoverOptions(this.prisma, employee, input);
  }

  async drawers(
    merchantId: string,
    input: unknown,
    employee?: PosEmployeeSession,
    closedOnly = false,
  ): Promise<CursorPage<CashDrawerSummary>> {
    return drawers(this.prisma, merchantId, input, employee, closedOnly);
  }
}
