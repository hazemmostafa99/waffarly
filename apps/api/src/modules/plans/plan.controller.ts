import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { MonthlyPlanSummary } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { AdminGuard, CurrentAdmin } from '../auth/index.js';
import { PlanService } from './plan.service.js';

const settings = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).default(''),
  monthlyPrice: z
    .string()
    .trim()
    .regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/, {
      message: 'Enter an amount from 0 to 99999999.99 with at most two decimal places.',
    })
    .transform((price) => {
      const [whole, fraction = ''] = price.split('.');
      return `${whole}.${fraction.padEnd(2, '0')}`;
    }),
  currency: z.literal('EGP'),
  billingInterval: z.literal('monthly'),
  available: z.boolean().optional(),
  terms: z
    .array(
      z
        .object({
          months: z.union([z.literal(3), z.literal(6), z.literal(12), z.literal(24)]),
          price: z
            .string()
            .regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
            .transform((value) => {
              const [whole, fraction = ''] = value.split('.');
              return `${whole}.${fraction.padEnd(2, '0')}`;
            }),
        })
        .strict(),
    )
    .max(4)
    .refine(
      (terms) => new Set(terms.map((term) => term.months)).size === terms.length,
      'Each duration must have only one price.',
    )
    .optional(),
});
const creation = settings.extend({ requestId: z.uuid() }).strict();
const update = settings.extend({ revision: z.number().int().min(1).max(2147483646) }).strict();

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = parseRequest(schema, body, { format: 'messages' });
  return result;
}

@UseGuards(AdminGuard)
@Controller('admin/plans')
export class PlanController {
  constructor(@Inject(PlanService) private readonly plans: PlanService) {}

  @Get()
  list(): Promise<MonthlyPlanSummary[]> {
    return this.plans.list();
  }

  @Post()
  async create(
    @Body() body: unknown,
    @CurrentAdmin() administrator: string,
  ): Promise<MonthlyPlanSummary> {
    return this.plans.create(parse(creation, body), administrator);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentAdmin() administrator: string,
  ): Promise<MonthlyPlanSummary> {
    return this.plans.update(id, parse(update, body), administrator);
  }
}
