/** Finds saved receipts and shows receipt history for an assigned branch. */
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PosEmployeeSession, PosReceipt, PosReceiptHistoryPage } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor, type CursorPageQuery } from '../../../common/http/pagination.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { requireEmployeePermission } from '../../auth/index.js';
import { parseStoredPosReceipt } from './order-receipts.js';

@Injectable()
export class PosReceiptQueryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCheckReceipt(
    employee: PosEmployeeSession,
    orderId: string,
    checkId: string,
  ): Promise<PosReceipt> {
    requireEmployeePermission(employee, 'view_receipts');
    const order = await this.prisma.storefrontOrder.findFirst({
      where: {
        id: orderId,
        merchantId: employee.merchantId,
        OR: [
          { source: 'pos' },
          {
            source: { in: ['waffarly', 'storefront'] },
            // Website pickups and dispatched website deliveries are collected on a shift.
            fulfillmentType: { in: ['pickup', 'delivery'] },
            posShiftId: { not: null },
            status: { in: ['ready', 'completed'] },
          },
        ],
        branchId: employee.branch.id,
      },
      select: {
        branchOrderNumber: true,
        source: true,
        checks: {
          where: { id: checkId, merchantId: employee.merchantId },
          select: { receipt: { select: { snapshot: true } } },
        },
      },
    });
    const snapshot = order?.checks[0]?.receipt?.snapshot;
    if (!snapshot || !order) throw new NotFoundException('The POS receipt was not found.');
    const receipt = parseStoredPosReceipt(snapshot);
    const branchOrderNumber = receipt.branchOrderNumber ?? order.branchOrderNumber;
    return {
      ...receipt,
      ...(order.source === 'waffarly' || order.source === 'storefront' || order.source === 'pos'
        ? { source: order.source }
        : {}),
      // Same shape as a freshly issued receipt: the number is left out when there is none.
      ...(branchOrderNumber != null ? { branchOrderNumber } : {}),
    };
  }

  async listReceipts(
    employee: PosEmployeeSession,
    input: CursorPageQuery & { branchId: string },
  ): Promise<PosReceiptHistoryPage> {
    requireEmployeePermission(employee, 'view_receipts');
    if (employee.branch.id !== input.branchId) {
      throw new ForbiddenException('This employee is not assigned to the selected branch.');
    }
    const scopedReceiptWhere: Prisma.PosCheckReceiptWhereInput = {
      merchantId: employee.merchantId,
      order: {
        is: { source: { in: ['waffarly', 'storefront', 'pos'] }, branchId: input.branchId },
      },
    };
    const anchor = input.cursor
      ? await this.prisma.posCheckReceipt.findFirst({
          where: { ...scopedReceiptWhere, id: input.cursor },
          select: { id: true },
        })
      : null;
    if (input.cursor) assertScopedCursor(input.cursor, anchor !== null);
    const receipts = await this.prisma.posCheckReceipt.findMany({
      where: scopedReceiptWhere,
      select: {
        id: true,
        receiptNumber: true,
        issuedAt: true,
        orderId: true,
        checkId: true,
        snapshot: true,
        order: { select: { branchOrderNumber: true, source: true } },
      },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = receipts.length > input.limit;
    const items = receipts.slice(0, input.limit).map((row) => {
      const snapshot = parseStoredPosReceipt(row.snapshot);
      return {
        id: row.id,
        receiptNumber: row.receiptNumber,
        issuedAt: row.issuedAt.toISOString(),
        orderId: row.orderId,
        checkId: row.checkId,
        source: row.order.source,
        orderReference: snapshot.orderReference,
        branchOrderNumber: snapshot.branchOrderNumber ?? row.order.branchOrderNumber,
        checkNumber: snapshot.checkNumber,
        amount: snapshot.amount,
        currency: snapshot.currency,
      };
    });
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }
}
