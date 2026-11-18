/** Serves the authenticated owner's monthly business report. */
import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { OwnerBusinessReport, OwnerProfile } from '@waffarly/contracts';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { BusinessReportService } from './business-report.service.js';

@UseGuards(OwnerGuard)
@Controller('owner/reports/business')
export class BusinessReportController {
  constructor(@Inject(BusinessReportService) private readonly reports: BusinessReportService) {}

  @Get()
  get(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown): Promise<OwnerBusinessReport> {
    return this.reports.get(owner.merchantId, query);
  }
}
