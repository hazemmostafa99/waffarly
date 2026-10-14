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
import { MAX_PRODUCT_PRICE, isValidProductPrice } from './catalog.constants.js';
import { AuthService } from '../auth/auth.service.js';
import { OwnerGuard } from '../auth/owner.guard.js';
import { ProductService } from './product.service.js';

const availability = z.enum(['available', 'unavailable']);
const productFields = {
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  basePrice: z
    .string()
    .refine(
      isValidProductPrice,
      `Base price must be between 0.01 and ${MAX_PRODUCT_PRICE} EGP with at most two decimals.`,
    ),
  availability,
  imageAssetIds: z.array(z.string().uuid()).min(1).max(10),
  primaryImageAssetId: z.string().uuid().optional(),
  categoryIds: z.array(z.string().uuid()).min(1),
};
const createSchema = z.object(productFields);
const updateSchema = z.object(productFields).partial().extend({
  revision: z.number().int().positive(),
});
const revisionSchema = z.object({ revision: z.number().int().positive() });

@UseGuards(OwnerGuard)
@Controller('owner/catalog/products')
export class ProductController {
  constructor(
    @Inject(ProductService) private readonly products: ProductService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  async list(@Req() request: Request) {
    const owner = await this.auth.requireOwner(request);
    return this.products.list(owner.merchantId);
  }

  @Post()
  async create(@Req() request: Request, @Body() body: unknown) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const owner = await this.auth.requireOwner(request);
    return this.products.create(owner.merchantId, owner.username, parsed.data);
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
    return this.products.update(owner.merchantId, owner.username, id, revision, input);
  }

  @Post(':id/archive')
  async archive(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const revision = parseRevision(body);
    const owner = await this.auth.requireOwner(request);
    return this.products.archive(owner.merchantId, owner.username, id, revision);
  }

  @Post(':id/restore')
  async restore(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const revision = parseRevision(body);
    const owner = await this.auth.requireOwner(request);
    return this.products.restore(owner.merchantId, owner.username, id, revision);
  }

  @Delete(':id')
  async remove(@Req() request: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    const owner = await this.auth.requireOwner(request);
    return this.products.remove(owner.merchantId, id);
  }
}

function parseRevision(body: unknown): number {
  const parsed = revisionSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues);
  return parsed.data.revision;
}
