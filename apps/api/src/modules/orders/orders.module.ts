import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { InventoryModule } from '../inventory/index.js';
import { OrderLifecycleService } from './order-lifecycle.service.js';
import { CatalogModule } from '../catalog/index.js';
import { ShiftsModule } from '../shifts/index.js';
import { PaymentsModule } from '../payments/index.js';
import {
  OwnerStorefrontOrdersController,
  PosStorefrontOrdersController,
  PublicStorefrontOrdersController,
} from './storefront-orders.controller.js';
import { StorefrontOrdersService } from './storefront-orders.service.js';
import { PosOrdersService } from './pos-orders.service.js';
import {
  PosDiningController,
  PosDiningOrdersController,
  OwnerPosDiningTablesController,
} from './pos-dining.controller.js';
import { PosDiningService } from './pos-dining.service.js';
@Module({
  imports: [AuthModule, CatalogModule, InventoryModule, ShiftsModule, PaymentsModule],
  controllers: [
    OwnerStorefrontOrdersController,
    PosStorefrontOrdersController,
    PublicStorefrontOrdersController,
    OwnerPosDiningTablesController,
    PosDiningController,
    PosDiningOrdersController,
  ],
  providers: [StorefrontOrdersService, OrderLifecycleService, PosOrdersService, PosDiningService],
})
export class OrdersModule {}
