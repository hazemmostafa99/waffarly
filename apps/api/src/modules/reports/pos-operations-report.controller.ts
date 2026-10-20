import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { OwnerProfile } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { PosOperationsReportService } from './pos-operations-report.service.js';

const querySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    branchId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine(({ from, to }, context) => {
    const fromTime = Date.parse(from);
    const toTime = Date.parse(to);
    if (toTime <= fromTime) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'The end time must be after the start time.',
      });
    }
    if (toTime - fromTime > 93 * 24 * 60 * 60 * 1000) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'An operations report cannot exceed 93 days.',
      });
    }
  });

@UseGuards(OwnerGuard)
@Controller('owner/pos/reports/operations')
export class PosOperationsReportController {
  constructor(
    @Inject(PosOperationsReportService)
    private readonly reports: PosOperationsReportService,
  ) {}

  @Get()
  get(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    const parsed = parseRequest(querySchema, query);
    return this.reports.get(owner.merchantId, {
      from: parsed.from,
      to: parsed.to,
      ...(parsed.branchId ? { branchId: parsed.branchId } : {}),
    });
  }
}
