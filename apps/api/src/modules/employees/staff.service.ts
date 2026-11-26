/** Manages HR staff records independently from optional POS login accounts. */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CursorPage, StaffMemberSummary, StaffPayRateSummary } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  createStaffPayRateSchema,
  createStaffSchema,
  listStaffSchema,
  updateStaffSchema,
  type StaffListQuery,
} from './staff.schemas.js';

const staffInclude = {
  branch: { select: { id: true, name: true } },
  posEmployee: { select: { id: true, username: true } },
  payRates: { orderBy: { effectiveDate: 'desc' as const } },
} satisfies Prisma.StaffMemberInclude;

@Injectable()
export class StaffService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(merchantId: string, input: StaffListQuery): Promise<CursorPage<StaffMemberSummary>> {
    const query = parseRequest(listStaffSchema, input);
    if (query.cursor) {
      const anchor = await this.prisma.staffMember.findFirst({
        where: { id: query.cursor, merchantId },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }

    const records = await this.prisma.staffMember.findMany({
      where: {
        merchantId,
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.status === 'active'
          ? { active: true }
          : query.status === 'inactive'
            ? { active: false }
            : {}),
        ...(query.search
          ? {
              OR: [
                { displayName: { contains: query.search, mode: 'insensitive' } },
                { employeeNumber: { contains: query.search, mode: 'insensitive' } },
                { jobTitle: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: staffInclude,
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = records.length > query.limit;
    const items = records.slice(0, query.limit).map(toStaffSummary);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async listForPeriod(
    merchantId: string,
    monthStart: Date,
    monthEnd: Date,
    branchId?: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const records = await db.staffMember.findMany({
      where: {
        merchantId,
        ...(branchId ? { branchId } : {}),
        startDate: { lte: monthEnd },
        OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
      },
      include: staffInclude,
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: 1001,
    });
    if (records.length > 1000)
      throw new ConflictException('This period includes too many employees to display at once.');
    return records.map(toStaffSummary);
  }

  async posEmployeeOptions(merchantId: string, branchId: string) {
    await this.assertActiveBranch(this.prisma, merchantId, branchId);
    return this.prisma.posEmployee.findMany({
      where: { merchantId, branchId, active: true, staffMember: null, ownerAccountId: null },
      select: { id: true, username: true, displayName: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: 100,
    });
  }

  async create(merchantId: string, actor: string, input: unknown): Promise<StaffMemberSummary> {
    const parsed = parseRequest(createStaffSchema, input);
    assertDate(parsed.startDate);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertActiveBranch(tx, merchantId, parsed.branchId);
        await this.assertPosEmployeeAvailable(
          tx,
          merchantId,
          parsed.posEmployeeId ?? null,
          parsed.branchId,
        );
        const staff = await tx.staffMember.create({
          data: {
            merchantId,
            branchId: parsed.branchId,
            posEmployeeId: parsed.posEmployeeId ?? null,
            employeeNumber: parsed.employeeNumber ?? null,
            displayName: parsed.displayName,
            jobTitle: parsed.jobTitle,
            phone: parsed.phone ?? null,
            startDate: dateOnly(parsed.startDate),
            createdBy: actor,
            updatedBy: actor,
            payRates: {
              create: {
                effectiveDate: dateOnly(parsed.startDate),
                basis: parsed.payBasis,
                amount: parsed.payAmount,
                createdBy: actor,
              },
            },
          },
          include: staffInclude,
        });
        return toStaffSummary(staff);
      });
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException('Employee number or linked POS account is already in use.');
      throw error;
    }
  }

  async update(
    merchantId: string,
    actor: string,
    id: string,
    input: unknown,
  ): Promise<StaffMemberSummary> {
    const parsed = parseRequest(updateStaffSchema, input);
    assertDate(parsed.startDate);
    if (parsed.endDate) assertDate(parsed.endDate);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "staff_members" WHERE "id"=${id}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
        const current = await tx.staffMember.findFirst({
          where: { id, merchantId },
          select: { revision: true, posEmployeeId: true, branchId: true },
        });
        if (!current) throw new NotFoundException('Employee was not found.');
        if (current.revision !== parsed.revision)
          throw new ConflictException(
            'Employee changed since it was loaded. Refresh and try again.',
          );

        if (current.branchId !== parsed.branchId) {
          const [attendanceCount, attendanceChangeCount, payrollLineCount, advanceCount] =
            await Promise.all([
              tx.staffAttendance.count({ where: { merchantId, staffMemberId: id } }),
              tx.staffAttendanceChange.count({ where: { merchantId, staffMemberId: id } }),
              tx.staffPayrollLine.count({ where: { merchantId, staffMemberId: id } }),
              tx.staffAdvance.count({ where: { merchantId, staffMemberId: id } }),
            ]);
          if (attendanceCount + attendanceChangeCount + payrollLineCount + advanceCount > 0)
            throw new ConflictException(
              'Branch assignment cannot change after attendance, payroll or advance history is recorded.',
            );
        }

        await this.assertActiveBranch(tx, merchantId, parsed.branchId);
        await this.assertPosEmployeeAvailable(
          tx,
          merchantId,
          parsed.posEmployeeId ?? null,
          parsed.branchId,
          id,
          current.posEmployeeId === (parsed.posEmployeeId ?? null),
        );
        const changed = await tx.staffMember.updateMany({
          where: { id, merchantId, revision: parsed.revision },
          data: {
            branchId: parsed.branchId,
            posEmployeeId: parsed.posEmployeeId ?? null,
            employeeNumber: parsed.employeeNumber ?? null,
            displayName: parsed.displayName,
            jobTitle: parsed.jobTitle,
            phone: parsed.phone ?? null,
            startDate: dateOnly(parsed.startDate),
            endDate: parsed.endDate ? dateOnly(parsed.endDate) : null,
            active: parsed.active,
            revision: { increment: 1 },
            updatedBy: actor,
          },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'Employee changed since it was loaded. Refresh and try again.',
          );
        const saved = await tx.staffMember.findFirst({
          where: { id, merchantId },
          include: staffInclude,
        });
        if (!saved) throw new NotFoundException('Employee was not found.');
        return toStaffSummary(saved);
      });
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException('Employee number or linked POS account is already in use.');
      throw error;
    }
  }

  async addPayRate(merchantId: string, actor: string, id: string, input: unknown) {
    const parsed = parseRequest(createStaffPayRateSchema, input);
    assertDate(parsed.effectiveDate);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const staff = await tx.staffMember.findFirst({
          where: { id, merchantId },
          include: { payRates: { orderBy: { effectiveDate: 'desc' }, take: 1 } },
        });
        if (!staff) throw new NotFoundException('Employee was not found.');
        const lastRate = staff.payRates[0];
        if (parsed.effectiveDate < toDateOnly(staff.startDate))
          throw new ConflictException('A pay rate cannot start before the employee start date.');
        if (lastRate && parsed.effectiveDate <= toDateOnly(lastRate.effectiveDate))
          throw new ConflictException('A new pay rate must start after the current rate date.');
        return toPayRateSummary(
          await tx.staffPayRate.create({
            data: {
              merchantId,
              staffMemberId: id,
              effectiveDate: dateOnly(parsed.effectiveDate),
              basis: parsed.basis,
              amount: parsed.amount,
              createdBy: actor,
            },
          }),
        );
      });
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException('A pay rate is already recorded for this effective date.');
      throw error;
    }
  }

  private async assertActiveBranch(
    db: PrismaService | Prisma.TransactionClient,
    merchantId: string,
    branchId: string,
  ) {
    const branch = await db.branch.findFirst({
      where: { id: branchId, merchantId, archivedAt: null },
      select: { id: true },
    });
    if (!branch) throw new ConflictException('Choose an active branch in this business.');
  }

  private async assertPosEmployeeAvailable(
    db: PrismaService | Prisma.TransactionClient,
    merchantId: string,
    posEmployeeId: string | null,
    branchId: string,
    currentStaffId?: string,
    preserveExistingLink = false,
  ) {
    if (!posEmployeeId) return;
    const posEmployee = await db.posEmployee.findFirst({
      where: {
        id: posEmployeeId,
        merchantId,
        branchId,
        ownerAccountId: null,
        ...(!preserveExistingLink ? { active: true } : {}),
        ...(currentStaffId
          ? preserveExistingLink
            ? { staffMember: { is: { id: currentStaffId } } }
            : {
                OR: [
                  { staffMember: { is: { id: currentStaffId } } },
                  { staffMember: { is: null } },
                ],
              }
          : { staffMember: null }),
      },
      select: { id: true },
    });
    if (!posEmployee)
      throw new ConflictException('Choose an unlinked POS account assigned to this branch.');
  }
}

function toStaffSummary(staff: {
  id: string;
  employeeNumber: string | null;
  displayName: string;
  jobTitle: string;
  phone: string | null;
  startDate: Date;
  endDate: Date | null;
  active: boolean;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  branch: { id: string; name: string };
  posEmployee: { id: string; username: string } | null;
  payRates: Array<{
    id: string;
    effectiveDate: Date;
    basis: string;
    amount: { toFixed: (digits: number) => string };
  }>;
}): StaffMemberSummary {
  return {
    id: staff.id,
    employeeNumber: staff.employeeNumber,
    displayName: staff.displayName,
    jobTitle: staff.jobTitle,
    phone: staff.phone,
    startDate: toDateOnly(staff.startDate),
    endDate: staff.endDate ? toDateOnly(staff.endDate) : null,
    active: staff.active,
    revision: staff.revision,
    branch: staff.branch,
    posEmployee: staff.posEmployee,
    payRates: staff.payRates.map(toPayRateSummary),
    createdAt: staff.createdAt.toISOString(),
    updatedAt: staff.updatedAt.toISOString(),
  };
}

function toPayRateSummary(rate: {
  id: string;
  effectiveDate: Date;
  basis: string;
  amount: { toFixed: (digits: number) => string };
}): StaffPayRateSummary {
  return {
    id: rate.id,
    effectiveDate: toDateOnly(rate.effectiveDate),
    basis: rate.basis as StaffPayRateSummary['basis'],
    amount: rate.amount.toFixed(2),
  };
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function assertDate(value: string): void {
  const date = dateOnly(value);
  if (Number.isNaN(date.getTime()) || toDateOnly(date) !== value)
    throw new ConflictException('Enter a valid calendar date.');
}
