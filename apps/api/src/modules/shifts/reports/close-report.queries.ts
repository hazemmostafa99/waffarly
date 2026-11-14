/** Finds saved shift close reports for authorized staff and owners. */
import { toCloseReport, toOwnerCloseReportRow } from '../shift.mapper.js';
import { NotFoundException } from '@nestjs/common';

import type {
  CursorPage,
  PosEmployeeSession,
  PosShiftCloseReport as PosShiftCloseReportContract,
  PosShiftCloseReportRow,
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
import { requireShiftAccess } from '../access/shift-access.rules.js';

export async function listOwnerCloseReports(
  prisma: PrismaService,
  merchantId: string,
  input: OwnerPosShiftCloseReportsInput,
): Promise<CursorPage<PosShiftCloseReportRow>> {
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

  const records = await prisma.posShiftCloseReport.findMany({
    where,
    select: ownerCloseReportSelect,
    orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = records.length > query.limit;
  const items = records.slice(0, query.limit).map(toOwnerCloseReportRow);
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

export async function getLatestCloseReport(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  registerId: string,
): Promise<PosShiftCloseReportContract | null> {
  requireShiftAccess(employee);
  const query = parseRequest(posCurrentShiftSchema, { registerId });
  const report = await prisma.posShiftCloseReport.findFirst({
    where: {
      merchantId: employee.merchantId,
      shift: {
        registerId: query.registerId,
        status: 'closed',
        branchId: {
          in: employee.branches
            .filter((branch) => branch.archivedAt === null)
            .map((branch) => branch.id),
        },
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
  const report = await prisma.posShiftCloseReport.findFirst({
    where: {
      shiftId,
      merchantId: employee.merchantId,
      shift: {
        branchId: {
          in: employee.branches
            .filter((branch) => branch.archivedAt === null)
            .map((branch) => branch.id),
        },
      },
    },
    include: closeReportInclude,
  });
  if (!report) throw new NotFoundException('The shift close report was not found.');
  return toCloseReport(report);
}
