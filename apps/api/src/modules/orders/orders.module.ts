import { StorefrontModule } from '../storefront/index.js';
import { CustomersModule } from '../customers/index.js';
import { OrderCustomerController, CustomerOrdersController } from './order-customer.controller.js';
import { OrderCustomerService } from './order-customer.service.js';
import { Module } from '@nestjs/common';
import { PosDeliveryController } from './pos-delivery.controller.js';
import { PosDeliveryService } from './pos-delivery.service.js';
import { AuthModule } from '../auth/index.js';
import { InventoryModule } from '../inventory/index.js';
import { OrderLifecycleService } from './order-lifecycle.service.js';
import { CatalogModule } from '../catalog/index.js';
import { ShiftsModule } from '../shifts/index.js';
import { PaymentsModule } from '../payments/index.js';
import { SubscriptionsModule } from '../subscriptions/index.js';
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
import { PosReceiptsController } from './pos-receipts.controller.js';
import { PosKitchenService } from './pos-kitchen.service.js';
import { PosReturnsService } from './pos-returns.service.js';
import { OwnerPosItemReturnsController } from './pos-returns.controller.js';
@Module({
  imports: [
    CustomersModule,
    StorefrontModule,
    AuthModule,
    CatalogModule,
    InventoryModule,
    ShiftsModule,
    PaymentsModule,
    SubscriptionsModule,
  ],
  controllers: [
    OrderCustomerController,
    CustomerOrdersController,
    PosDeliveryController,
    OwnerPosItemReturnsController,
    OwnerStorefrontOrdersController,
    PosStorefrontOrdersController,
    PublicStorefrontOrdersController,
    OwnerPosDiningTablesController,
    PosDiningController,
    PosDiningOrdersController,
    PosReceiptsController,
  ],
  providers: [
    OrderCustomerService,
    PosDeliveryService,
    StorefrontOrdersService,
    OrderLifecycleService,
    PosOrdersService,
    PosDiningService,
    PosKitchenService,
    PosReturnsService,
  ],
})
export class OrdersModule {}
