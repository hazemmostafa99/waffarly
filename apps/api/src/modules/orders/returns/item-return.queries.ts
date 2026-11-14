/**
 * Shows return reports and how many items from an order can still be returned.
 */
import { NotFoundException } from '@nestjs/common';
import type {
  CursorPage,
  OwnerPosItemReturnReportRow,
  PosEmployeeSession,
  PosOrderReturnsState,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { formatCents, toCents } from '../../../common/money/money.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import {
  ownerPosItemReturnReportsSchema,
  type OwnerPosItemReturnReportsInput,
} from './pos-returns.schemas.js';

import { itemReturnInclude, toItemReturnSummary } from './item-return.mapper.js';

export async function listItemReturnReports(
  prisma: PrismaService,
  merchantId: string,
  input: OwnerPosItemReturnReportsInput,
): Promise<CursorPage<OwnerPosItemReturnReportRow>> {
  const query = parseRequest(ownerPosItemReturnReportsSchema, input);
  if (query.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: query.branchId, merchantId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found.');
  }

  const where: Prisma.PosOrderItemReturnWhereInput = {
    merchantId,
    issuedAt: { gte: new Date(query.from), lt: new Date(query.to) },
    order: {
      is: {
        source: 'pos',
        branchId: query.branchId ?? { not: null },
      },
    },
  };
  if (query.cursor) {
    const anchor = await prisma.posOrderItemReturn.findFirst({
      where: { ...where, id: query.cursor },
      select: { id: true },
    });
    assertScopedCursor(query.cursor, anchor !== null);
  }

  const records = await prisma.posOrderItemReturn.findMany({
    where,
    select: {
      id: true,
      returnNumber: true,
      orderId: true,
      reason: true,
      amount: true,
      currency: true,
      issuedAt: true,
      snapshot: true,
      order: {
        select: {
          id: true,
          orderReference: true,
          branchId: true,
          branchName: true,
          fulfillmentType: true,
          branch: { select: { name: true } },
        },
      },
      lines: {
        orderBy: [{ orderLineId: 'asc' }, { id: 'asc' }],
        select: {
          productName: true,
          variantName: true,
          quantity: true,
          disposition: true,
          amount: true,
        },
      },
    },
    orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = records.length > query.limit;
  const items = records.slice(0, query.limit).map((record) => {
    const snapshot = isJsonObject(record.snapshot) ? record.snapshot : {};
    const branchId = record.order.branchId;
    if (!branchId) throw new Error('POS item return report is missing its branch snapshot.');
    const fulfillmentType = ['dine_in', 'takeaway', 'delivery'].includes(
      record.order.fulfillmentType,
    )
      ? (record.order.fulfillmentType as OwnerPosItemReturnReportRow['fulfillmentType'])
      : 'unknown';
    return {
      id: record.id,
      returnNumber: record.returnNumber,
      orderId: record.orderId,
      orderReference:
        record.order.orderReference ?? `ORD-${record.orderId.slice(0, 8).toUpperCase()}`,
      branchId,
      branchName: record.order.branchName ?? record.order.branch?.name ?? '',
      fulfillmentType,
      issuedAt: record.issuedAt.toISOString(),
      reason: record.reason,
      referenceValue: record.amount.toFixed(2),
      currency: (record.currency || 'EGP') as 'EGP',
      issuedBy: stringFromJson(snapshot, 'issuedBy') ?? '—',
      approvedBy: stringFromJson(snapshot, 'approvedBy'),
      lines: record.lines.map((line) => ({
        productName: line.productName,
        variantName: line.variantName,
        quantity: line.quantity,
        disposition: 'waste' as const,
        referenceValue: line.amount.toFixed(2),
      })),
    };
  });
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

export async function readOrderReturnsState(
  client: Prisma.TransactionClient | PrismaService,
  employee: PosEmployeeSession,
  orderId: string,
): Promise<PosOrderReturnsState> {
  const order = await client.storefrontOrder.findFirst({
    where: {
      id: orderId,
      merchantId: employee.merchantId,
      source: 'pos',
      branchId: {
        in: employee.branches
          .filter((branch) => branch.archivedAt === null)
          .map((branch) => branch.id),
      },
    },
    select: {
      id: true,
      orderReference: true,
      status: true,
      completedAt: true,
      lines: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        include: {
          selections: { orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }] },
        },
      },
    },
  });
  if (!order) throw new NotFoundException('The POS order was not found.');
  const returned = await client.posOrderItemReturnLine.groupBy({
    by: ['orderLineId'],
    where: { merchantId: employee.merchantId, orderId },
    _sum: { quantity: true },
  });
  const returnedByLine = new Map(returned.map((row) => [row.orderLineId, row._sum.quantity ?? 0]));
  const returns = await client.posOrderItemReturn.findMany({
    where: { merchantId: employee.merchantId, orderId },
    orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
    take: 20,
    include: itemReturnInclude,
  });
  return {
    orderId,
    orderReference: order.orderReference ?? `ORD-${orderId.slice(0, 8).toUpperCase()}`,
    orderStatus: order.status,
    eligible: order.status === 'completed' && order.completedAt !== null,
    items: order.lines.map((line) => {
      const returnedQuantity = returnedByLine.get(line.id) ?? 0;
      return {
        orderLineId: line.id,
        productName: line.productName,
        variantName: line.variantName,
        selections: line.selections.map(
          (selection) =>
            `${selection.groupName}: ${selection.optionName}${selection.quantity > 1 ? ` ×${selection.quantity}` : ''}`,
        ),
        soldQuantity: line.quantity,
        returnedQuantity,
        returnableQuantity: Math.max(0, line.quantity - returnedQuantity),
        unitPrice: formatCents(toCents(line.unitPrice.toString())),
      };
    }),
    returns: returns.map((record) => toItemReturnSummary(record)),
  };
}

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringFromJson(value: Prisma.JsonObject, key: string): string | null {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : null;
}
