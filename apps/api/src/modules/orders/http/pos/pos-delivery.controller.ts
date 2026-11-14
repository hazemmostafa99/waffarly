/**
 * Receives cashier requests to follow deliveries and record their progress or courier collections.
 */
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { CurrentPosEmployee, PosEmployeeGuard } from '../../../auth/index.js';
import { PosDeliveryService } from '../../delivery/pos-delivery.service.js';

@UseGuards(PosEmployeeGuard)
@Controller('pos/deliveries')
export class PosDeliveryController {
  constructor(@Inject(PosDeliveryService) private readonly deliveries: PosDeliveryService) {}
  @Get()
  list(@CurrentPosEmployee() employee: PosEmployeeSession, @Query() query: unknown) {
    return this.deliveries.list(employee, query);
  }
  @Get('ready')
  ready(@CurrentPosEmployee() employee: PosEmployeeSession, @Query() query: unknown) {
    return this.deliveries.ready(employee, query);
  }
  @Get(':id')
  get(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.deliveries.summary(employee, id);
  }
  @Get(':id/requests/:requestId')
  requestStatus(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.deliveries.requestStatus(employee, id, requestId);
  }
  @Post(':id/actions')
  command(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.deliveries.command(employee, id, body);
  }
  @Post(':id/requests/:requestId/abandon')
  abandon(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.deliveries.abandonRequest(employee, id, requestId);
  }
}
