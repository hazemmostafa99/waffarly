import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  LinkOrderCustomerRequest,
  OrderCustomerLink,
  OrderCustomerContext,
  CustomerOrderSummary,
  CursorPage,
} from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { CustomersService } from '../../customers/index.js';
import { assertScopedCursor, type CursorPageQuery } from '../../../common/http/pagination.js';
import { requireEgpCurrency } from '../../../common/money/money.js';

export const linkOrderCustomerSchema = z
  .object({
    revision: z.number().int().min(1).max(2_147_483_646),
    customerId: z.uuid(),
  })
  .strict();

@Injectable()
export class OrderCustomerService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CustomersService) private readonly customers: CustomersService,
  ) {}

  async get(merchantId: string, orderId: string): Promise<OrderCustomerContext> {
    const order = await this.prisma.storefrontOrder.findFirst({
      where: { merchantId, id: orderId },
      select: { merchantCustomerId: true, revision: true },
    });
    if (!order) throw new NotFoundException('Order was not found.');
    return { orderId, customerId: order.merchantCustomerId, revision: order.revision };
  }

  async history(
    merchantId: string,
    customerId: string,
    page: CursorPageQuery,
  ): Promise<CursorPage<CustomerOrderSummary>> {
    await this.customers.get(merchantId, customerId);
    const where = { merchantId, merchantCustomerId: customerId };
    if (page.cursor) {
      const anchor = await this.prisma.storefrontOrder.findFirst({
        where: { ...where, id: page.cursor },
        select: { id: true },
      });
      assertScopedCursor(page.cursor, anchor !== null);
    }
    const rows = await this.prisma.storefrontOrder.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        orderReference: true,
        source: true,
        status: true,
        total: true,
        currency: true,
        createdAt: true,
      },
    });
    const items = rows.slice(0, page.limit).map((row) => ({
      id: row.id,
      reference: row.orderReference,
      source: row.source,
      status: row.status,
      total: row.total.toFixed(2),
      currency: requireEgpCurrency(row.currency),
      createdAt: row.createdAt.toISOString(),
    }));
    return { items, nextCursor: rows.length > page.limit ? items.at(-1)!.id : null };
  }

  async link(
    merchantId: string,
    actor: string,
    orderId: string,
    input: LinkOrderCustomerRequest,
  ): Promise<OrderCustomerLink> {
    const parsed = parseRequest(linkOrderCustomerSchema, input);
    return this.prisma.$transaction(async (tx) => {
      await this.customers.requireActive(merchantId, parsed.customerId, tx);
      const order = await tx.storefrontOrder.findFirst({
        where: { merchantId, id: orderId },
        select: { id: true, revision: true, merchantCustomerId: true },
      });
      if (!order) throw new NotFoundException('Order was not found.');
      if (order.merchantCustomerId === parsed.customerId)
        return { orderId, customerId: parsed.customerId, revision: order.revision };
      // A mistaken association must be reviewed; ordinary writes cannot transfer history.
      if (order.merchantCustomerId)
        throw new ConflictException('Order is already linked to another customer.');
      const changed = await tx.storefrontOrder.updateMany({
        where: { merchantId, id: orderId, revision: parsed.revision, merchantCustomerId: null },
        data: {
          merchantCustomerId: parsed.customerId,
          customerLinkedBy: actor,
          customerLinkedAt: new Date(),
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('Order has changed. Refresh and try again.');
      return { orderId, customerId: parsed.customerId, revision: parsed.revision + 1 };
    });
  }
}
