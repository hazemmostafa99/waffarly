/** Receives owner requests to read saved shift close reports. */
import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { CursorPage, OwnerProfile, PosShiftCloseReportRow } from '@waffarly/contracts';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../../../auth/index.js';
import { ownerPosShiftCloseReportsSchema } from '../../shifts.schemas.js';
import { ShiftsService } from '../../shifts.service.js';
@UseGuards(OwnerGuard)
@Controller('owner/pos/shifts')
export class OwnerPosShiftReportsController {
  constructor(@Inject(ShiftsService) private readonly shifts: ShiftsService) {}

  @Get('reports')
  listCloseReports(
    @CurrentOwner() owner: OwnerProfile,
    @Query() query: unknown,
  ): Promise<CursorPage<PosShiftCloseReportRow>> {
    return this.shifts.listOwnerCloseReports(
      owner.merchantId,
      parseRequest(ownerPosShiftCloseReportsSchema, query),
    );
  }
}
