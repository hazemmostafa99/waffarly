import { StorefrontModule } from '../storefront/index.js';
import { CustomersModule } from '../customers/index.js';
import {
  OrderCustomerController,
  CustomerOrdersController,
} from './http/owner/order-customer.controller.js';
import { OrderCustomerService } from './customers/order-customer.service.js';
import { Module } from '@nestjs/common';
import { CustomerOrderAccessController } from './http/marketplace/customer-order-access.controller.js';
import { CustomerOrderAccessService } from './customers/customer-order-access.service.js';
import { PosDeliveryController } from './http/pos/pos-delivery.controller.js';
import { PosDeliveryService } from './delivery/pos-delivery.service.js';
import { AuthModule } from '../auth/index.js';
import { InventoryModule } from '../inventory/index.js';
import { OrderLifecycleService } from './fulfillment/order-lifecycle.service.js';
import { CatalogModule } from '../catalog/index.js';
import { ShiftsModule } from '../shifts/index.js';
import { PaymentsModule } from '../payments/index.js';
import { SubscriptionsModule } from '../subscriptions/index.js';
import { PublicStorefrontOrdersController } from './http/storefront/storefront-orders.controller.js';
import { OwnerStorefrontOrdersController } from './http/owner/owner-orders.controller.js';
import { PosStorefrontOrdersController } from './http/pos/pos-orders.controller.js';
import { StorefrontOrdersService } from './checkout/storefront-orders.service.js';
import { PosOrdersService } from './pos-sales/pos-orders.service.js';
import {
  PosDiningController,
  PosDiningOrdersController,
  OwnerPosDiningTablesController,
} from './http/pos/pos-dining.controller.js';
import { PosDiningService } from './dining/pos-dining.service.js';
import { PosReceiptsController } from './http/pos/pos-receipts.controller.js';
import { PosKitchenService } from './kitchen/pos-kitchen.service.js';
import { PosReturnsService } from './returns/pos-returns.service.js';
import { OwnerPosItemReturnsController } from './http/owner/pos-returns.controller.js';
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
    CustomerOrderAccessController,
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
    CustomerOrderAccessService,
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
