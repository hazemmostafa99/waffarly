import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { CategoryService } from './category.service.js';

const availability = z.enum(['available', 'unavailable']);
const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  imageAssetId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  availability,
});
const updateSchema = createSchema.partial().extend({ revision: z.number().int().positive() });
const revisionSchema = z.object({ revision: z.number().int().positive() });

@UseGuards(OwnerGuard)
@Controller('owner/catalog/categories')
export class CategoryController {
  constructor(
    @Inject(CategoryService) private readonly categories: CategoryService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  async list(@Req() request: Request) {
    const owner = await this.auth.requireOwner(request);
    return this.categories.list(owner.merchantId);
  }

  @Post()
  async create(@Req() request: Request, @Body() body: unknown) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const owner = await this.auth.requireOwner(request);
    return this.categories.create(owner.merchantId, owner.username, parsed.data);
  }

  @Patch(':id')
  async update(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const { revision, ...input } = parsed.data;
    const owner = await this.auth.requireOwner(request);
    return this.categories.update(owner.merchantId, owner.username, id, revision, input);
  }

  @Post(':id/archive')
  async archive(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const revision = parseRevision(body);
    const owner = await this.auth.requireOwner(request);
    return this.categories.archive(owner.merchantId, owner.username, id, revision);
  }

  @Post(':id/restore')
  async restore(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const revision = parseRevision(body);
    const owner = await this.auth.requireOwner(request);
    return this.categories.restore(owner.merchantId, owner.username, id, revision);
  }

  @Delete(':id')
  async remove(@Req() request: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    const owner = await this.auth.requireOwner(request);
    return this.categories.remove(owner.merchantId, id);
  }
}

function parseRevision(body: unknown): number {
  const parsed = revisionSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues);
  return parsed.data.revision;
}
