import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CategoryController } from './category.controller.js';
import { CategoryService } from './category.service.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { ProductController, ProductQuoteController } from './product.controller.js';
import { ProductService } from './product.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MediaController, CategoryController, ProductController, ProductQuoteController],
  providers: [MediaService, CategoryService, ProductService],
})
export class CatalogModule {}
