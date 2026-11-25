import { Body, Controller, Get, Inject, Param, Patch, UseGuards } from '@nestjs/common';
import { BUSINESS_ACTIVITY_KEYS } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { AdminGuard, CurrentAdmin } from '../auth/index.js';
import { ActivitiesService } from './activities.service.js';

const settings = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000),
    features: z
      .object({ kitchen: z.boolean(), diningTables: z.boolean(), delivery: z.boolean() })
      .strict(),
    revision: z.number().int().min(0).max(2147483646),
  })
  .strict();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  return parseRequest(schema, value, { format: 'messages' });
}

@UseGuards(AdminGuard)
@Controller('admin/activities')
export class ActivitiesController {
  constructor(@Inject(ActivitiesService) private readonly activities: ActivitiesService) {}

  @Get()
  list() {
    return this.activities.list();
  }

  @Patch(':key')
  update(@Param('key') key: string, @Body() body: unknown, @CurrentAdmin() administrator: string) {
    return this.activities.update(
      parse(z.enum(BUSINESS_ACTIVITY_KEYS), key),
      parse(settings, body),
      administrator,
    );
  }
}
