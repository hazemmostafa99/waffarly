/**
 * Links an order to a customer in the merchant customer book and shows that customer order history.
 * This is separate from ownership of a Marketplace account.
 */
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import type { Prisma } from '@waffarly/database';
import { type OrderIdentity, orderIdentityWhere } from './order-identity.rules.js';

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
    return this.orderPage({ merchantId, merchantCustomerId: customerId }, page);
  }

  /** Lists the website orders this browser placed as a guest at one merchant. */
  guestHistory(
    merchantId: string,
    guest: OrderIdentity,
    page: CursorPageQuery,
  ): Promise<CursorPage<CustomerOrderSummary>> {
    return this.orderPage(
      { merchantId, merchantCustomerId: null, customerAccess: { is: orderIdentityWhere(guest) } },
      page,
    );
  }

  /** Lists this browser's guest orders at the merchant website with this storefront address. */
  async guestHistoryForStore(
    slug: string,
    guest: OrderIdentity,
    page: CursorPageQuery,
  ): Promise<CursorPage<CustomerOrderSummary>> {
    // Lowercase words joined by single hyphens: "cairo-grill" passes, "Cairo--grill" does not.
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120)
      throw new BadRequestException('Storefront address is invalid.');
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Storefront was not found.');
    return this.guestHistory(merchant.id, guest, page);
  }

  /**
   * Adds this browser's guest orders at the merchant to the signed-in store customer, so the
   * orders appear in their account and in the merchant's customer history.
   * Orders already linked to a customer are never moved.
   */
  async attachGuestOrders(merchantId: string, customerId: string, guest: OrderIdentity) {
    await this.prisma.$transaction(async (tx) => {
      await this.customers.requireActive(merchantId, customerId, tx);
      const guestOrders = await tx.storefrontOrder.findMany({
        where: {
          merchantId,
          merchantCustomerId: null,
          customerAccess: { is: orderIdentityWhere(guest) },
        },
        select: { id: true },
      });
      if (!guestOrders.length) return;
      const orderIds = guestOrders.map((order) => order.id);
      const now = new Date();
      // 1. Link the orders; the revision bump tells open owner screens the order changed.
      await tx.storefrontOrder.updateMany({
        where: { merchantId, id: { in: orderIds }, merchantCustomerId: null },
        data: {
          merchantCustomerId: customerId,
          customerLinkedBy: 'storefront-guest-sign-in',
          customerLinkedAt: now,
          revision: { increment: 1 },
        },
      });
      // 2. Remove the browser proof so the orders now belong to the store account only. The row
      // is deleted, not emptied: the database requires it to name a Marketplace account or a guest.
      await tx.customerOrderAccess.deleteMany({
        where: { merchantId, orderId: { in: orderIds }, ...orderIdentityWhere(guest) },
      });
    });
  }

  private async orderPage(
    where: Prisma.StorefrontOrderWhereInput,
    page: CursorPageQuery,
  ): Promise<CursorPage<CustomerOrderSummary>> {
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
