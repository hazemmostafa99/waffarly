/** Receives owner requests to review payroll, advances and employee payments. */
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { OwnerProfile, StaffAdvanceSummary } from '@waffarly/contracts';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { listStaffAdvancesSchema, payrollMonthQuerySchema } from './payroll.schemas.js';
import { PayrollService } from './payroll.service.js';

@UseGuards(OwnerGuard)
@Controller('owner/payroll')
export class PayrollController {
  constructor(@Inject(PayrollService) private readonly payroll: PayrollService) {}

  @Get('advances')
  advances(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listStaffAdvancesSchema, { format: 'messages' }))
    query: {
      staffMemberId?: string;
      status: 'open' | 'all';
    },
  ): Promise<StaffAdvanceSummary[]> {
    return this.payroll.advances(owner.merchantId, query);
  }

  @Post('advances')
  createAdvance(@CurrentOwner() owner: OwnerProfile, @Body() input: unknown) {
    return this.payroll.createAdvance(owner.merchantId, owner.username, input);
  }

  @Get()
  async month(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(payrollMonthQuerySchema, { format: 'messages' }))
    query: { month: string },
    @Res() response: Response,
  ): Promise<void> {
    const run = await this.payroll.month(owner.merchantId, query.month);
    // Nest sends a bare null as an empty body. Preserve the nullable JSON contract.
    response.json(run);
  }

  @Post()
  createRun(@CurrentOwner() owner: OwnerProfile, @Body() input: unknown) {
    return this.payroll.createRun(owner.merchantId, owner.username, input);
  }

  @Get(':id')
  getRun(@CurrentOwner() owner: OwnerProfile, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.payroll.getRun(owner.merchantId, id);
  }

  @Post(':id/adjustments')
  addAdjustment(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: unknown,
  ) {
    return this.payroll.addAdjustment(owner.merchantId, owner.username, id, input);
  }

  @Delete(':id/adjustments/:adjustmentId')
  removeAdjustment(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('adjustmentId', new ParseUUIDPipe()) adjustmentId: string,
  ) {
    return this.payroll.removeAdjustment(owner.merchantId, id, adjustmentId);
  }

  @Post(':id/approve')
  approve(@CurrentOwner() owner: OwnerProfile, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.payroll.approve(owner.merchantId, owner.username, id);
  }

  @Post('lines/:lineId/payments')
  recordPayment(
    @CurrentOwner() owner: OwnerProfile,
    @Param('lineId', new ParseUUIDPipe()) lineId: string,
    @Body() input: unknown,
  ) {
    return this.payroll.recordPayment(owner.merchantId, owner.username, lineId, input);
  }
}
