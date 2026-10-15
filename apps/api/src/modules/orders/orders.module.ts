import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { InventoryModule } from '../inventory/index.js';
import { OrderLifecycleService } from './order-lifecycle.service.js';
import { CatalogModule } from '../catalog/index.js';
import {
  OwnerStorefrontOrdersController,
  PublicStorefrontOrdersController,
} from './storefront-orders.controller.js';
import { StorefrontOrdersService } from './storefront-orders.service.js';
@Module({
  imports: [AuthModule, CatalogModule, InventoryModule],
  controllers: [OwnerStorefrontOrdersController, PublicStorefrontOrdersController],
  providers: [StorefrontOrdersService, OrderLifecycleService],
})
export class OrdersModule {}
