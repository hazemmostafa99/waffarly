import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ProductPricingService } from './product-pricing.service.js';
import { parseQuoteBody } from './quote.schemas.js';
@Controller('catalog/products')
export class ProductQuoteController {
  constructor(@Inject(ProductPricingService) private readonly products: ProductPricingService) {}

  @Post(':id/quote')
  @HttpCode(HttpStatus.OK)
  async quote(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    const input = parseQuoteBody(body);
    return this.products.quote(id, input.selections ?? [], input.variantId);
  }
}
