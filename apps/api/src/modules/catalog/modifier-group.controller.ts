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
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';
import { OwnerGuard } from '../auth/owner.guard.js';
import { ModifierGroupService } from './modifier-group.service.js';

const optionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  position: z.number().int().nonnegative(),
});
const fieldsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  options: z.array(optionSchema).min(1).max(100),
});
const createSchema = fieldsSchema.strict();
const updateSchema = fieldsSchema.partial().extend({
  revision: z.number().int().positive(),
}).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 1) {
    context.addIssue({ code: 'custom', message: 'Provide at least one modifier group field to update.' });
  }
});

@UseGuards(OwnerGuard)
@Controller('owner/catalog/modifier-groups')
export class ModifierGroupController {
  constructor(
    @Inject(ModifierGroupService) private readonly groups: ModifierGroupService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  async list(@Req() request: Request) {
    const owner = await this.auth.requireOwner(request);
    return this.groups.list(owner.merchantId);
  }

  @Get(':id')
  async get(@Req() request: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    const owner = await this.auth.requireOwner(request);
    return this.groups.get(owner.merchantId, id);
  }

  @Post()
  async create(@Req() request: Request, @Body() body: unknown) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const owner = await this.auth.requireOwner(request);
    return this.groups.create(owner.merchantId, parsed.data);
  }

  @Patch(':id')
  async update(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const owner = await this.auth.requireOwner(request);
    return this.groups.update(owner.merchantId, id, parsed.data);
  }
}
