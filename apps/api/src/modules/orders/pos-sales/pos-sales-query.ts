import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type {
  PosEmployeeSession,
  PosOrderPaymentStateResponse,
  PosPaymentSummary,
  StorefrontOrderSummary,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { formatCents, toCents } from '../../../common/money/money.js';
import { assertScopedCursor, type CursorPageQuery } from '../../../common/http/pagination.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { posKitchenTicketInclude } from '../kitchen/pos-kitchen.persistence.js';
import { toSummary } from '../mapping/order.mapper.js';

const orderSummaryInclude = {
  kitchenTicket: posKitchenTicketInclude,
  diningSession: { select: { table: { select: { code: true } } } },
  lines: {
    orderBy: { position: 'asc' as const },
    include: {
      selections: {
        orderBy: [{ groupPosition: 'asc' as const }, { optionPosition: 'asc' as const }],
      },
      variantAttributes: { orderBy: { position: 'asc' as const } },
    },
  },
} satisfies Prisma.StorefrontOrderInclude;

import { requirePosSellPermission } from './pos-order.rules.js';

export async function listActiveSales(
  context: { prisma: PrismaService },
  employee: PosEmployeeSession,
  input: CursorPageQuery & {
    branchId: string;
    search?: string | undefined;
    mode: 'active' | 'history';
  },
) {
  requirePosSellPermission(employee);
  if (
    !employee.branches.some((branch) => branch.id === input.branchId && branch.archivedAt === null)
  )
    throw new ForbiddenException('This employee is not assigned to the selected branch.');
  const where: Prisma.StorefrontOrderWhereInput = {
    merchantId: employee.merchantId,
    branchId: input.branchId,
    source: 'pos',
    ...(input.mode === 'active'
      ? {
          status: { notIn: ['cancelled', 'rejected'] },
          OR: [
            { checks: { some: { settledAt: null, cancelledAt: null } } },
            { fulfillmentType: 'dine_in', status: 'pending', kitchenTicket: { is: null } },
          ],
        }
      : {}),
    ...(input.search
      ? {
          AND: [
            {
              OR: [
                { orderReference: { contains: input.search, mode: 'insensitive' } },
                { customerName: { contains: input.search, mode: 'insensitive' } },
                {
                  diningSession: {
                    is: { table: { code: { contains: input.search, mode: 'insensitive' } } },
                  },
                },
              ],
            },
          ],
        }
      : {}),
  };
  if (input.cursor) {
    const anchor = await context.prisma.storefrontOrder.findFirst({
      where: {
        merchantId: employee.merchantId,
        branchId: input.branchId,
        source: 'pos',
        id: input.cursor,
      },
      select: { id: true },
    });
    assertScopedCursor(input.cursor, anchor !== null);
  }
  const orders = await context.prisma.storefrontOrder.findMany({
    where,
    include: orderSummaryInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });
  const items = orders.slice(0, input.limit).map(toSummary);
  return { items, nextCursor: orders.length > input.limit ? (items.at(-1)?.id ?? null) : null };
}

export async function getPosSaleDetails(
  context: { prisma: PrismaService },
  employee: PosEmployeeSession,
  orderId: string,
): Promise<StorefrontOrderSummary> {
  requirePosSellPermission(employee);
  const order = await context.prisma.storefrontOrder.findFirst({
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
    include: orderSummaryInclude,
  });
  if (!order) throw new NotFoundException('The POS order was not found.');
  return toSummary(order);
}

export async function getOrderPaymentState(
  context: { prisma: PrismaService },
  employee: PosEmployeeSession,
  orderId: string,
): Promise<PosOrderPaymentStateResponse> {
  requirePosSellPermission(employee);
  const order = await context.prisma.storefrontOrder.findFirst({
    where: {
      id: orderId,
      merchantId: employee.merchantId,
      OR: [
        { source: 'pos' },
        {
          source: 'storefront',
          fulfillmentType: 'pickup',
          posShiftId: { not: null },
          status: { in: ['ready', 'completed'] },
        },
      ],
      branchId: {
        in: employee.branches
          .filter((branch) => branch.archivedAt === null)
          .map((branch) => branch.id),
      },
    },
    include: {
      ...orderSummaryInclude,
      diningSession: { select: { table: { select: { code: true } } } },
      checks: {
        orderBy: { position: 'asc' },
        include: {
          allocations: {
            include: {
              orderLine: { select: { productName: true, variantName: true, position: true } },
            },
          },
          payments: {
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            include: {
              refundTenders: { select: { amount: true } },
              deliveryRemittances: { select: { amount: true } },
            },
          },
          refunds: {
            orderBy: { issuedAt: 'asc' },
            include: {
              createdBy: { select: { displayName: true } },
              approvedBy: { select: { displayName: true } },
              tenders: { orderBy: { position: 'asc' } },
            },
          },
          receipt: { select: { id: true, receiptNumber: true, issuedAt: true } },
        },
      },
    },
  });
  if (!order) throw new NotFoundException('The POS order was not found.');
  return {
    context: { order: toSummary(order), tableCode: order.diningSession?.table.code ?? null },
    orderId: order.id,
    revision: order.revision,
    total: formatCents(toCents(order.total.toString())),
    currency: order.currency as 'EGP',
    status: order.status,
    checks: order.checks.map((check) => {
      const amountCents = toCents(check.amount.toString());
      const paidCents = check.payments.reduce(
        (total, payment) => total + toCents(payment.amount.toString()),
        0n,
      );
      return {
        splitMethod: check.splitMethod as 'whole' | 'items' | 'equal' | 'custom',
        allocations: [...check.allocations]
          .sort((a, b) => a.orderLine.position - b.orderLine.position)
          .map((line) => ({
            orderLineId: line.orderLineId,
            productName: line.orderLine.productName,
            variantName: line.orderLine.variantName,
            quantity: line.quantity,
            amount: formatCents(toCents(line.amount.toString())),
          })),
        id: check.id,
        position: check.position,
        amount: formatCents(amountCents),
        paidAmount: formatCents(paidCents),
        balanceDue: formatCents(amountCents - paidCents),
        revision: check.revision,
        status: check.settledAt
          ? ('settled' as const)
          : check.cancelledAt
            ? ('cancelled' as const)
            : ('open' as const),
        settledAt: check.settledAt?.toISOString() ?? null,
        receipt: check.receipt
          ? {
              id: check.receipt.id,
              receiptNumber: check.receipt.receiptNumber,
              issuedAt: check.receipt.issuedAt.toISOString(),
            }
          : null,
        payments: check.payments.map((payment) => {
          const refundedCents = payment.refundTenders.reduce(
            (sum, refund) => sum + toCents(refund.amount.toString()),
            0n,
          );
          const amountCents = toCents(payment.amount.toString());
          return {
            id: payment.id,
            position: payment.position,
            method: payment.method as PosPaymentSummary['method'],
            amount: formatCents(amountCents),
            receivedAmount: formatCents(toCents(payment.receivedAmount.toString())),
            changeAmount: formatCents(toCents(payment.changeAmount.toString())),
            terminalReference: payment.terminalReference,
            operatorEmployeeId: payment.operatorEmployeeId,
            createdAt: payment.createdAt.toISOString(),
            refundedAmount: formatCents(refundedCents),
            refundableAmount: formatCents(amountCents - refundedCents),
            cashCustody: payment.cashCustody as 'drawer' | 'courier',
            courierCashRemaining:
              payment.cashCustody === 'courier'
                ? formatCents(
                    amountCents -
                      payment.deliveryRemittances.reduce(
                        (sum, r) => sum + toCents(r.amount.toFixed(2)),
                        0n,
                      ),
                  )
                : '0.00',
          };
        }),
        refunds: check.refunds.map((refund) => ({
          id: refund.id,
          requestId: refund.requestId,
          receiptNumber: refund.receiptNumber,
          checkId: refund.checkId,
          amount: formatCents(toCents(refund.amount.toString())),
          currency: refund.currency as 'EGP',
          reason: refund.reason,
          issuedAt: refund.issuedAt.toISOString(),
          createdByEmployeeId: refund.createdByEmployeeId,
          approvedByEmployeeId: refund.approvedByEmployeeId,
          issuedBy: refund.createdBy.displayName,
          approvedBy: refund.approvedBy?.displayName ?? null,
          tenders: refund.tenders.map((tender) => ({
            originalPaymentId: tender.originalPaymentId,
            method: tender.method as 'cash' | 'terminal',
            amount: formatCents(toCents(tender.amount.toString())),
            terminalReference: tender.terminalReference,
          })),
        })),
      };
    }),
  };
}
