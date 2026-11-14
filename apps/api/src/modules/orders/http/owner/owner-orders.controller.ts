/**
 * Receives owner requests to view website orders and act on their preparation or cancellation.
 */
import { updateStatusSchema } from '../../checkout/storefront-checkout.schemas.js';
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { OwnerProfile, UpdateStorefrontOrderStatusRequest } from '@waffarly/contracts';

import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import { parseCursorPageQuery } from '../../../../common/http/pagination.js';

import { CurrentOwner, OwnerGuard } from '../../../auth/index.js';

import { OrderLifecycleService } from '../../fulfillment/order-lifecycle.service.js';

import {
  acceptRecipeOrderSchema,
  cancelRecipeOrderSchema,
  startOrderPreparationSchema,
} from '../../fulfillment/order-lifecycle.schemas.js';
import { StorefrontOrdersService } from '../../checkout/storefront-orders.service.js';

@UseGuards(OwnerGuard)
@Controller('owner/orders')
export class OwnerStorefrontOrdersController {
  constructor(
    @Inject(StorefrontOrdersService) private readonly orders: StorefrontOrdersService,
    @Inject(OrderLifecycleService) private readonly lifecycle: OrderLifecycleService,
  ) {}

  @Get()
  async list(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    return this.orders.listForOwner(owner.merchantId, parseCursorPageQuery(query));
  }

  @Post(':id/accept')
  async accept(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.lifecycle.accept(
      owner.merchantId,
      owner.username,
      id,
      parseRequest(acceptRecipeOrderSchema, body),
    );
  }

  @Post(':id/start-preparation')
  async startPreparation(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.lifecycle.startPreparation(
      owner.merchantId,
      owner.username,
      id,
      parseRequest(startOrderPreparationSchema, body),
    );
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.lifecycle.cancel(
      owner.merchantId,
      owner.username,
      id,
      parseRequest(cancelRecipeOrderSchema, body),
    );
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const parsed = parseRequest(updateStatusSchema, body);
    return this.orders.updateStatus(
      owner.merchantId,
      id,
      parsed.status satisfies UpdateStorefrontOrderStatusRequest['status'],
    );
  }
}
