/** Receives cashier requests to dispatch, amend and prepare kitchen orders. */
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';
import {
  CurrentPosEmployee,
  PosEmployeeGuard,
  requireEmployeePermission,
} from '../../../auth/index.js';
import { KitchenOrderAmendmentService } from '../../kitchen/kitchen-order-amendment.service.js';
import { PosKitchenService } from '../../kitchen/pos-kitchen.service.js';
import { OrderLifecycleService } from '../../fulfillment/order-lifecycle.service.js';
import {
  acknowledgePosKitchenCancellationSchema,
  markKitchenItemReadySchema,
  markOrderReadySchema,
  startOrderPreparationSchema,
} from '../../fulfillment/order-lifecycle.schemas.js';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';

@UseGuards(PosEmployeeGuard)
@Controller('pos/orders')
export class PosOrderKitchenController {
  constructor(
    @Inject(PosKitchenService) private readonly kitchen: PosKitchenService,
    @Inject(KitchenOrderAmendmentService)
    private readonly kitchenAmendments: KitchenOrderAmendmentService,
    @Inject(OrderLifecycleService) private readonly lifecycle: OrderLifecycleService,
  ) {}

  @Post(':id/kitchen-dispatch')
  @HttpCode(HttpStatus.OK)
  dispatchToKitchen(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.kitchen.dispatchDineInOrder(employee, id, body);
  }

  @Post(':id/kitchen-amendments')
  @HttpCode(HttpStatus.OK)
  addKitchenItems(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.kitchenAmendments.addKitchenItems(employee, id, body);
  }

  @Post(':id/start-preparation')
  startPreparation(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    requireEmployeePermission(employee, 'start_preparation');
    return this.lifecycle.startPreparationFromPos(
      employee.merchantId,
      `pos:${employee.id}`,
      id,
      parseRequest(startOrderPreparationSchema, body),
      employee.branches.map((branch) => branch.id),
    );
  }

  @Post(':id/ready')
  @HttpCode(HttpStatus.OK)
  markReady(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    requireEmployeePermission(employee, 'start_preparation');
    return this.lifecycle.markReadyFromPos(
      employee.merchantId,
      `pos:${employee.id}`,
      id,
      parseRequest(markOrderReadySchema, body),
      employee.branches.map((branch) => branch.id),
    );
  }

  @Post(':id/items/:lineId/ready')
  @HttpCode(HttpStatus.OK)
  markKitchenItemReady(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('lineId', new ParseUUIDPipe()) lineId: string,
    @Body() body: unknown,
  ) {
    requireEmployeePermission(employee, 'start_preparation');
    return this.lifecycle.markKitchenItemReadyFromPos(
      employee.merchantId,
      `pos:${employee.id}`,
      id,
      lineId,
      parseRequest(markKitchenItemReadySchema, body),
      employee.branches.map((branch) => branch.id),
    );
  }

  @Post(':id/cancellation-acknowledgement')
  @HttpCode(HttpStatus.OK)
  acknowledgePosCancellation(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    requireEmployeePermission(employee, 'accept_recipe_orders');
    return this.kitchen.acknowledgeCancellation(
      employee,
      id,
      parseRequest(acknowledgePosKitchenCancellationSchema, body),
    );
  }
}
