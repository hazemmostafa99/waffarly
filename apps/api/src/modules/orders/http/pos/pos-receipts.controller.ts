/**
 * Receives cashier requests to find saved receipts at an assigned branch.
 */
import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { PosEmployeeSession, PosReceiptHistoryPage } from '@waffarly/contracts';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import { CurrentPosEmployee, PosEmployeeGuard } from '../../../auth/index.js';
import { PosReceiptQueryService } from '../../receipts/pos-receipt-query.service.js';
import { posReceiptHistoryQuerySchema } from '../../receipts/pos-receipts.schemas.js';

@UseGuards(PosEmployeeGuard)
@Controller('pos/receipts')
export class PosReceiptsController {
  constructor(@Inject(PosReceiptQueryService) private readonly receipts: PosReceiptQueryService) {}

  @Get()
  list(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Query() query: unknown,
  ): Promise<PosReceiptHistoryPage> {
    return this.receipts.listReceipts(employee, parseRequest(posReceiptHistoryQuerySchema, query));
  }
}
