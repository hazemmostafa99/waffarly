import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { PosEmployeeSession, PosReceiptHistoryPage } from '@waffarly/contracts';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import { CurrentPosEmployee, PosEmployeeGuard } from '../../../auth/index.js';
import { PosOrdersService } from '../../pos-sales/pos-orders.service.js';
import { posReceiptHistoryQuerySchema } from '../../receipts/pos-receipts.schemas.js';

@UseGuards(PosEmployeeGuard)
@Controller('pos/receipts')
export class PosReceiptsController {
  constructor(@Inject(PosOrdersService) private readonly orders: PosOrdersService) {}

  @Get()
  list(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Query() query: unknown,
  ): Promise<PosReceiptHistoryPage> {
    return this.orders.listReceipts(employee, parseRequest(posReceiptHistoryQuerySchema, query));
  }
}
