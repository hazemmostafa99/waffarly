import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { CatalogModule } from '../catalog/index.js';
import {
  OwnerStorefrontOrdersController,
  PublicStorefrontOrdersController,
} from './storefront-orders.controller.js';
import { StorefrontOrdersService } from './storefront-orders.service.js';
@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [OwnerStorefrontOrdersController, PublicStorefrontOrdersController],
  providers: [StorefrontOrdersService],
})
export class OrdersModule {}
