/** Finds saved shift close reports for authorized staff and owners. */
import { toCloseReport, toOwnerCloseReportRow } from '../shift.mapper.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import type {
  OwnerShiftReportPage,
  PosEmployeeSession,
  PosShiftCloseReport as PosShiftCloseReportContract,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import {
  ownerPosShiftCloseReportsSchema,
  posCurrentShiftSchema,
  type OwnerPosShiftCloseReportsInput,
} from '../shifts.schemas.js';

import { closeReportInclude, ownerCloseReportSelect } from '../shift-records.js';
import { assertPosRegisterAssignment, requireShiftAccess } from '../access/shift-access.rules.js';

export async function listOwnerCloseReports(
  prisma: PrismaService,
  merchantId: string,
  input: OwnerPosShiftCloseReportsInput,
): Promise<OwnerShiftReportPage> {
  const query = parseRequest(ownerPosShiftCloseReportsSchema, input);
  const branch = query.branchId
    ? await prisma.branch.findFirst({
        where: { id: query.branchId, merchantId, archivedAt: null },
        select: { id: true },
      })
    : null;
  if (query.branchId && !branch) throw new NotFoundException('Branch not found.');

  const from = new Date(query.from);
  const to = new Date(query.to);
  const where: Prisma.PosShiftCloseReportWhereInput = {
    merchantId,
    closedAt: { gte: from, lt: to },
    ...(branch ? { shift: { is: { branchId: branch.id } } } : {}),
  };
  if (query.cursor) {
    const anchor = await prisma.posShiftCloseReport.findFirst({
      where: { ...where, id: query.cursor },
      select: { id: true },
    });
    assertScopedCursor(query.cursor, anchor !== null);
  }

  const [records, totals, matchedCount] = await prisma.$transaction(
    [
      prisma.posShiftCloseReport.findMany({
        where,
        select: ownerCloseReportSelect,
        orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      prisma.posShiftCloseReport.aggregate({
        where,
        _count: { _all: true },
        _sum: { variance: true },
      }),
      prisma.posShiftCloseReport.count({ where: { ...where, variance: 0 } }),
    ],
    { isolationLevel: 'RepeatableRead' },
  );
  const summary = {
    closedCount: totals._count._all,
    matchedCount,
    varianceCount: totals._count._all - matchedCount,
    netVariance: totals._sum.variance?.toFixed(2) ?? '0.00',
  };
  const hasMore = records.length > query.limit;
  const items = records.slice(0, query.limit).map(toOwnerCloseReportRow);
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null, summary };
}

export async function getLatestCloseReport(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  registerId: string,
): Promise<PosShiftCloseReportContract | null> {
  requireShiftAccess(employee);
  const query = parseRequest(posCurrentShiftSchema, { registerId });
  assertPosRegisterAssignment(employee, query.registerId);
  const report = await prisma.posShiftCloseReport.findFirst({
    where: {
      merchantId: employee.merchantId,
      shift: {
        registerId: query.registerId,
        status: 'closed',
        branchId: employee.branch.id,
        register: { merchantId: employee.merchantId },
      },
    },
    include: closeReportInclude,
    orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
  });
  return report ? toCloseReport(report) : null;
}

export async function getCloseReport(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  shiftId: string,
): Promise<PosShiftCloseReportContract> {
  requireShiftAccess(employee);
  // Shift ids are not register-scoped, so an unpaired browser could otherwise read any register's report.
  if (employee.deviceRegister === null) {
    throw new ForbiddenException('Pair this browser with a POS register before continuing.');
  }
  const report = await prisma.posShiftCloseReport.findFirst({
    where: {
      shiftId,
      merchantId: employee.merchantId,
      shift: {
        is: {
          branchId: employee.branch.id,
          ...(employee.deviceRegister ? { registerId: employee.deviceRegister.id } : {}),
        },
      },
    },
    include: closeReportInclude,
  });
  if (!report) throw new NotFoundException('The shift close report was not found.');
  return toCloseReport(report);
}
