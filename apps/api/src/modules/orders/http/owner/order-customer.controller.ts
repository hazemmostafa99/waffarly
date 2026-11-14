import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import type { OwnerProfile } from '@waffarly/contracts';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../../../auth/index.js';
import {
  linkOrderCustomerSchema,
  OrderCustomerService,
} from '../../customers/order-customer.service.js';

@UseGuards(OwnerGuard)
@Controller('owner/orders/:orderId/customer')
export class OrderCustomerController {
  constructor(@Inject(OrderCustomerService) private readonly orders: OrderCustomerService) {}
  @Get()
  get(@CurrentOwner() owner: OwnerProfile, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orders.get(owner.merchantId, orderId);
  }
  @Put()
  link(
    @CurrentOwner() owner: OwnerProfile,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: unknown,
  ) {
    return this.orders.link(
      owner.merchantId,
      owner.username,
      orderId,
      parseRequest(linkOrderCustomerSchema, body),
    );
  }
}

const historySchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

@UseGuards(OwnerGuard)
@Controller('owner/customers/:id/orders')
export class CustomerOrdersController {
  constructor(@Inject(OrderCustomerService) private readonly orders: OrderCustomerService) {}
  @Get()
  history(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: unknown,
  ) {
    return this.orders.history(owner.merchantId, id, parseRequest(historySchema, query));
  }
}
