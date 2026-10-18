import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CursorPage,
  PosEmployeeSession,
  PosRegisterOption,
  PosRegisterSummary,
  PosShiftSummary,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { isPosEmployeeRole } from '@waffarly/contracts';
import {
  createPosRegisterSchema,
  openPosShiftSchema,
  ownerPosRegisterListSchema,
  posCurrentShiftSchema,
  posRegisterListSchema,
  updatePosRegisterSchema,
  type OwnerPosRegisterListQuery,
} from './shifts.schemas.js';
import { normalizeOpeningFloat } from './shifts.rules.js';

const registerInclude = {
  branch: { select: { id: true, name: true } },
} satisfies Prisma.PosRegisterInclude;

const shiftInclude = {
  register: { select: { name: true } },
  openedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.PosShiftInclude;

type RegisterRecord = Prisma.PosRegisterGetPayload<{ include: typeof registerInclude }>;
type ShiftRecord = Prisma.PosShiftGetPayload<{ include: typeof shiftInclude }>;

@Injectable()
export class ShiftsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listOwnerRegisters(
    merchantId: string,
    input: OwnerPosRegisterListQuery,
  ): Promise<CursorPage<PosRegisterSummary>> {
    const query = parseRequest(ownerPosRegisterListSchema, input);
    if (query.cursor) {
      const anchor = await this.prisma.posRegister.findFirst({
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

    const records = await this.prisma.posRegister.findMany({
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

  async createRegister(
    merchantId: string,
    actor: string,
    input: unknown,
  ): Promise<PosRegisterSummary> {
    const parsed = parseRequest(createPosRegisterSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.findFirst({
          where: { id: parsed.branchId, merchantId, archivedAt: null },
          select: { id: true },
        });
        if (!branch) throw new ConflictException('Select an active branch for this register.');
        const record = await tx.posRegister.create({
          data: {
            merchantId,
            branchId: branch.id,
            name: parsed.name,
            createdBy: actor,
            updatedBy: actor,
          },
          include: registerInclude,
        });
        return toRegisterSummary(record);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A register with this name already exists at the branch.');
      }
      throw error;
    }
  }

  async updateRegister(
    merchantId: string,
    actor: string,
    registerId: string,
    input: unknown,
  ): Promise<PosRegisterSummary> {
    const parsed = parseRequest(updatePosRegisterSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "pos_registers"
          WHERE "id" = ${registerId} AND "merchantId" = ${merchantId}
          FOR UPDATE
        `;
        if (locked.length === 0) throw new NotFoundException('Register was not found.');

        const current = await tx.posRegister.findFirst({
          where: { id: registerId, merchantId },
          select: { id: true, active: true, revision: true },
        });
        if (!current) throw new NotFoundException('Register was not found.');
        if (current.revision !== parsed.revision) {
          throw new ConflictException(
            'Register changed since it was loaded. Refresh and try again.',
          );
        }
        if (current.active && !parsed.active) {
          const openShift = await tx.posShift.findFirst({
            where: { merchantId, registerId, status: { in: ['open', 'closing'] } },
            select: { id: true },
          });
          if (openShift)
            throw new ConflictException('Close the active shift before disabling this register.');
        }

        const changed = await tx.posRegister.updateMany({
          where: { id: registerId, merchantId, revision: parsed.revision },
          data: {
            name: parsed.name,
            active: parsed.active,
            revision: { increment: 1 },
            updatedBy: actor,
          },
        });
        if (changed.count !== 1) {
          throw new ConflictException(
            'Register changed since it was loaded. Refresh and try again.',
          );
        }
        const updated = await tx.posRegister.findFirst({
          where: { id: registerId, merchantId },
          include: registerInclude,
        });
        if (!updated) throw new NotFoundException('Register was not found.');
        return toRegisterSummary(updated);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A register with this name already exists at the branch.');
      }
      throw error;
    }
  }

  async listForEmployee(
    employee: PosEmployeeSession,
    input: unknown,
  ): Promise<PosRegisterOption[]> {
    this.requireShiftCapability(employee);
    const query = parseRequest(posRegisterListSchema, input);
    this.assertAssignedBranch(employee, query.branchId);
    const records = await this.prisma.posRegister.findMany({
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

  async getCurrentShift(
    employee: PosEmployeeSession,
    registerId: string,
  ): Promise<PosShiftSummary | null> {
    this.requireShiftCapability(employee);
    const query = parseRequest(posCurrentShiftSchema, { registerId });
    const register = await this.prisma.posRegister.findFirst({
      where: { id: query.registerId, merchantId: employee.merchantId },
      select: { id: true, branchId: true, active: true },
    });
    if (!register || !register.active) throw new NotFoundException('Register was not found.');
    this.assertAssignedBranch(employee, register.branchId);
    const current = await this.prisma.posShift.findFirst({
      where: { merchantId: employee.merchantId, registerId, status: 'open' },
      include: shiftInclude,
    });
    return current ? toShiftSummary(current) : null;
  }

  async lockOpenShiftForSale(
    tx: Prisma.TransactionClient,
    employee: PosEmployeeSession,
    registerId: string,
  ): Promise<{ id: string; branchId: string }> {
    if (!employee.permissions.includes('sell'))
      throw new ForbiddenException('This employee is not authorized to sell.');
    const rows = await tx.$queryRaw<Array<{ id: string; branchId: string }>>`
      SELECT s."id", s."branchId"
      FROM "pos_shifts" s
      INNER JOIN "pos_registers" r
        ON r."id" = s."registerId" AND r."merchantId" = s."merchantId"
      WHERE s."merchantId" = ${employee.merchantId}::uuid
        AND s."registerId" = ${registerId}::uuid
        AND s."status" = 'open'
        AND r."active" = true
      FOR SHARE OF s
    `;
    const shift = rows[0];
    if (!shift) throw new ConflictException('Open a register shift before confirming a sale.');
    this.assertAssignedBranch(employee, shift.branchId);
    return shift;
  }

  async recordCashSale(
    tx: Prisma.TransactionClient,
    input: {
      merchantId: string;
      shiftId: string;
      paymentId: string;
      operatorEmployeeId: string;
      amount: string;
    },
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "pos_shifts"
      WHERE "id" = ${input.shiftId}::uuid
        AND "merchantId" = ${input.merchantId}::uuid
        AND "status" = 'open'
      FOR SHARE
    `;
    if (rows.length === 0) throw new ConflictException('The register shift is no longer open.');
    await tx.posShiftCashMovement.create({
      data: {
        merchantId: input.merchantId,
        shiftId: input.shiftId,
        paymentId: input.paymentId,
        operatorEmployeeId: input.operatorEmployeeId,
        kind: 'cash_sale',
        amount: input.amount,
      },
    });
  }

  async lockOpenShiftForPayment(
    tx: Prisma.TransactionClient,
    input: { merchantId: string; shiftId: string; branchId: string },
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "pos_shifts"
      WHERE "id" = ${input.shiftId}::uuid
        AND "merchantId" = ${input.merchantId}::uuid
        AND "branchId" = ${input.branchId}::uuid
        AND "status" = 'open'
      FOR SHARE
    `;
    if (rows.length === 0)
      throw new ConflictException('The register shift for this order is not open.');
  }

  async openShift(employee: PosEmployeeSession, input: unknown): Promise<PosShiftSummary> {
    this.requireShiftCapability(employee);
    const parsed = parseRequest(openPosShiftSchema, input);
    const openingFloat = normalizeOpeningFloat(parsed.openingFloat);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const prior = await tx.posShift.findFirst({
          where: { merchantId: employee.merchantId, openRequestId: parsed.requestId },
          include: shiftInclude,
        });
        if (prior) return toMatchingRetry(prior, employee, parsed.registerId, openingFloat);

        const locked = await tx.$queryRaw<Array<{ id: string; branchId: string; active: boolean }>>`
          SELECT "id", "branchId", "active"
          FROM "pos_registers"
          WHERE "id" = ${parsed.registerId} AND "merchantId" = ${employee.merchantId}
          FOR UPDATE
        `;
        const register = locked[0];
        if (!register || !register.active) throw new NotFoundException('Register was not found.');
        this.assertAssignedBranch(employee, register.branchId);

        // Another identical request may have committed while this transaction waited on the register lock.
        const committedRetry = await tx.posShift.findFirst({
          where: { merchantId: employee.merchantId, openRequestId: parsed.requestId },
          include: shiftInclude,
        });
        if (committedRetry) {
          return toMatchingRetry(committedRetry, employee, parsed.registerId, openingFloat);
        }

        const current = await tx.posShift.findFirst({
          where: {
            merchantId: employee.merchantId,
            registerId: register.id,
            status: { in: ['open', 'closing'] },
          },
          select: { id: true },
        });
        if (current) throw new ConflictException('A shift is already open on this register.');

        const record = await tx.posShift.create({
          data: {
            merchantId: employee.merchantId,
            branchId: register.branchId,
            registerId: register.id,
            openRequestId: parsed.requestId,
            openedByEmployeeId: employee.id,
            openingFloat,
            currency: 'EGP',
            status: 'open',
          },
          include: shiftInclude,
        });
        return toShiftSummary(record);
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const prior = await this.prisma.posShift.findFirst({
        where: { merchantId: employee.merchantId, openRequestId: parsed.requestId },
        include: shiftInclude,
      });
      if (prior) return toMatchingRetry(prior, employee, parsed.registerId, openingFloat);
      throw new ConflictException('A shift is already open on this register.');
    }
  }

  private assertAssignedBranch(employee: PosEmployeeSession, branchId: string): void {
    if (!employee.branches.some((branch) => branch.id === branchId)) {
      throw new ForbiddenException('This employee is not assigned to the selected branch.');
    }
  }

  private requireShiftCapability(employee: PosEmployeeSession): void {
    if (
      !isPosEmployeeRole(employee.role) ||
      !employee.permissions.includes('open_register_shift')
    ) {
      throw new ForbiddenException('This employee is not authorized to use register shifts.');
    }
  }
}

function toMatchingRetry(
  shift: ShiftRecord,
  employee: PosEmployeeSession,
  registerId: string,
  openingFloat: string,
): PosShiftSummary {
  if (!employee.branches.some((branch) => branch.id === shift.branchId)) {
    throw new ForbiddenException('This employee is not assigned to the selected branch.');
  }
  if (
    shift.registerId !== registerId ||
    shift.openedByEmployeeId !== employee.id ||
    shift.openingFloat.toFixed(2) !== openingFloat
  ) {
    throw new ConflictException('This request ID was already used for a different shift opening.');
  }
  if (shift.status !== 'open') {
    throw new ConflictException('This shift opening request has already been resolved.');
  }
  return toShiftSummary(shift);
}

function toRegisterSummary(register: RegisterRecord): PosRegisterSummary {
  return {
    id: register.id,
    branchId: register.branchId,
    branchName: register.branch.name,
    name: register.name,
    active: register.active,
    revision: register.revision,
  };
}

function toShiftSummary(shift: ShiftRecord): PosShiftSummary {
  if (shift.status !== 'open') throw new ConflictException('This shift is no longer open.');
  return {
    id: shift.id,
    branchId: shift.branchId,
    registerId: shift.registerId,
    registerName: shift.register.name,
    openedByEmployeeId: shift.openedBy.id,
    openedByName: shift.openedBy.displayName,
    openRequestId: shift.openRequestId,
    openingFloat: shift.openingFloat.toFixed(2),
    currency: 'EGP',
    openedAt: shift.openedAt.toISOString(),
    status: 'open',
  };
}
