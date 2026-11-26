/**
 * Finds cashier sales and shows their saved items, bills, payments and refunds.
 */
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  PosEmployeeSession,
  PosOrderPaymentStateResponse,
  PosPaymentSummary,
  StorefrontOrderStatus,
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

/**
 * The order history is the branch's full record: cashier sales plus every Waffarly
 * marketplace and storefront order. Active sales stay cashier-only bills.
 */
function posOrderSourceWhere(mode: 'active' | 'history'): { source?: 'pos' } {
  return mode === 'history' ? {} : { source: 'pos' };
}

import { requirePosSellPermission } from './pos-order.rules.js';

@Injectable()
export class PosOrderQueryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listActiveSales(
    employee: PosEmployeeSession,
    input: CursorPageQuery & {
      branchId: string;
      search?: string | undefined;
      mode: 'active' | 'history';
      status?: StorefrontOrderStatus | undefined;
      fulfillmentType?: 'dine_in' | 'takeaway' | 'delivery' | 'pickup' | undefined;
      settlement?: 'open' | 'settled' | undefined;
      createdFrom?: Date | undefined;
      createdTo?: Date | undefined;
    },
  ) {
    requirePosSellPermission(employee);
    if (employee.branch.id !== input.branchId || employee.branch.archivedAt !== null)
      throw new ForbiddenException('This employee is not assigned to the selected branch.');
    const search = input.search?.trim();
    const orderNumberCandidate = search?.replace(/^#/, '');
    const branchOrderNumber =
      orderNumberCandidate && /^\d+$/.test(orderNumberCandidate)
        ? Number(orderNumberCandidate)
        : null;
    const branchOrderNumberSearch =
      branchOrderNumber !== null && Number.isSafeInteger(branchOrderNumber)
        ? branchOrderNumber
        : null;
    const sourceWhere = posOrderSourceWhere(input.mode);
    const where: Prisma.StorefrontOrderWhereInput = {
      merchantId: employee.merchantId,
      branchId: input.branchId,
      ...sourceWhere,
      ...(input.status
        ? { status: input.status }
        : input.mode === 'active'
          ? { status: { notIn: ['cancelled', 'rejected'] } }
          : {}),
      ...(input.mode === 'active'
        ? {
            OR: [
              { checks: { some: { settledAt: null, cancelledAt: null } } },
              { fulfillmentType: 'dine_in', status: 'pending', kitchenTicket: { is: null } },
            ],
          }
        : {}),
      // Website pickup orders are collected at the counter, so cashiers see them as takeaway.
      ...(input.fulfillmentType === 'takeaway' || input.fulfillmentType === 'pickup'
        ? { fulfillmentType: { in: ['takeaway', 'pickup'] } }
        : input.fulfillmentType
          ? { fulfillmentType: input.fulfillmentType }
          : {}),
      ...(input.settlement === 'open'
        ? { checks: { some: { settledAt: null, cancelledAt: null } } }
        : input.settlement === 'settled'
          ? {
              checks: {
                some: { settledAt: { not: null } },
                none: { settledAt: null, cancelledAt: null },
              },
            }
          : {}),
      ...(input.createdFrom || input.createdTo
        ? {
            createdAt: {
              ...(input.createdFrom ? { gte: input.createdFrom } : {}),
              ...(input.createdTo ? { lte: input.createdTo } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { orderReference: { contains: search, mode: 'insensitive' } },
                  ...(branchOrderNumberSearch !== null
                    ? [{ branchOrderNumber: branchOrderNumberSearch }]
                    : []),
                  { customerName: { contains: search, mode: 'insensitive' } },
                  {
                    diningSession: {
                      is: { table: { code: { contains: search, mode: 'insensitive' } } },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };
    if (input.cursor) {
      const anchor = await this.prisma.storefrontOrder.findFirst({
        where: {
          merchantId: employee.merchantId,
          branchId: input.branchId,
          ...sourceWhere,
          id: input.cursor,
        },
        select: { id: true },
      });
      assertScopedCursor(input.cursor, anchor !== null);
    }
    const orders = await this.prisma.storefrontOrder.findMany({
      where,
      include: orderSummaryInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const items = orders.slice(0, input.limit).map(toSummary);
    return { items, nextCursor: orders.length > input.limit ? (items.at(-1)?.id ?? null) : null };
  }

  async detail(employee: PosEmployeeSession, orderId: string): Promise<StorefrontOrderSummary> {
    requirePosSellPermission(employee);
    // Orders of an archived branch stay hidden even if a session outlives the archive.
    if (employee.branch.archivedAt !== null) throw new NotFoundException('The POS order was not found.');
    const order = await this.prisma.storefrontOrder.findFirst({
      where: {
        id: orderId,
        merchantId: employee.merchantId,
        source: 'pos',
        branchId: employee.branch.id,
      },
      include: orderSummaryInclude,
    });
    if (!order) throw new NotFoundException('The POS order was not found.');
    return toSummary(order);
  }

  async paymentState(
    employee: PosEmployeeSession,
    orderId: string,
  ): Promise<PosOrderPaymentStateResponse> {
    requirePosSellPermission(employee);
    // Orders of an archived branch stay hidden even if a session outlives the archive.
    if (employee.branch.archivedAt !== null) throw new NotFoundException('The POS order was not found.');
    const order = await this.prisma.storefrontOrder.findFirst({
      where: {
        id: orderId,
        merchantId: employee.merchantId,
        // Read-only view for every branch order in the cumulative history; payment
        // and refund commands keep their own source and shift checks.
        branchId: employee.branch.id,
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
                lines: { orderBy: { id: 'asc' } },
              },
            },
            receipt: { select: { id: true, receiptNumber: true, issuedAt: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('The POS order was not found.');
    const refundedLineQuantities = await this.prisma.posOrderRefundLine.groupBy({
      by: ['orderLineId'],
      where: { merchantId: employee.merchantId, orderId },
      _sum: { quantity: true },
    });
    const refundedByLine = new Map(
      refundedLineQuantities.map((line) => [line.orderLineId, line._sum.quantity ?? 0]),
    );
    return {
      context: { order: toSummary(order), tableCode: order.diningSession?.table.code ?? null },
      orderId: order.id,
      revision: order.revision,
      total: formatCents(toCents(order.total.toString())),
      currency: order.currency as 'EGP',
      status: order.status,
      orderLines: order.lines.map((line) => ({
        orderLineId: line.id,
        productName: line.productName,
        variantName: line.variantName,
        quantity: line.quantity,
        lineTotal: line.recognizedRevenueAmount?.toFixed(2) ?? line.lineTotal.toFixed(2),
        refundableQuantity: Math.max(0, line.quantity - (refundedByLine.get(line.id) ?? 0)),
        refundedQuantity: refundedByLine.get(line.id) ?? 0,
      })),
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
            ...(refund.lines.length
              ? {
                  lineAllocations: refund.lines.map((line) => ({
                    orderLineId: line.orderLineId,
                    productName: line.productName,
                    variantName: line.variantName,
                    quantity: line.quantity,
                    revenueReversalAmount: line.revenueReversalAmount.toFixed(2),
                  })),
                }
              : {}),
          })),
        };
      }),
    };
  }
}
