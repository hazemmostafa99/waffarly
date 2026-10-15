import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { OwnerProfile } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { parseCursorPageQuery } from '../../../common/http/pagination.js';
import { CurrentOwner, OwnerGuard } from '../../auth/index.js';
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
  constructor(@Inject(CategoryService) private readonly categories: CategoryService) {}

  @Get()
  async list(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    return this.categories.list(owner.merchantId, parseCursorPageQuery(query));
  }

  @Post()
  async create(@CurrentOwner() owner: OwnerProfile, @Body() body: unknown) {
    const parsed = parseRequest(createSchema, body);
    return this.categories.create(owner.merchantId, owner.username, parsed);
  }

  @Patch(':id')
  async update(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const parsed = parseRequest(updateSchema, body);
    const { revision, ...input } = parsed;
    return this.categories.update(owner.merchantId, owner.username, id, revision, input);
  }

  @Post(':id/archive')
  async archive(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const revision = parseRevision(body);
    return this.categories.archive(owner.merchantId, owner.username, id, revision);
  }

  @Post(':id/restore')
  async restore(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const revision = parseRevision(body);
    return this.categories.restore(owner.merchantId, owner.username, id, revision);
  }

  @Delete(':id')
  async remove(@CurrentOwner() owner: OwnerProfile, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.categories.remove(owner.merchantId, id);
  }
}

function parseRevision(body: unknown): number {
  const parsed = parseRequest(revisionSchema, body);
  return parsed.revision;
}
