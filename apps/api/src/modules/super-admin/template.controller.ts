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
import type { StorefrontTemplateSummary } from '@waffarly/contracts';
import { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { TemplateService } from './template.service.js';

const settings = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000),
  activity: z.literal('restaurant'),
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
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return result.data;
}

@UseGuards(AdminGuard)
@Controller('admin/templates')
export class TemplateController {
  constructor(
    @Inject(TemplateService) private readonly templates: TemplateService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  list(): Promise<StorefrontTemplateSummary[]> {
    return this.templates.list();
  }

  @Post()
  async create(@Body() body: unknown, @Req() request: Request): Promise<StorefrontTemplateSummary> {
    return this.templates.create(parse(creation, body), await this.auth.requireAdmin(request));
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<StorefrontTemplateSummary> {
    return this.templates.update(id, parse(update, body), await this.auth.requireAdmin(request));
  }
}
