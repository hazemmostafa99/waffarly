import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { CatalogModule } from '../catalog/index.js';
import { PublicStorefrontController } from './public-storefront.controller.js';
import { StorefrontController } from './storefront.controller.js';
import { StorefrontService } from './storefront.service.js';
import { TemplateController } from './template.controller.js';
import { TemplateService } from './template.service.js';
@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [StorefrontController, TemplateController, PublicStorefrontController],
  providers: [StorefrontService, TemplateService],
})
export class StorefrontModule {}
