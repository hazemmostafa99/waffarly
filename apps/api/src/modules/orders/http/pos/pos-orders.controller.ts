import {
  posOrderPageSchema,
  posActiveSalesPageSchema,
} from '../../checkout/storefront-checkout.schemas.js';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { z } from 'zod';

import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';

import { AuthService } from '../../../auth/index.js';
import { CurrentPosEmployee, PosEmployeeGuard } from '../../../auth/index.js';
import { requireEmployeePermission } from '../../../auth/index.js';
import { OrderLifecycleService } from '../../fulfillment/order-lifecycle.service.js';
import { PosKitchenService } from '../../kitchen/pos-kitchen.service.js';
import {
  acceptRecipeOrderSchema,
  handoverPosOrderSchema,
  markOrderReadySchema,
  markKitchenItemReadySchema,
  cancelPosOrderSchema,
  acknowledgePosKitchenCancellationSchema,
  startOrderPreparationSchema,
} from '../../fulfillment/order-lifecycle.schemas.js';
import { StorefrontOrdersService } from '../../checkout/storefront-orders.service.js';
import { PosOrdersService } from '../../pos-sales/pos-orders.service.js';
import {
  parseRecordPosCheckRefundRequest,
  withoutPosRefundApproval,
} from '../../../payments/index.js';
import {
  parseRecordPosItemReturnRequest,
  withoutPosItemReturnApproval,
} from '../../returns/pos-returns.schemas.js';
import { PosReturnsService } from '../../returns/pos-returns.service.js';

