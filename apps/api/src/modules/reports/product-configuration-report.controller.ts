import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { OwnerProfile } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { ProductConfigurationReportService } from './product-configuration-report.service.js';

const querySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict()
  .superRefine(({ from, to }, context) => {
    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    if (!fromDate || !toDate) {
      context.addIssue({ code: 'custom', message: 'Report dates must be valid calendar dates.' });
      return;
    }
    if (fromDate > toDate) {
      context.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'The start date must not be after the end date.',
      });
    }
    const dayCount = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    if (dayCount > 366) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'A report date range cannot exceed 366 days.',
      });
    }
  });

@UseGuards(OwnerGuard)
@Controller('owner/reports/product-configuration')
export class ProductConfigurationReportController {
  constructor(
    @Inject(ProductConfigurationReportService)
    private readonly reports: ProductConfigurationReportService,
  ) {}

  @Get()
  async get(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    const parsed = parseRequest(querySchema, query);
    return this.reports.get(owner.merchantId, parsed.from, parsed.to);
  }
}

function parseDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}
