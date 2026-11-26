/**
 * Shows a merchant website shopper their orders at that store: the signed-in customer's history
 * (after adding any orders they placed there as a guest on this browser), or this browser's
 * guest orders when they are not signed in.
 */
import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { CursorPage, CustomerOrderSummary } from '@waffarly/contracts';
import type { Request } from 'express';
import { z } from 'zod';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import { PrismaService } from '../../../../infrastructure/database/prisma.service.js';
import { StorefrontCustomerAuthService } from '../../../customers/index.js';
import { OrderCustomerService } from '../../customers/order-customer.service.js';
import { readStorefrontGuest } from '../../customers/storefront-guest-cookie.js';

const pageSchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

@Controller('catalog/stores/:slug/customer/orders')
export class StorefrontCustomerOrdersController {
  constructor(
    @Inject(StorefrontCustomerAuthService) private readonly auth: StorefrontCustomerAuthService,
    @Inject(OrderCustomerService) private readonly orders: OrderCustomerService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(
    @Param('slug') slug: string,
    @Query() query: unknown,
    @Req() request: Request,
  ): Promise<CursorPage<CustomerOrderSummary>> {
    const page = parseRequest(pageSchema, query);
    const guest = readStorefrontGuest(request);
    const customer = await this.auth.current(slug, request);
    if (customer) {
      // 1. Signing in (or signing up) keeps the orders this browser placed here as a guest.
      if (guest) await this.orders.attachGuestOrders(customer.merchantId, customer.customerId, guest);
      return this.orders.history(customer.merchantId, customer.customerId, page);
    }
    // 2. A guest sees only this browser's unexpired guest orders at this store.
    if (!guest) return { items: [], nextCursor: null };
    return this.orders.guestHistory(await this.merchantIdForSlug(slug), guest, page);
  }

  private async merchantIdForSlug(slug: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120)
      throw new BadRequestException('Storefront address is invalid.');
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Storefront was not found.');
    return merchant.id;
  }
}
