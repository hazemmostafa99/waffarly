/** Receives cashier requests to create, list and move orders through their main lifecycle. */
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
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import {
  AuthService,
  CurrentPosEmployee,
  PosEmployeeGuard,
  requireEmployeePermission,
} from '../../../auth/index.js';
import {
  posActiveSalesPageSchema,
  posOrderPageSchema,
} from '../../checkout/storefront-checkout.schemas.js';
import { StorefrontOrdersService } from '../../checkout/storefront-orders.service.js';
import {
  acceptRecipeOrderSchema,
  cancelPosOrderSchema,
  handoverPosOrderSchema,
} from '../../fulfillment/order-lifecycle.schemas.js';
import { OrderLifecycleService } from '../../fulfillment/order-lifecycle.service.js';
import { PosOrderQueryService } from '../../pos-sales/pos-order-query.service.js';
import { PosSaleService } from '../../pos-sales/pos-sale.service.js';

@UseGuards(PosEmployeeGuard)
@Controller('pos/orders')
export class PosOrdersController {
  constructor(
    @Inject(StorefrontOrdersService) private readonly orders: StorefrontOrdersService,
    @Inject(OrderLifecycleService) private readonly lifecycle: OrderLifecycleService,
    @Inject(PosOrderQueryService) private readonly orderQueries: PosOrderQueryService,
    @Inject(PosSaleService) private readonly sales: PosSaleService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  quote(@CurrentPosEmployee() employee: PosEmployeeSession, @Body() body: unknown) {
    return this.sales.quote(employee, body);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentPosEmployee() employee: PosEmployeeSession, @Body() body: unknown) {
    return this.sales.create(employee, body);
  }

  @Get('active-sales')
  activeSales(@CurrentPosEmployee() employee: PosEmployeeSession, @Query() query: unknown) {
    return this.orderQueries.listActiveSales(
      employee,
      parseRequest(posActiveSalesPageSchema, query),
    );
  }

  @Get(':id')
  detail(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.orderQueries.detail(employee, id);
  }

  @Get()
  list(@CurrentPosEmployee() employee: PosEmployeeSession, @Query() query: unknown) {
    requireEmployeePermission(employee, 'view_orders');
    const parsed = parseRequest(posOrderPageSchema, query);
    if (employee.branch.id !== parsed.branchId) {
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
      employee.branch.id,
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
      employee.branch.id,
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
    if (employee.branch.id !== input.branchId)
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
}
