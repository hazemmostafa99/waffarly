import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  CashDrawerSummary,
  CashSafeMovementSummary,
  CashSafeSummary,
  CashTransferSummary,
  CursorPage,
  PosEmployeeSession,
} from '@waffarly/contracts';
import { isPosEmployeeRole, resolvePosEmployeePermissions } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../infrastructure/database/prisma-errors.js';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { formatCents, toCents, toSignedCents } from '../../common/money/money.js';
import { buildShiftReconciliation } from './shifts.service.js';
import { remainingClosedCash } from './cash-custody.persistence.js';
import { readDrawerLedger } from './cash-drawer-ledger.js';
import {
  cashPageSchema,
  createSafeSchema,
  receiveCashSchema,
  resolveCashSchema,
  safeMovementSchema,
  transferCashSchema,
  type CashPageQuery,
} from './cash-custody.schemas.js';

const transferInclude = {
  sourceShift: { select: { register: { select: { name: true } } } },
  destinationSafe: { select: { name: true } },
  destinationShift: { select: { register: { select: { name: true } } } },
} satisfies Prisma.PosCashTransferInclude;
type TransferRecord = Prisma.PosCashTransferGetPayload<{ include: typeof transferInclude }>;
const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cents = (value: { toFixed(n: number): string } | null) =>
  toSignedCents(value?.toFixed(2) ?? '0.00');

