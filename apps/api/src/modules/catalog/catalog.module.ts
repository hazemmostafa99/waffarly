import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CategoryController } from './category.controller.js';
import { CategoryService } from './category.service.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
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
    CategoryController,
    ProductController,
    ProductQuoteController,
    PublicStorefrontController,
    PublicStorefrontOrdersController,
    OwnerStorefrontOrdersController,
  ],
  providers: [MediaService, CategoryService, ProductService, StorefrontOrdersService],
})
export class CatalogModule {}
