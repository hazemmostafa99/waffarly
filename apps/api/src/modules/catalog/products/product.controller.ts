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
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { parseCursorPageQuery } from '../../../common/http/pagination.js';
import { CurrentOwner, OwnerGuard } from '../../auth/index.js';
import {
  attachModifierGroupSchema,
  createSchema,
  revisionSchema,
  updateSchema,
} from './product.schemas.js';
import { ProductService } from './product.service.js';
@UseGuards(OwnerGuard)
@Controller('owner/catalog/products')
export class ProductController {
  constructor(@Inject(ProductService) private readonly products: ProductService) {}

  @Get()
  async list(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    return this.products.list(owner.merchantId, parseCursorPageQuery(query));
  }

  @Get(':id')
  async get(@CurrentOwner() owner: OwnerProfile, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.products.get(owner.merchantId, id);
  }

  @Post()
  async create(@CurrentOwner() owner: OwnerProfile, @Body() body: unknown) {
    const parsed = parseRequest(createSchema, body);
    return this.products.create(owner.merchantId, owner.username, parsed);
  }

  @Patch(':id')
  async update(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const parsed = parseRequest(updateSchema, body);
    const { revision, ...input } = parsed;
    return this.products.update(owner.merchantId, owner.username, id, revision, input);
  }

  @Post(':id/modifier-groups')
  async attachModifierGroup(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const parsed = parseRequest(attachModifierGroupSchema, body);
    const { revision, ...assignment } = parsed;
    return this.products.attachModifierGroup(
      owner.merchantId,
      owner.username,
      id,
      revision,
      assignment,
    );
  }

  @Delete(':id/modifier-groups/:assignmentId')
  async detachModifierGroup(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string,
    @Body() body: unknown,
  ) {
    const revision = parseRevision(body);
    return this.products.detachModifierGroup(
      owner.merchantId,
      owner.username,
      id,
      assignmentId,
      revision,
    );
  }

  @Post(':id/archive')
  async archive(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const revision = parseRevision(body);
    return this.products.archive(owner.merchantId, owner.username, id, revision);
  }

  @Post(':id/restore')
  async restore(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const revision = parseRevision(body);
    return this.products.restore(owner.merchantId, owner.username, id, revision);
  }

  @Delete(':id')
  async remove(@CurrentOwner() owner: OwnerProfile, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.products.remove(owner.merchantId, id);
  }
}
function parseRevision(body: unknown): number {
  const parsed = parseRequest(revisionSchema, body);
  return parsed.revision;
}
