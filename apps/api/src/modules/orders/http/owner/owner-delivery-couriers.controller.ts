/** Lets an owner manage delivery couriers and view their operating performance. */
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
import type {
  DeliveryCourierPerformanceReport,
  DeliveryCourierSummary,
  OwnerProfile,
} from '@waffarly/contracts';
import { ZodValidationPipe } from '../../../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../../../auth/index.js';
import { DeliveryCourierService } from '../../delivery/delivery-courier.service.js';
import {
  createDeliveryCourierSchema,
  listDeliveryCouriersSchema,
  updateDeliveryCourierSchema,
} from '../../delivery/delivery-courier.schemas.js';

@UseGuards(OwnerGuard)
@Controller('owner/delivery-couriers')
export class OwnerDeliveryCouriersController {
  constructor(@Inject(DeliveryCourierService) private readonly couriers: DeliveryCourierService) {}

  @Get()
  list(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listDeliveryCouriersSchema, { format: 'messages' }))
    query: unknown,
  ) {
    return this.couriers.listForOwner(owner.merchantId, query);
  }

  @Get('performance')
  performance(@CurrentOwner() owner: OwnerProfile): Promise<DeliveryCourierPerformanceReport> {
    return this.couriers.performanceForOwner(owner.merchantId);
  }

  @Post()
  create(
    @CurrentOwner() owner: OwnerProfile,
    @Body(new ZodValidationPipe(createDeliveryCourierSchema, { format: 'messages' }))
    body: unknown,
  ): Promise<DeliveryCourierSummary> {
    return this.couriers.create(owner.merchantId, owner.username, body);
  }

  @Patch(':id')
  update(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateDeliveryCourierSchema, { format: 'messages' }))
    body: unknown,
  ): Promise<DeliveryCourierSummary> {
    return this.couriers.update(owner.merchantId, owner.username, id, body);
  }
}
