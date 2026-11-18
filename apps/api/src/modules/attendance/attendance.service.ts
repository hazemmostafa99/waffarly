/** Records and approves one merchant's daily attendance by calendar month. */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AttendanceMonthSummary } from '@waffarly/contracts';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { StaffService } from '../employees/index.js';
import {
  attendanceMonthStart,
  attendanceMonthSchema,
  attendancePeriodParamSchema,
  setAttendanceSchema,
} from './attendance.schemas.js';

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StaffService) private readonly staff: StaffService,
  ) {}

  async month(
    merchantId: string,
    month: string,
    branchId?: string,
  ): Promise<
    AttendanceMonthSummary & { staff: Awaited<ReturnType<StaffService['listForPeriod']>> }
  > {
    parseRequest(attendanceMonthSchema, { month, branchId });
    const monthStart = attendanceMonthStart(month);
    const monthEnd = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
    );
    const period = await this.prisma.attendancePeriod.findUnique({
      where: { merchantId_monthStart: { merchantId, monthStart } },
    });
    const staff = await this.staff.listForPeriod(merchantId, monthStart, monthEnd, branchId);
    const entries = period
      ? await this.prisma.staffAttendance.findMany({
          where: {
            merchantId,
            attendancePeriodId: period.id,
            ...(branchId ? { staffMember: { is: { branchId } } } : {}),
          },
          orderBy: [{ attendanceDate: 'asc' }, { staffMemberId: 'asc' }],
        })
      : [];
    return {
      month,
      status: period?.status === 'approved' ? 'approved' : 'draft',
      approvedBy: period?.approvedBy ?? null,
      approvedAt: period?.approvedAt?.toISOString() ?? null,
      entries: entries.map((entry) => ({
        id: entry.id,
        staffMemberId: entry.staffMemberId,
        attendanceDate: toDateOnly(entry.attendanceDate),
        status: entry.status as AttendanceMonthSummary['entries'][number]['status'],
        updatedBy: entry.updatedBy,
        updatedAt: entry.updatedAt.toISOString(),
      })),
      staff,
    };
  }

  async approvedPeriod(merchantId: string, month: string) {
    parseRequest(attendancePeriodParamSchema, { month });
    const monthStart = attendanceMonthStart(month);
    const period = await this.prisma.attendancePeriod.findUnique({
      where: { merchantId_monthStart: { merchantId, monthStart } },
    });
    if (!period || period.status !== 'approved')
      throw new ConflictException('Approve attendance for this month before creating payroll.');
    return period;
  }

  async setEntry(merchantId: string, actor: string, month: string, input: unknown) {
    const parsed = parseRequest(setAttendanceSchema, input);
    parseRequest(attendancePeriodParamSchema, { month });
    const monthStart = attendanceMonthStart(month);
    const attendanceDate = dateOnly(parsed.attendanceDate);
    if (
      Number.isNaN(attendanceDate.getTime()) ||
      toDateOnly(attendanceDate) !== parsed.attendanceDate
    )
      throw new ConflictException('Enter a valid calendar date.');
    if (
      attendanceDate.getUTCFullYear() !== monthStart.getUTCFullYear() ||
      attendanceDate.getUTCMonth() !== monthStart.getUTCMonth()
    )
      throw new ConflictException('The attendance date must be within the selected month.');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const period = await tx.attendancePeriod.upsert({
          where: { merchantId_monthStart: { merchantId, monthStart } },
          create: { merchantId, monthStart, createdBy: actor },
          update: {},
        });
        await tx.$queryRaw`SELECT "id" FROM "attendance_periods" WHERE "id"=${period.id}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
        const lockedPeriod = await tx.attendancePeriod.findFirst({
          where: { id: period.id, merchantId },
        });
        if (!lockedPeriod) throw new NotFoundException('Attendance period was not found.');
        if (lockedPeriod.status === 'approved')
          throw new ConflictException('Attendance is already approved for this month.');

        await tx.$queryRaw`SELECT "id" FROM "staff_members" WHERE "id"=${parsed.staffMemberId}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
        const staff = await tx.staffMember.findFirst({
          where: {
            id: parsed.staffMemberId,
            merchantId,
            branchId: parsed.branchId,
            startDate: { lte: attendanceDate },
            OR: [{ endDate: null }, { endDate: { gte: attendanceDate } }],
          },
          select: { id: true },
        });
        if (!staff)
          throw new NotFoundException('Employee was not active at this branch on that date.');

        const existing = await tx.staffAttendance.findUnique({
          where: {
            merchantId_staffMemberId_attendanceDate: {
              merchantId,
              staffMemberId: staff.id,
              attendanceDate,
            },
          },
        });
        const previousStatus = existing?.status ?? null;
        const newStatus = parsed.status;
        if (previousStatus === newStatus) return { changed: false };

        await tx.staffAttendanceChange.create({
          data: {
            merchantId,
            attendancePeriodId: lockedPeriod.id,
            staffMemberId: staff.id,
            attendanceDate,
            previousStatus,
            newStatus,
            reason: parsed.reason,
            changedBy: actor,
          },
        });
        if (newStatus === null) {
          if (existing) await tx.staffAttendance.delete({ where: { id: existing.id } });
        } else {
          await tx.staffAttendance.upsert({
            where: {
              merchantId_staffMemberId_attendanceDate: {
                merchantId,
                staffMemberId: staff.id,
                attendanceDate,
              },
            },
            create: {
              merchantId,
              attendancePeriodId: lockedPeriod.id,
              staffMemberId: staff.id,
              attendanceDate,
              status: newStatus,
              updatedBy: actor,
            },
            update: { status: newStatus, updatedBy: actor, attendancePeriodId: lockedPeriod.id },
          });
        }
        return { changed: true };
      });
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException('Attendance changed at the same time. Refresh and retry.');
      throw error;
    }
  }

  async approve(merchantId: string, actor: string, month: string) {
    parseRequest(attendancePeriodParamSchema, { month });
    const monthStart = attendanceMonthStart(month);
    const monthEnd = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
    );
    if (toDateOnly(monthEnd) >= cairoToday())
      throw new ConflictException('Approve attendance after the selected month has ended.');
    return this.prisma.$transaction(async (tx) => {
      const period = await tx.attendancePeriod.findUnique({
        where: { merchantId_monthStart: { merchantId, monthStart } },
      });
      if (!period) throw new NotFoundException('Save attendance for this month before approval.');
      await tx.$queryRaw`SELECT "id" FROM "attendance_periods" WHERE "id"=${period.id}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
      const lockedPeriod = await tx.attendancePeriod.findFirst({
        where: { id: period.id, merchantId },
      });
      if (lockedPeriod?.status === 'approved') return { status: 'approved' as const };
      await tx.attendancePeriod.update({
        where: { id: period.id },
        data: { status: 'approved', approvedBy: actor, approvedAt: new Date() },
      });
      return { status: 'approved' as const };
    });
  }
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function cairoToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