@Injectable()
export class CashCustodyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async write<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(run, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (isSerializationConflict(error) || isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Cash records changed. Refresh and retry the same saved request.',
        );
      }
      throw error;
    }
  }

  async employeeBranch(
    employee: PosEmployeeSession,
    branchId: string,
    manage = false,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (!employee.branches.some((branch) => branch.id === branchId && branch.archivedAt === null))
      throw new ForbiddenException('Branch is not assigned.');
    const record = await db.posEmployee.findFirst({
      where: {
        id: employee.id,
        merchantId: employee.merchantId,
        active: true,
        branches: { some: { branchId, branch: { archivedAt: null } } },
      },
    });
    const permissions = record
      ? resolvePosEmployeePermissions(
          isPosEmployeeRole(record.role) ? record.role : null,
          record.permissions,
        )
      : [];
    if (!permissions.includes(manage ? 'manage_cash_movements' : 'open_register_shift'))
      throw new ForbiddenException('Cash access is not permitted.');
  }

  async listSafes(merchantId: string, input: unknown): Promise<CursorPage<CashSafeSummary>> {
    const q = parseRequest(cashPageSchema, input);
    return this.prisma.$transaction(
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
              balance: formatCents(cents(balance._sum.amount)),
              pendingAmount: formatCents(cents(pending._sum.amount)),
            };
          }),
        );
        return page(items, records.length > q.limit);
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
  }

  async createSafe(merchantId: string, actor: string, input: unknown): Promise<{ id: string }> {
    const q = parseRequest(createSafeSchema, input);
    return this.write(async (tx) => {
      const prior = await tx.posCashSafe.findFirst({ where: { id: q.requestId, merchantId } });
      if (prior) {
        const opening = await tx.posCashSafeMovement.findFirst({
          where: { merchantId, safeId: prior.id, kind: 'opening' },
        });
        if (
          prior.branchId !== q.branchId ||
          prior.name !== q.name ||
          prior.createdBy !== actor ||
          cents(opening?.amount ?? null) !== toCents(q.openingBalance)
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
    const q = parseRequest(cashPageSchema, input);
    if (employee) await this.employeeBranch(employee, q.branchId ?? '');
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
        !!(await this.prisma.posCashTransfer.findFirst({ where: { ...where, id: q.cursor } })),
      );
    const records = await this.prisma.posCashTransfer.findMany({
      where,
      include: transferInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const items = records.slice(0, q.limit).map(mapTransfer);
    const actorIds = [
      ...new Set(
        items
          .flatMap((row) => [row.createdBy, row.receivedBy])
          .filter((actor): actor is string => !!actor && actor.startsWith('pos:'))
          .map((actor) => actor.slice(4)),
      ),
    ];
    const employees = await this.prisma.posEmployee.findMany({
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

  async transferClosedCash(
    merchantId: string,
    actor: string,
    shiftId: string,
    input: unknown,
    employee?: PosEmployeeSession,
  ): Promise<CashTransferSummary> {
    const q = parseRequest(transferCashSchema, input);
    const hash = fingerprint({ shiftId, actor, ...q });
    return this.write(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "pos_shifts" WHERE "id"=${shiftId}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
      const shift = await tx.posShift.findFirst({ where: { id: shiftId, merchantId } });
      if (!shift) throw new NotFoundException('Shift not found.');
      if (employee) {
        await this.employeeBranch(employee, shift.branchId, false, tx);
        if (shift.openedByEmployeeId !== employee.id)
          await this.employeeBranch(employee, shift.branchId, true, tx);
      }
      const prior = await tx.posCashTransfer.findFirst({
        where: { merchantId, requestId: q.requestId },
        include: transferInclude,
      });
      if (prior) {
        if (prior.fingerprint !== hash)
          throw new ConflictException('The request was already used with different values.');
        return mapTransfer(prior);
      }
      if (shift.status !== 'closed')
        throw new ConflictException('Use the cash-drop action for an open shift.');
      if (toCents(q.amount) > (await remainingClosedCash(tx, merchantId, shiftId)))
        throw new ConflictException('The amount exceeds the remaining shift custody.');
      const safe = await tx.posCashSafe.findFirst({
        where: { id: q.safeId, merchantId, branchId: shift.branchId },
      });
      if (!safe) throw new NotFoundException('Select a safe in the same branch.');
      return mapTransfer(
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
    const hash = fingerprint({ id, actor, ...q });
    return this.write(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "pos_cash_transfers" WHERE "id"=${id}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
      const transfer = await tx.posCashTransfer.findFirst({
        where: { id, merchantId },
        include: transferInclude,
      });
      if (!transfer || !transfer.destinationSafeId)
        throw new NotFoundException('Safe transfer not found.');
      if (employee) await this.employeeBranch(employee, transfer.branchId, true, tx);
      if (transfer.receiptRequestId === q.requestId && transfer.receiptFingerprint === hash)
        return mapTransfer(transfer);
      if (transfer.status !== 'pending')
        throw new ConflictException('This transfer was already received.');
      if (transfer.createdBy === actor)
        throw new ForbiddenException('A different person must confirm receipt.');
      const differs = cents(transfer.amount) !== toCents(q.receivedAmount);
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
      return mapTransfer(
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
    await this.employeeBranch(employee, branchId, true);
    return this.receive(employee.merchantId, `pos:${employee.id}`, id, input, employee);
  }

  async resolve(
    merchantId: string,
    actor: string,
    id: string,
    input: unknown,
  ): Promise<CashTransferSummary> {
    const q = parseRequest(resolveCashSchema, input);
    return this.write(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "pos_cash_transfers" WHERE "id"=${id}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
      const transfer = await tx.posCashTransfer.findFirst({ where: { merchantId, id } });
      if (!transfer) throw new NotFoundException('Transfer not found.');
      if (
        transfer.status === 'resolved' &&
        transfer.resolutionNote === q.note &&
        transfer.resolvedBy === actor
      )
        return mapTransfer(
          await tx.posCashTransfer.findUniqueOrThrow({ where: { id }, include: transferInclude }),
        );
      if (transfer.status !== 'discrepancy')
        throw new ConflictException('Only a receipt difference can be acknowledged.');
      return mapTransfer(
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
    return this.write(async (tx) => {
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
      if (cents(balance._sum.amount) + toSignedCents(signed) < 0n)
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
    const q = parseRequest(cashPageSchema, input);
    const where = { merchantId, safeId };
    if (!(await this.prisma.posCashSafe.findFirst({ where: { id: safeId, merchantId } })))
      throw new NotFoundException('Safe not found.');
    if (q.cursor)
      assertScopedCursor(
        q.cursor,
        !!(await this.prisma.posCashSafeMovement.findFirst({ where: { ...where, id: q.cursor } })),
      );
    return this.prisma.$transaction(
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
              balanceAfter: formatCents(cents(total._sum.amount)),
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

  drawerLedger(
    merchantId: string,
    shiftId: string,
    input: unknown,
  ): Promise<CursorPage<CashSafeMovementSummary>> {
    return readDrawerLedger(this.prisma, merchantId, shiftId, parseRequest(cashPageSchema, input));
  }

  async carryoverOptions(
    employee: PosEmployeeSession,
    input: unknown,
  ): Promise<CursorPage<CashDrawerSummary>> {
    const q = parseRequest(cashPageSchema, input);
    await this.employeeBranch(employee, q.branchId ?? '');
    if (
      !q.registerId ||
      !(await this.prisma.posRegister.findFirst({
        where: {
          id: q.registerId,
          merchantId: employee.merchantId,
          branchId: q.branchId!,
          active: true,
        },
      }))
    )
      throw new NotFoundException('Register not found.');
    return this.drawers(employee.merchantId, q, undefined, true);
  }

  async drawers(
    merchantId: string,
    input: unknown,
    employee?: PosEmployeeSession,
    closedOnly = false,
  ): Promise<CursorPage<CashDrawerSummary>> {
    const q: CashPageQuery = parseRequest(cashPageSchema, input);
    return this.prisma.$transaction(
      async (tx) => {
        if (employee) {
          if (!q.branchId) throw new ForbiddenException('Choose an assigned branch.');
          await this.employeeBranch(employee, q.branchId, false, tx);
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
              const amount = cents(group._sum.amount);
              if (!group.manualMovementId) allocatedAfterClose += amount;
              else trackedDrops += amount;
              if (group.status === 'pending') pending += amount;
              else if (group.destinationSafeId) received += cents(group._sum.receivedAmount);
              else carried += amount;
            }
            const expected =
              typeof live.expectedCash === 'string'
                ? live.expectedCash
                : live.expectedCash.toFixed(2);
            const drop =
              typeof live.cashDrop === 'string' ? toCents(live.cashDrop) : cents(live.cashDrop);
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
                report ? cents(report.countedCash) - allocatedAfterClose : toSignedCents(expected),
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
}

function page<T extends { id: string }>(items: T[], more: boolean): CursorPage<T> {
  return { items, nextCursor: more ? (items.at(-1)?.id ?? null) : null };
}
function mapTransfer(row: TransferRecord): CashTransferSummary {
  return {
    id: row.id,
    sourceShiftId: row.sourceShiftId,
    registerName: row.sourceShift.register.name,
    branchId: row.branchId,
    destinationName: row.destinationSafe?.name ?? row.destinationShift?.register.name ?? '',
    kind: row.destinationSafeId ? 'safe' : 'carryover',
    amount: row.amount.toFixed(2),
    receivedAmount: row.receivedAmount?.toFixed(2) ?? null,
    difference:
      row.receivedAmount === null
        ? null
        : formatCents(cents(row.receivedAmount) - cents(row.amount)),
    status: row.status as CashTransferSummary['status'],
    reference: row.reference,
    reason: row.reason,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    receivedBy: row.receivedBy,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    receiptNote: row.receiptNote,
    resolutionNote: row.resolutionNote,
    resolvedBy: row.resolvedBy,
  };
}
