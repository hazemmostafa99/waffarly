import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { CursorPage, PublicStorefrontCatalog } from '@waffarly/contracts';
import { CatalogQueryService, ProductPricingService, parseQuoteBody } from '../catalog/index.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { z } from 'zod';

const catalogCursorSchema = z.object({ cursor: z.string().uuid().optional() });
@Controller('catalog/stores')
export class PublicStorefrontController {
  constructor(
    @Inject(CatalogQueryService) private readonly catalog: CatalogQueryService,
    @Inject(ProductPricingService) private readonly pricing: ProductPricingService,
  ) {}

  @Get(':slug')
  async get(@Param('slug') slug: string) {
    assertValidStorefrontSlug(slug);
    return this.catalog.getPublicStorefrontCatalog(slug);
  }

  @Get(':slug/categories')
  async categories(
    @Param('slug') slug: string,
    @Query() query: unknown,
  ): Promise<CursorPage<PublicStorefrontCatalog['categories'][number]>> {
    assertValidStorefrontSlug(slug);
    const { cursor } = parseRequest(catalogCursorSchema, query);
    return this.catalog.getPublicStorefrontCategories(slug, cursor);
  }

  @Get(':slug/products')
  async products(
    @Param('slug') slug: string,
    @Query() query: unknown,
  ): Promise<CursorPage<PublicStorefrontCatalog['products'][number]>> {
    assertValidStorefrontSlug(slug);
    const { cursor } = parseRequest(catalogCursorSchema, query);
    return this.catalog.getPublicStorefrontProducts(slug, cursor);
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
    return this.pricing.quote(id, input.selections ?? [], input.variantId, slug);
  }
}
function assertValidStorefrontSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    throw new BadRequestException('Storefront address is invalid.');
  }
}
