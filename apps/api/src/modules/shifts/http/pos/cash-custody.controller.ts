/** Receives staff requests to hand over, receive or carry forward branch cash. */
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
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import { cashPageSchema } from '../../cash-custody.schemas.js';
import { CashCustodyService } from '../../cash-custody.service.js';
@UseGuards(PosEmployeeGuard)
@Controller('pos/cash')
export class PosCashCustodyController {
  constructor(@Inject(CashCustodyService) private readonly cash: CashCustodyService) {}
  @Get('safes')
  async safes(@CurrentPosEmployee() employee: PosEmployeeSession, @Query() input: unknown) {
    const q = parseRequest(cashPageSchema, input);
    await this.cash.employeeBranch(employee, q.branchId ?? '');
    const result = await this.cash.listSafes(employee.merchantId, q);
    // Cashiers only need destinations; treasury balances remain private.
    return {
      ...result,
      items: result.items.map(({ id, branchId, name }) => ({ id, branchId, name })),
    };
  }
  @Get('drawers')
  drawers(@CurrentPosEmployee() employee: PosEmployeeSession, @Query() query: unknown) {
    return this.cash.drawers(employee.merchantId, query, employee);
  }
  @Get('carryover')
  carryover(@CurrentPosEmployee() employee: PosEmployeeSession, @Query() query: unknown) {
    return this.cash.carryoverOptions(employee, query);
  }
  @Get('my-transfers')
  ownTransfers(@CurrentPosEmployee() employee: PosEmployeeSession, @Query() query: unknown) {
    return this.cash.listTransfers(employee.merchantId, query, employee);
  }
  @Post('shifts/:id/transfers')
  transfer(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: unknown,
  ) {
    return this.cash.transferClosedCash(
      employee.merchantId,
      `pos:${employee.id}`,
      id,
      input,
      employee,
    );
  }
  @Get('transfers')
  async transfers(@CurrentPosEmployee() employee: PosEmployeeSession, @Query() input: unknown) {
    const q = parseRequest(cashPageSchema, input);
    await this.cash.employeeBranch(employee, q.branchId ?? '', true);
    return this.cash.listTransfers(employee.merchantId, q);
  }
  @Post('transfers/:id/receive')
  async receive(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() input: unknown,
    @Body() body: unknown,
  ) {
    const q = parseRequest(cashPageSchema, input);
    await this.cash.employeeBranch(employee, q.branchId ?? '', true);
    return this.cash.receiveForEmployee(employee, q.branchId!, id, body);
  }
}
