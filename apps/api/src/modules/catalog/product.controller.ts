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
const modifierOptionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  priceAdjustment: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
  defaultSelected: z.boolean(),
  position: z.number().int().nonnegative(),
});
const modifierGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional(),
    selectionMode: z.enum(['single', 'multiple']),
    minSelections: z.number().int().nonnegative(),
    maxSelections: z.number().int().positive(),
    position: z.number().int().nonnegative(),
    options: z.array(modifierOptionSchema).min(1).max(100),
  })
  .superRefine((group, context) => {
    if (group.minSelections > group.maxSelections) {
      context.addIssue({
        code: 'custom',
        path: ['minSelections'],
        message: 'Minimum selections cannot exceed maximum selections.',
      });
    }
    if (group.maxSelections > group.options.length) {
      context.addIssue({
        code: 'custom',
        path: ['maxSelections'],
        message: 'Maximum selections cannot exceed the number of options.',
      });
    }
    if (group.selectionMode === 'single' && group.maxSelections !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['maxSelections'],
        message: 'Single-choice groups can select at most one option.',
      });
    }
    const defaults = group.options.filter((option) => option.defaultSelected).length;
    if (defaults > group.maxSelections) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Default selections cannot exceed the group selection limit.',
      });
    }
    if (new Set(group.options.map((option) => option.position)).size !== group.options.length) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Option positions must be unique within a group.',
      });
    }
  });
const modifierGroupsSchema = z
  .array(modifierGroupSchema)
  .max(30)
  .superRefine((groups, context) => {
    if (new Set(groups.map((group) => group.position)).size !== groups.length) {
      context.addIssue({ code: 'custom', message: 'Modifier group positions must be unique.' });
    }
  });
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
  modifierGroups: modifierGroupsSchema.optional(),
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