@UseGuards(PosEmployeeGuard)
@Controller('pos/orders')
export class PosStorefrontOrdersController {
  constructor(
    @Inject(StorefrontOrdersService) private readonly orders: StorefrontOrdersService,
    @Inject(OrderLifecycleService) private readonly lifecycle: OrderLifecycleService,
    @Inject(PosOrdersService) private readonly posOrders: PosOrdersService,
    @Inject(PosKitchenService) private readonly posKitchen: PosKitchenService,
    @Inject(PosReturnsService) private readonly posReturns: PosReturnsService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  quote(@CurrentPosEmployee() employee: PosEmployeeSession, @Body() body: unknown) {
    return this.posOrders.quote(employee, body);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentPosEmployee() employee: PosEmployeeSession, @Body() body: unknown) {
    return this.posOrders.create(employee, body);
  }

  @Post(':id/kitchen-dispatch')
  @HttpCode(HttpStatus.OK)
  dispatchToKitchen(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.posKitchen.dispatchDineInOrder(employee, id, body);
  }

  @Post(':id/kitchen-amendments')
  @HttpCode(HttpStatus.OK)
  addKitchenItems(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.posOrders.addKitchenItems(employee, id, body);
  }

  @Get(':id/payment-state')
  paymentState(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.posOrders.paymentState(employee, id);
  }

  @Get(':id/returns')
  itemReturnsState(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    requireEmployeePermission(employee, 'sell');
    return this.posReturns.state(employee, id);
  }

  @Post(':id/returns')
  @HttpCode(HttpStatus.CREATED)
  async recordItemReturn(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const input = parseRecordPosItemReturnRequest(body);
    requireEmployeePermission(employee, 'sell');
    if (
      !employee.branches.some(
        (branch) => branch.id === input.branchId && branch.archivedAt === null,
      )
    )
      throw new ForbiddenException('This employee is not assigned to the selected branch.');
    const approverEmployeeId = employee.permissions.includes('approve_refunds')
      ? undefined
      : input.approval
        ? await this.auth.verifyPosEmployeeApproval({
            merchantId: employee.merchantId,
            branchId: input.branchId,
            actingEmployeeId: employee.id,
            ...input.approval,
            permission: 'approve_refunds',
          })
        : undefined;
    if (!employee.permissions.includes('approve_refunds') && !approverEmployeeId)
      throw new ForbiddenException('Supervisor approval is required to record this return.');
    return this.posReturns.record(
      employee,
      id,
      withoutPosItemReturnApproval(input),
      approverEmployeeId,
    );
  }

  @Get('active-sales')
  activeSales(@CurrentPosEmployee() employee: PosEmployeeSession, @Query() query: unknown) {
    return this.posOrders.listActiveSales(employee, parseRequest(posActiveSalesPageSchema, query));
  }

  @Get(':id')
  detail(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.posOrders.detail(employee, id);
  }

  @Get(':id/checks/:checkId/receipt')
  checkReceipt(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('checkId', new ParseUUIDPipe()) checkId: string,
  ) {
    return this.posOrders.getCheckReceipt(employee, id, checkId);
  }

  @Post(':id/pickup-collection')
  @HttpCode(HttpStatus.OK)
  preparePickupCollection(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const input = parseRequest(z.object({ registerId: z.string().uuid() }).strict(), body);
    return this.posOrders.preparePickupCollection(employee, id, input.registerId);
  }

  @Post(':id/checks/:checkId/payments')
  @HttpCode(HttpStatus.CREATED)
  recordCheckPayment(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('checkId', new ParseUUIDPipe()) checkId: string,
    @Body() body: unknown,
  ) {
    return this.posOrders.recordCheckPayment(employee, id, checkId, body);
  }

  @Post(':id/checks/:checkId/refunds')
  @HttpCode(HttpStatus.CREATED)
  async recordCheckRefund(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('checkId', new ParseUUIDPipe()) checkId: string,
    @Body() body: unknown,
  ) {
    const input = parseRecordPosCheckRefundRequest(body);
    requireEmployeePermission(employee, 'sell');
    if (
      !employee.branches.some(
        (branch) => branch.id === input.branchId && branch.archivedAt === null,
      )
    )
      throw new ForbiddenException('This employee is not assigned to the selected branch.');
    const approverEmployeeId = employee.permissions.includes('approve_refunds')
      ? undefined
      : input.approval
        ? await this.auth.verifyPosEmployeeApproval({
            merchantId: employee.merchantId,
            branchId: input.branchId,
            actingEmployeeId: employee.id,
            ...input.approval,
            permission: 'approve_refunds',
          })
        : undefined;
    if (!employee.permissions.includes('approve_refunds') && !approverEmployeeId)
      throw new ForbiddenException('Supervisor approval is required to refund this check.');
    const command = withoutPosRefundApproval(input);
    return this.posOrders.recordCheckRefund(employee, id, checkId, command, approverEmployeeId);
  }

  @Get()
  list(@CurrentPosEmployee() employee: PosEmployeeSession, @Query() query: unknown) {
    requireEmployeePermission(employee, 'view_orders');
    const parsed = parseRequest(posOrderPageSchema, query);
    if (!employee.branches.some((branch) => branch.id === parsed.branchId)) {
      throw new ForbiddenException('This employee is not assigned to the selected branch.');
    }
    return this.orders.listForPos(employee.merchantId, parsed.branchId, {
      cursor: parsed.cursor,
      limit: parsed.limit,
    });
  }

  @Post(':id/accept')
  accept(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const input = parseRequest(acceptRecipeOrderSchema, body);
    requireEmployeePermission(employee, 'accept_recipe_orders');
    return this.lifecycle.acceptFromPos(
      employee.merchantId,
      `pos:${employee.id}`,
      id,
      input,
      employee.branches.map((branch) => branch.id),
    );
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

  @Post(':id/handover')
  @HttpCode(HttpStatus.OK)
  handover(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    requireEmployeePermission(employee, 'sell');
    return this.lifecycle.handoverFromPos(
      employee.merchantId,
      `pos:${employee.id}`,
      id,
      parseRequest(handoverPosOrderSchema, body),
      employee.branches.map((branch) => branch.id),
    );
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelPosOrder(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const input = parseRequest(cancelPosOrderSchema, body);
    requireEmployeePermission(employee, 'sell');
    if (!employee.branches.some((branch) => branch.id === input.branchId))
      throw new ForbiddenException('This employee is not assigned to the selected branch.');
    const approverEmployeeId = employee.permissions.includes('approve_voids')
      ? undefined
      : input.approval
        ? await this.auth.verifyPosEmployeeApproval({
            merchantId: employee.merchantId,
            branchId: input.branchId,
            actingEmployeeId: employee.id,
            ...input.approval,
            permission: 'approve_voids',
          })
        : undefined;
    if (!employee.permissions.includes('approve_voids') && !approverEmployeeId)
      throw new ForbiddenException('Supervisor approval is required to cancel this order.');
    return this.lifecycle.cancelPosFromPos(
      employee,
      id,
      { requestId: input.requestId, branchId: input.branchId, reason: input.reason },
      approverEmployeeId,
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
    return this.posKitchen.acknowledgeCancellation(
      employee,
      id,
      parseRequest(acknowledgePosKitchenCancellationSchema, body),
    );
  }
}
