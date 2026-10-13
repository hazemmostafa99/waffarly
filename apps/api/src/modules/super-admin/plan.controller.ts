import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { MonthlyPlanSummary } from '@waffarly/contracts';
import { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthService } from '../auth/auth.service.js';
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
  currency: z.enum(['EGP', 'USD', 'EUR']),
  billingInterval: z.literal('monthly'),
});
const creation = settings.extend({ requestId: z.uuid() }).strict();
const update = settings.extend({ revision: z.number().int().min(1).max(2147483646) }).strict();

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return result.data;
}

@UseGuards(AdminGuard)
@Controller('admin/plans')
export class PlanController {
  constructor(
    @Inject(PlanService) private readonly plans: PlanService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  list(): Promise<MonthlyPlanSummary[]> {
    return this.plans.list();
  }

  @Post()
  async create(@Body() body: unknown, @Req() request: Request): Promise<MonthlyPlanSummary> {
    return this.plans.create(parse(creation, body), await this.auth.requireAdmin(request));
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<MonthlyPlanSummary> {
    return this.plans.update(id, parse(update, body), await this.auth.requireAdmin(request));
  }
}
