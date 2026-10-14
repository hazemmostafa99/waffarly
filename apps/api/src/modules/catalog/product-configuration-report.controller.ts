import { BadRequestException, Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';
import { OwnerGuard } from '../auth/owner.guard.js';
import { ProductConfigurationReportService } from './product-configuration-report.service.js';

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict().superRefine(({ from, to }, context) => {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (!fromDate || !toDate) {
    context.addIssue({ code: 'custom', message: 'Report dates must be valid calendar dates.' });
    return;
  }
  if (fromDate > toDate) {
    context.addIssue({ code: 'custom', path: ['from'], message: 'The start date must not be after the end date.' });
  }
  const dayCount = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  if (dayCount > 366) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'A report date range cannot exceed 366 days.' });
  }
});

@UseGuards(OwnerGuard)
@Controller('owner/reports/product-configuration')
export class ProductConfigurationReportController {
  constructor(
    @Inject(ProductConfigurationReportService) private readonly reports: ProductConfigurationReportService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  async get(@Req() request: Request, @Query() query: unknown) {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const owner = await this.auth.requireOwner(request);
    return this.reports.get(owner.merchantId, parsed.data.from, parsed.data.to);
  }
}

function parseDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}
