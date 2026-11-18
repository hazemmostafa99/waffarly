/** Returns order history only for the signed-in customer of the requested merchant. */
import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { CursorPage, CustomerOrderSummary } from '@waffarly/contracts';
import type { Request } from 'express';
import { z } from 'zod';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import { StorefrontCustomerAuthService } from '../../../customers/index.js';
import { OrderCustomerService } from '../../customers/order-customer.service.js';

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
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(
    @Param('slug') slug: string,
    @Query() query: unknown,
    @Req() request: Request,
  ): Promise<CursorPage<CustomerOrderSummary>> {
    const page = parseRequest(pageSchema, query);
    const customer = await this.auth.current(slug, request);
    if (!customer) throw new UnauthorizedException('Sign in is required.');
    return this.orders.history(customer.merchantId, customer.customerId, page);
  }
}
