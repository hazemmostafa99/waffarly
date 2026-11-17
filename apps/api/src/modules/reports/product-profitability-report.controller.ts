import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { OwnerProductProfitabilityReport, OwnerProfile } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { ProductProfitabilityReportService } from './product-profitability-report.service.js';

const querySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  branchId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
}).strict().superRefine(({ from, to }, context) => {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (end < start) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'The end date must not precede the start date.' });
  } else if (end - start > 366 * 24 * 60 * 60 * 1000) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'A profitability report cannot exceed 367 calendar days.' });
  }
});

@UseGuards(OwnerGuard)
@Controller('owner/reports/profitability/products')
export class ProductProfitabilityReportController {
  constructor(
    @Inject(ProductProfitabilityReportService)
    private readonly reports: ProductProfitabilityReportService,
  ) {}

  @Get()
  get(
    @CurrentOwner() owner: OwnerProfile,
    @Query() query: unknown,
  ): Promise<OwnerProductProfitabilityReport> {
    const parsed = parseRequest(querySchema, query);
    return this.reports.get(owner.merchantId, {
      from: parsed.from,
      to: parsed.to,
      limit: parsed.limit,
      ...(parsed.branchId ? { branchId: parsed.branchId } : {}),
    });
  }
}
