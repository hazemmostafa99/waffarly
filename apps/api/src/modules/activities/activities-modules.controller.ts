import { Body, Controller, Get, Inject, Param, Patch, UseGuards } from '@nestjs/common';
import { BUSINESS_ACTIVITY_KEYS } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { AdminGuard, CurrentAdmin } from '../auth/index.js';
import { ActivitiesModulesService } from './activities-modules.service.js';

const moduleKey = z.enum(['merchant-profile', 'storefront-design']);
const settings = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000),
  revision: z.number().int().min(0).max(2147483646),
});
const activitySettings = settings.extend({ moduleKeys: z.array(moduleKey).max(2) }).strict();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = parseRequest(schema, value, { format: 'messages' });
  return result;
}

@UseGuards(AdminGuard)
@Controller('admin/activities-modules')
export class ActivitiesModulesController {
  constructor(
    @Inject(ActivitiesModulesService) private readonly catalog: ActivitiesModulesService,
  ) {}

  @Get()
  list() {
    return this.catalog.catalog();
  }

  @Patch('activities/:key')
  async updateActivity(
    @Param('key') key: string,
    @Body() body: unknown,
    @CurrentAdmin() administrator: string,
  ) {
    return this.catalog.updateActivity(
      parse(z.enum(BUSINESS_ACTIVITY_KEYS), key),
      parse(activitySettings, body),
      administrator,
    );
  }

  @Patch('modules/:key')
  async updateModule(
    @Param('key') key: string,
    @Body() body: unknown,
    @CurrentAdmin() administrator: string,
  ) {
    return this.catalog.updateModule(
      parse(moduleKey, key),
      parse(settings.strict(), body),
      administrator,
    );
  }
}
