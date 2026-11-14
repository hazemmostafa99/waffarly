/** Receives cashier requests to inspect and record physical item returns. */
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
import {
  AuthService,
  CurrentPosEmployee,
  PosEmployeeGuard,
  requireEmployeePermission,
} from '../../../auth/index.js';
import { PosReturnsService } from '../../returns/pos-returns.service.js';
import {
  parseRecordPosItemReturnRequest,
  withoutPosItemReturnApproval,
} from '../../returns/pos-returns.schemas.js';

@UseGuards(PosEmployeeGuard)
@Controller('pos/orders')
export class PosOrderReturnsController {
  constructor(
    @Inject(PosReturnsService) private readonly posReturns: PosReturnsService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

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
}
