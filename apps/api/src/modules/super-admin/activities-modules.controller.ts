import { BUSINESS_ACTIVITY_KEYS } from '@waffarly/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { ActivitiesModulesService } from './activities-modules.service.js';

const moduleKey = z.enum(['merchant-profile', 'storefront-design']);
const settings = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000),
  revision: z.number().int().min(0).max(2147483646),
});
const activitySettings = settings.extend({ moduleKeys: z.array(moduleKey).max(2) }).strict();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  return result.data;
}

@UseGuards(AdminGuard)
@Controller('admin/activities-modules')
export class ActivitiesModulesController {
  constructor(
    @Inject(ActivitiesModulesService) private readonly catalog: ActivitiesModulesService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  list() {
    return this.catalog.catalog();
  }

  @Patch('activities/:key')
  async updateActivity(@Param('key') key: string, @Body() body: unknown, @Req() request: Request) {
    return this.catalog.updateActivity(
      parse(z.enum(BUSINESS_ACTIVITY_KEYS), key),
      parse(activitySettings, body),
      await this.auth.requireAdmin(request),
    );
  }

  @Patch('modules/:key')
  async updateModule(@Param('key') key: string, @Body() body: unknown, @Req() request: Request) {
    return this.catalog.updateModule(
      parse(moduleKey, key),
      parse(settings.strict(), body),
      await this.auth.requireAdmin(request),
    );
  }
}
