import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CategoryController } from './category.controller.js';
import { CategoryService } from './category.service.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { ModifierGroupController } from './modifier-group.controller.js';
import { ModifierGroupService } from './modifier-group.service.js';
import { ProductConfigurationReportController } from './product-configuration-report.controller.js';
import { ProductConfigurationReportService } from './product-configuration-report.service.js';
import {
  ProductController,
  ProductQuoteController,
  PublicStorefrontController,
} from './product.controller.js';
import { ProductService } from './product.service.js';
import {
  OwnerStorefrontOrdersController,
  PublicStorefrontOrdersController,
} from './storefront-orders.controller.js';
import { StorefrontOrdersService } from './storefront-orders.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    MediaController,
    ModifierGroupController,
    ProductConfigurationReportController,
    CategoryController,
    ProductController,
    ProductQuoteController,
    PublicStorefrontController,
    PublicStorefrontOrdersController,
    OwnerStorefrontOrdersController,
  ],
  providers: [
    MediaService,
    CategoryService,
    ModifierGroupService,
    ProductConfigurationReportService,
    ProductService,
    StorefrontOrdersService,
  ],
})
export class CatalogModule {}
