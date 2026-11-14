/**
 * Builds the delivery work lists and shows what was delivered, collected and still owed.
 */
import { NotFoundException } from '@nestjs/common';

import {
  type CursorPage,
  type PosDeliverySummary,
  type PosEmployeeSession,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { formatCents, toCents } from '../../../common/money/money.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { readDeliveryBalances } from '../../shifts/index.js';
import { posDeliveryListSchema } from './pos-delivery.schemas.js';

import { assertDeliveryBranchAccess } from './delivery-access.rules.js';

export async function listDeliveryQueue(
  db: PrismaService,
  employee: PosEmployeeSession,
  input: unknown,
): Promise<CursorPage<PosDeliverySummary>> {
  const query = parseRequest(posDeliveryListSchema, input);
  assertDeliveryBranchAccess(employee, query.branchId);
  if (
    query.cursor &&
    !(
      await readDeliveryBalances(db, employee.merchantId, {
        branchId: query.branchId,
        orderId: query.cursor,
        pendingOnly: !query.includeResolved,
        limit: 1,
      })
    ).length
  )
    throw new NotFoundException('Delivery cursor was not found in this branch.');
  const rows = await readDeliveryBalances(db, employee.merchantId, {
    ...query,
    pendingOnly: !query.includeResolved,
    limit: query.limit + 1,
  });
  const items = await buildDeliverySummaries(db, employee, rows.slice(0, query.limit));
  return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.orderId : null };
}

export async function listReadyDeliveries(
  db: PrismaService,
  employee: PosEmployeeSession,
  input: unknown,
) {
  const query = parseRequest(posDeliveryListSchema, input);
  assertDeliveryBranchAccess(employee, query.branchId);
  const where: Prisma.StorefrontOrderWhereInput = {
    merchantId: employee.merchantId,
    branchId: query.branchId,
    source: 'pos',
    fulfillmentType: 'delivery',
    status: 'ready',
    delivery: { is: null },
  };
  if (
    query.cursor &&
    !(await db.storefrontOrder.findFirst({
      where: { ...where, id: query.cursor },
      select: { id: true },
    }))
  )
    throw new NotFoundException('Delivery cursor was not found in this branch.');
  const rows = await db.storefrontOrder.findMany({
    where: { ...where, ...(query.cursor ? { id: { lt: query.cursor } } : {}) },
    orderBy: { id: 'desc' },
    take: query.limit + 1,
    select: { id: true, orderReference: true, revision: true, total: true, customerName: true },
  });
  return {
    items: rows.slice(0, query.limit).map((row) => ({ ...row, total: row.total.toFixed(2) })),
    nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.id : null,
  };
}

export async function getDeliverySummary(
  db: PrismaService,
  employee: PosEmployeeSession,
  orderId: string,
  tx: Prisma.TransactionClient | PrismaService = db,
): Promise<PosDeliverySummary> {
  const [row] = await readDeliveryBalances(tx, employee.merchantId, {
    orderId,
    pendingOnly: false,
    limit: 1,
  });
  if (!row) throw new NotFoundException('The delivery was not found.');
  assertDeliveryBranchAccess(employee, row.branchId);
  return (await buildDeliverySummaries(db, employee, [row], tx))[0]!;
}

async function buildDeliverySummaries(
  db: PrismaService,
  employee: PosEmployeeSession,
  rows: Awaited<ReturnType<typeof readDeliveryBalances>>,
  tx: Prisma.TransactionClient | PrismaService = db,
): Promise<PosDeliverySummary[]> {
  if (!rows.length) return [];
  const orderReferences = await tx.storefrontOrder.findMany({
    where: { merchantId: employee.merchantId, id: { in: rows.map((row) => row.orderId) } },
    select: { id: true, orderReference: true },
  });
  const references = new Map(orderReferences.map((order) => [order.id, order.orderReference]));
  const allChecks = await tx.posOrderCheck.findMany({
    where: {
      merchantId: employee.merchantId,
      orderId: { in: rows.map((row) => row.orderId) },
      cancelledAt: null,
    },
    select: {
      id: true,
      orderId: true,
      position: true,
      amount: true,
      payments: {
        select: {
          id: true,
          amount: true,
          cashCustody: true,
          deliveryRemittances: {
            select: {
              amount: true,
              shiftId: true,
              createdAt: true,
              operator: { select: { displayName: true } },
            },
          },
        },
      },
    },
    orderBy: { position: 'asc' },
  });
  return rows.map((row) => {
    const checks = allChecks.filter((check) => check.orderId === row.orderId);
    return {
      orderId: row.orderId,
      orderReference: references.get(row.orderId) ?? null,
      branchId: row.branchId,
      sourceShiftId: row.sourceShiftId,
      followupShiftId: row.followupShiftId,
      revision: row.revision,
      orderRevision: row.orderRevision,
      orderStatus: row.orderStatus,
      courierName: row.courierName,
      status: row.status,
      failureReason: row.failureReason,
      custodianName: row.custodianName,
      custodianEmployeeId: row.custodianEmployeeId,
      customerDue: formatCents(toCents(row.customerDue)),
      courierCashHeld: formatCents(toCents(row.courierCashHeld)),
      dispatchedAt: row.dispatchedAt.toISOString(),
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      checks: checks.map((check) => ({
        id: check.id,
        position: check.position,
        balanceDue: formatCents(
          toCents(check.amount.toFixed(2)) -
            check.payments.reduce((sum, p) => sum + toCents(p.amount.toFixed(2)), 0n),
        ),
      })),
      courierPayments: checks.flatMap((check) =>
        check.payments
          .filter((p) => p.cashCustody === 'courier')
          .map((p) => ({
            id: p.id,
            amount: p.amount.toFixed(2),
            remaining: formatCents(
              toCents(p.amount.toFixed(2)) -
                p.deliveryRemittances.reduce((sum, r) => sum + toCents(r.amount.toFixed(2)), 0n),
            ),
          })),
      ),
      remittances: checks.flatMap((check) =>
        check.payments.flatMap((payment) =>
          payment.deliveryRemittances.map((r) => ({
            amount: r.amount.toFixed(2),
            shiftId: r.shiftId,
            operatorName: r.operator.displayName,
            receivedAt: r.createdAt.toISOString(),
          })),
        ),
      ),
    };
  });
}
