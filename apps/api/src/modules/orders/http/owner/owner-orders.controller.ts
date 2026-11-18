/**
 * Receives owner requests to browse and manage merchant orders.
 */
import { StorefrontOrderStatusService } from '../../fulfillment/storefront-order-status.service.js';
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
import { ownerOrderListQuerySchema } from './owner-orders.schemas.js';

@UseGuards(OwnerGuard)
@Controller('owner/orders')
export class OwnerStorefrontOrdersController {
  constructor(
    @Inject(StorefrontOrdersService) private readonly orders: StorefrontOrdersService,
    @Inject(StorefrontOrderStatusService)
    private readonly orderStatus: StorefrontOrderStatusService,
    @Inject(OrderLifecycleService) private readonly lifecycle: OrderLifecycleService,
  ) {}

  @Get()
  async list(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    return this.orders.listForOwner(owner.merchantId, parseCursorPageQuery(query));
  }

  @Get('inbox')
  async listInbox(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    const filters = parseRequest(ownerOrderListQuerySchema, query);
    return this.orders.listInboxForOwner(
      owner.merchantId,
      {
        limit: filters.limit,
        includeStats: filters.includeStats,
        ...(filters.cursor !== undefined ? { cursor: filters.cursor } : {}),
        ...(filters.status !== undefined ? { status: filters.status } : {}),
        ...(filters.source !== undefined ? { source: filters.source } : {}),
        ...(filters.fulfillment !== undefined ? { fulfillment: filters.fulfillment } : {}),
        ...(filters.from !== undefined ? { from: filters.from } : {}),
        ...(filters.to !== undefined ? { to: filters.to } : {}),
        ...(filters.search !== undefined ? { search: filters.search } : {}),
        ...(filters.report !== undefined ? { report: filters.report } : {}),
      },
    );
  }

  @Get(':id')
  async get(@CurrentOwner() owner: OwnerProfile, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.getForOwner(owner.merchantId, id);
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
    return this.orderStatus.updateStatus(
      owner.merchantId,
      id,
      parsed.status satisfies UpdateStorefrontOrderStatusRequest['status'],
    );
  }
}
