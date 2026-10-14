import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import type { CatalogProductQuoteRequest } from '@waffarly/contracts';
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
const productVariantsSchema = z
  .array(
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(160),
      sku: z.string().trim().max(80).optional(),
      barcode: z.string().trim().max(80).optional(),
      price: z
        .string()
        .refine(
          isValidProductPrice,
          `Variant price must be between 0.01 and ${MAX_PRODUCT_PRICE} EGP with at most two decimals.`,
        ),
      stockQuantity: z.number().int().min(0).max(2_147_483_647).nullable().optional(),
      availability,
      position: z.number().int().nonnegative(),
      attributes: z
        .array(
          z.object({
            attributeId: z.string().uuid().optional(),
            valueId: z.string().uuid().optional(),
            name: z.string().trim().min(1).max(120),
            value: z.string().trim().min(1).max(120),
          }).strict(),
        )
        .max(10)
        .optional(),
    }),
  )
  .max(100)
  .superRefine((variants, context) => {
    const positions = new Set<number>();
    const skus = new Set<string>();
    const barcodes = new Set<string>();
    variants.forEach((variant, index) => {
      if (positions.has(variant.position)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'position'],
          message: 'Variant positions must be unique.',
        });
      }
      positions.add(variant.position);
      const sku = variant.sku?.toLocaleLowerCase();
      const barcode = variant.barcode?.toLocaleLowerCase();
      if (sku && skus.has(sku)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'sku'],
          message: 'Variant SKUs must be unique.',
        });
      }
      if (barcode && barcodes.has(barcode)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'barcode'],
          message: 'Variant barcodes must be unique.',
        });
      }
      if (sku) skus.add(sku);
      if (barcode) barcodes.add(barcode);
    });
  });
const modifierAssignmentSchema = z
  .object({
    modifierGroupId: z.string().uuid(),
    selectionMode: z.enum(['single', 'multiple']),
    minSelections: z.number().int().nonnegative(),
    maxSelections: z.number().int().positive(),
    position: z.number().int().nonnegative(),
    options: z.array(z.object({
      optionId: z.string().uuid(),
      priceAdjustment: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
      defaultSelected: z.boolean(),
    }).strict()).min(1).max(100),
  })
  .strict()
  .superRefine((group, context) => {
    if (group.minSelections > group.maxSelections) {
      context.addIssue({ code: 'custom', path: ['minSelections'], message: 'Minimum selections cannot exceed maximum selections.' });
    }
    if (group.selectionMode === 'single' && group.maxSelections !== 1) {
      context.addIssue({ code: 'custom', path: ['maxSelections'], message: 'Single-choice groups can select at most one option.' });
    }
    if (new Set(group.options.map((option) => option.optionId)).size !== group.options.length) {
      context.addIssue({ code: 'custom', path: ['options'], message: 'Modifier options must be unique within a group.' });
    }
  });
const modifierAssignmentsSchema = z.array(modifierAssignmentSchema).max(30).superRefine((groups, context) => {
  if (new Set(groups.map((group) => group.position)).size !== groups.length) {
    context.addIssue({ code: 'custom', message: 'Modifier group positions must be unique.' });
  }
  if (new Set(groups.map((group) => group.modifierGroupId)).size !== groups.length) {
    context.addIssue({ code: 'custom', message: 'A modifier group can only be assigned once.' });
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
  modifierGroupAssignments: modifierAssignmentsSchema.optional(),
  variants: productVariantsSchema.optional(),
};
const createSchema = z.object(productFields);
const updateSchema = z.object(productFields).partial().extend({
  revision: z.number().int().positive(),
});
const revisionSchema = z.object({ revision: z.number().int().positive() });
const attachModifierGroupSchema = modifierAssignmentSchema
  .safeExtend({ revision: z.number().int().positive() })
  .strict();
const quoteSelectionSchema = z
  .object({
    groupId: z.string().uuid(),
    optionIds: z.array(z.string().uuid()).max(100),
  })
  .strict();
const quoteSchema = z
  .object({
    variantId: z.string().uuid().optional(),
    selections: z.array(quoteSelectionSchema).max(30).optional(),
  })
  .strict();

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

  @Post(':id/modifier-groups')
  async attachModifierGroup(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const parsed = attachModifierGroupSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const { revision, ...assignment } = parsed.data;
    const owner = await this.auth.requireOwner(request);
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
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string,
    @Body() body: unknown,
  ) {
    const revision = parseRevision(body);
    const owner = await this.auth.requireOwner(request);
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

@Controller('catalog/products')
export class ProductQuoteController {
  constructor(@Inject(ProductService) private readonly products: ProductService) {}

  @Post(':id/quote')
  @HttpCode(HttpStatus.OK)
  async quote(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    const input = parseQuoteBody(body);
    return this.products.quote(id, input.selections ?? [], input.variantId);
  }
}

@Controller('catalog/stores')
export class PublicStorefrontController {
  constructor(@Inject(ProductService) private readonly products: ProductService) {}

  @Get(':slug')
  async get(@Param('slug') slug: string) {
    assertValidStorefrontSlug(slug);
    return this.products.getPublicStorefrontCatalog(slug);
  }

  @Post(':slug/products/:id/quote')
  @HttpCode(HttpStatus.OK)
  async quote(
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    assertValidStorefrontSlug(slug);
    const input = parseQuoteBody(body);
    return this.products.quote(id, input.selections ?? [], input.variantId, slug);
  }
}

function assertValidStorefrontSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    throw new BadRequestException('Storefront address is invalid.');
  }
}

function parseQuoteBody(body: unknown): CatalogProductQuoteRequest {
  const parsed = quoteSchema.safeParse(body ?? {});
  if (!parsed.success) throw new BadRequestException(parsed.error.issues);
  return parsed.data;
}

function parseRevision(body: unknown): number {
  const parsed = revisionSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues);
  return parsed.data.revision;
}
