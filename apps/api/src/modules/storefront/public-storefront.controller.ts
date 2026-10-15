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
} from '@nestjs/common';
import { CatalogQueryService, ProductPricingService, parseQuoteBody } from '../catalog/index.js';
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
