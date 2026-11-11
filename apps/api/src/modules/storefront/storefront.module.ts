import { RestaurantOrderPolicyService } from './restaurant-order-policy.service.js';
import { RestaurantProfileService } from './restaurant-profile.service.js';
import { OwnerRestaurantProfileController, PublicRestaurantProfileController } from './restaurant-profile.controller.js';
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
  controllers: [OwnerRestaurantProfileController, PublicRestaurantProfileController, StorefrontController, TemplateController, PublicStorefrontController],
  exports: [RestaurantOrderPolicyService],
  providers: [RestaurantOrderPolicyService, RestaurantProfileService, StorefrontService, TemplateService],
})
export class StorefrontModule {}
