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
import type { StorefrontTemplateSummary } from '@waffarly/contracts';
import { BUSINESS_ACTIVITY_KEYS } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { AdminGuard, CurrentAdmin } from '../auth/index.js';
import { TemplateService } from './template.service.js';

const settings = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000),
  activity: z.enum(['general', ...BUSINESS_ACTIVITY_KEYS]),
  layout: z.enum(['menu', 'hero']),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .transform((color) => color.toLowerCase()),
  status: z.enum(['draft', 'available']),
});
const creation = settings
  .extend({
    key: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();
const update = settings.extend({ revision: z.number().int().min(1).max(2147483646) }).strict();

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = parseRequest(schema, body, { format: 'messages' });
  return result;
}

@UseGuards(AdminGuard)
@Controller('admin/templates')
export class TemplateController {
  constructor(@Inject(TemplateService) private readonly templates: TemplateService) {}

  @Get()
  list(): Promise<StorefrontTemplateSummary[]> {
    return this.templates.list();
  }

  @Post()
  async create(
    @Body() body: unknown,
    @CurrentAdmin() administrator: string,
  ): Promise<StorefrontTemplateSummary> {
    return this.templates.create(parse(creation, body), administrator);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentAdmin() administrator: string,
  ): Promise<StorefrontTemplateSummary> {
    return this.templates.update(id, parse(update, body), administrator);
  }
}
