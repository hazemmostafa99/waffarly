import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { CursorPage, PosEmployeeSession, StockBalance } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import {
  CurrentPosEmployee,
  PosEmployeeGuard,
  requireEmployeeBranch,
  requireEmployeePermission,
} from '../auth/index.js';
import { InventoryLedgerService } from './inventory-ledger.service.js';
import { listStockBalancesSchema } from './inventory.schemas.js';

const employeeBalancesSchema = listStockBalancesSchema.extend({ branchId: z.string().uuid() });

@UseGuards(PosEmployeeGuard)
@Controller('pos/inventory')
export class EmployeeInventoryController {
  constructor(@Inject(InventoryLedgerService) private readonly ledger: InventoryLedgerService) {}

  @Get('balances')
  list(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Query() query: unknown,
  ): Promise<CursorPage<StockBalance>> {
    requireEmployeePermission(employee, 'view_inventory');
    const parsed = parseRequest(employeeBalancesSchema, query);
    requireEmployeeBranch(employee, parsed.branchId);
    return this.ledger.listBalances(employee.merchantId, parsed);
  }
}
