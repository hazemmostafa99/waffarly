import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { InventoryModule } from '../inventory/index.js';
import { CatalogQueryService } from './catalog-query.service.js';
import { CategoryController } from './categories/category.controller.js';
import { CategoryService } from './categories/category.service.js';
import { ModifierGroupController } from './modifiers/modifier-group.controller.js';
import { ModifierGroupService } from './modifiers/modifier-group.service.js';
import { ProductPricingService } from './pricing/product-pricing.service.js';
import { ProductQuoteController } from './pricing/product-quote.controller.js';
import { ProductController } from './products/product.controller.js';
import { ProductService } from './products/product.service.js';
@Module({
  imports: [AuthModule, InventoryModule],
  controllers: [
    CategoryController,
    ModifierGroupController,
    ProductController,
    ProductQuoteController,
  ],
  providers: [
    CategoryService,
    ModifierGroupService,
    ProductService,
    ProductPricingService,
    CatalogQueryService,
  ],
  exports: [ProductPricingService, CatalogQueryService],
})
export class CatalogModule {}
