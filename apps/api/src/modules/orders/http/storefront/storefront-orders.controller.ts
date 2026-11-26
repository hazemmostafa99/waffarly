/**
 * Receives customer basket reviews and new website orders, including Marketplace customer checkout.
 */
import { createOrderSchema } from '../../checkout/storefront-checkout.schemas.js';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { CreateStorefrontOrderRequest } from '@waffarly/contracts';

import type { Request, Response } from 'express';
import { AppConfiguration } from '../../../../config/app-configuration.js';
import { keepStorefrontGuest } from '../../customers/storefront-guest-cookie.js';
import { CustomerOrderAccessService } from '../../customers/customer-order-access.service.js';
import { StorefrontCustomerAuthService } from '../../../customers/index.js';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';

import { StorefrontOrdersService } from '../../checkout/storefront-orders.service.js';

@Controller('catalog/stores/:slug/orders')
export class PublicStorefrontOrdersController {
  constructor(
    @Inject(StorefrontOrdersService) private readonly orders: StorefrontOrdersService,
    @Inject(CustomerOrderAccessService) private readonly access: CustomerOrderAccessService,
    @Inject(StorefrontCustomerAuthService)
    private readonly storefrontCustomerAuth: StorefrontCustomerAuthService,
    @Inject(AppConfiguration) private readonly config: AppConfiguration,
  ) {}

  @Post('customer')
  @HttpCode(HttpStatus.CREATED)
  async createForCustomer(
    @Param('slug') slug: string,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    assertValidStorefrontSlug(slug);
    const input = parseRequest(createOrderSchema, body);
    if (!input.requestId)
      throw new BadRequestException('requestId is required for customer checkout.');
    return this.orders.create(
      slug,
      input,
      await this.access.identity(request),
      await this.access.scope(request),
    );
  }

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  async quote(
    @Param('slug') slug: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertValidStorefrontSlug(slug);
    // Give a guest their browser cookie at review time, before the order is sent, so a
    // retried order keeps the same cookie even when the first response was lost.
    if (!(await this.storefrontCustomerAuth.current(slug, request)))
      keepStorefrontGuest(request, response, this.config.isProduction);
    const parsed = parseRequest(createOrderSchema, {
      ...(body && typeof body === 'object' ? body : {}),
      customerName: 'Quote',
      customerPhone: '00000000',
      deliveryAddress: 'Quote address',
    });
    return this.orders.quoteCheckout(slug, parsed);
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('slug') slug: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertValidStorefrontSlug(slug);
    const parsed = parseRequest(createOrderSchema, body);
    const customer = await this.storefrontCustomerAuth.current(slug, request);
    return this.orders.create(
      slug,
      parsed satisfies CreateStorefrontOrderRequest,
      undefined,
      undefined,
      customer?.customerId,
      customer ? undefined : keepStorefrontGuest(request, response, this.config.isProduction),
    );
  }
}

function assertValidStorefrontSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    throw new BadRequestException('Storefront address is invalid.');
  }
}
