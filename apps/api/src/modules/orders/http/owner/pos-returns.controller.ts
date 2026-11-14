/**
 * Receives owner requests for reports about returned items and recorded waste.
 */
import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { OwnerProfile } from '@waffarly/contracts';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../../../auth/index.js';
import { ownerPosItemReturnReportsSchema } from '../../returns/pos-returns.schemas.js';
import { PosReturnsService } from '../../returns/pos-returns.service.js';

@UseGuards(OwnerGuard)
@Controller('owner/pos/returns')
export class OwnerPosItemReturnsController {
  constructor(@Inject(PosReturnsService) private readonly returns: PosReturnsService) {}

  @Get('reports')
  listReports(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    return this.returns.listOwnerReports(
      owner.merchantId,
      parseRequest(ownerPosItemReturnReportsSchema, query),
    );
  }
}
