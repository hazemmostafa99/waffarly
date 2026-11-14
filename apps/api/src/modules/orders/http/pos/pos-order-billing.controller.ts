/** Receives cashier requests to review bills, prepare collection, take payments and record refunds. */
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
  UseGuards,
} from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import {
  AuthService,
  CurrentPosEmployee,
  PosEmployeeGuard,
  requireEmployeePermission,
} from '../../../auth/index.js';
import { CheckPaymentService } from '../../billing/check-payment.service.js';
import { CheckRefundService } from '../../billing/check-refund.service.js';
import { PickupCollectionService } from '../../billing/pickup-collection.service.js';
import { PosOrderQueryService } from '../../pos-sales/pos-order-query.service.js';
import { PosReceiptQueryService } from '../../receipts/pos-receipt-query.service.js';
import {
  parseRecordPosCheckRefundRequest,
  withoutPosRefundApproval,
} from '../../../payments/index.js';

@UseGuards(PosEmployeeGuard)
@Controller('pos/orders')
export class PosOrderBillingController {
  constructor(
    @Inject(PosOrderQueryService) private readonly orderQueries: PosOrderQueryService,
    @Inject(PosReceiptQueryService) private readonly receiptQueries: PosReceiptQueryService,
    @Inject(PickupCollectionService) private readonly pickupCollection: PickupCollectionService,
    @Inject(CheckPaymentService) private readonly checkPayments: CheckPaymentService,
    @Inject(CheckRefundService) private readonly checkRefunds: CheckRefundService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get(':id/payment-state')
  paymentState(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.orderQueries.paymentState(employee, id);
  }

  @Get(':id/checks/:checkId/receipt')
  checkReceipt(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('checkId', new ParseUUIDPipe()) checkId: string,
  ) {
    return this.receiptQueries.getCheckReceipt(employee, id, checkId);
  }

  @Post(':id/pickup-collection')
  @HttpCode(HttpStatus.OK)
  preparePickupCollection(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const input = parseRequest(z.object({ registerId: z.string().uuid() }).strict(), body);
    return this.pickupCollection.preparePickupCollection(employee, id, input.registerId);
  }

  @Post(':id/checks/:checkId/payments')
  @HttpCode(HttpStatus.CREATED)
  recordCheckPayment(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('checkId', new ParseUUIDPipe()) checkId: string,
    @Body() body: unknown,
  ) {
    return this.checkPayments.recordCheckPayment(employee, id, checkId, body);
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
    return this.checkRefunds.recordCheckRefund(employee, id, checkId, command, approverEmployeeId);
  }
}
