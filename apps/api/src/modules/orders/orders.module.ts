/**
 * Connects the order entry points with the people, products, stock and payment features they need.
 */
import { StorefrontOrderStatusService } from './fulfillment/storefront-order-status.service.js';
import { CheckSplitService } from './billing/check-split.service.js';
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
import { StorefrontCustomerOrdersController } from './http/storefront/storefront-customer-orders.controller.js';
import { OwnerStorefrontOrdersController } from './http/owner/owner-orders.controller.js';
import { PosOrdersController } from './http/pos/pos-orders.controller.js';
import { PosOrderBillingController } from './http/pos/pos-order-billing.controller.js';
import { PosOrderKitchenController } from './http/pos/pos-order-kitchen.controller.js';
import { PosOrderReturnsController } from './http/pos/pos-order-returns.controller.js';
import { StorefrontOrdersService } from './checkout/storefront-orders.service.js';
import { CheckRefundService } from './billing/check-refund.service.js';
import { CheckPaymentService } from './billing/check-payment.service.js';
import { PosSaleService } from './pos-sales/pos-sale.service.js';
import { PosOrderQueryService } from './pos-sales/pos-order-query.service.js';
import { PosReceiptQueryService } from './receipts/pos-receipt-query.service.js';
import { PickupCollectionService } from './billing/pickup-collection.service.js';
import {
  PosDiningController,
  PosDiningOrdersController,
} from './http/pos/pos-dining.controller.js';
import { OwnerPosDiningTablesController } from './http/owner/owner-dining-tables.controller.js';
import { PosDiningService } from './dining/pos-dining.service.js';
import { PosReceiptsController } from './http/pos/pos-receipts.controller.js';
import { KitchenOrderAmendmentService } from './kitchen/kitchen-order-amendment.service.js';
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
    PosOrdersController,
    PosOrderKitchenController,
    PosOrderBillingController,
    PosOrderReturnsController,
    PublicStorefrontOrdersController,
    StorefrontCustomerOrdersController,
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
    StorefrontOrderStatusService,
    OrderLifecycleService,
    PosOrderQueryService,
    PosReceiptQueryService,
    PickupCollectionService,
    PosSaleService,
    CheckPaymentService,
    CheckSplitService,
    CheckRefundService,
    PosDiningService,
    PosKitchenService,
    KitchenOrderAmendmentService,
    PosReturnsService,
  ],
})
export class OrdersModule {}
