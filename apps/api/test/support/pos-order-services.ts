/** Builds cashier services with shared dependencies for the operation under test. */
import { CheckRefundService } from '../../src/modules/orders/billing/check-refund.service.js';
import { CheckPaymentService } from '../../src/modules/orders/billing/check-payment.service.js';
import type { PaymentsService } from '../../src/modules/payments/index.js';
import { KitchenOrderAmendmentService } from '../../src/modules/orders/kitchen/kitchen-order-amendment.service.js';
import { PosOrderQueryService } from '../../src/modules/orders/pos-sales/pos-order-query.service.js';
import { PosReceiptQueryService } from '../../src/modules/orders/receipts/pos-receipt-query.service.js';
import { PickupCollectionService } from '../../src/modules/orders/billing/pickup-collection.service.js';
import { PosSaleService } from '../../src/modules/orders/pos-sales/pos-sale.service.js';

export function createPosOrderServices(
  ...dependencies: [...ConstructorParameters<typeof PosSaleService>, PaymentsService]
) {
  const [prisma, pricing, consumption, ledger, shifts, dining, payments] = dependencies;
  return {
    orderQueries: new PosOrderQueryService(prisma),
    receiptQueries: new PosReceiptQueryService(prisma),
    pickupCollection: new PickupCollectionService(prisma, shifts),
    checkRefunds: new CheckRefundService(prisma, shifts),
    checkPayments: new CheckPaymentService(prisma, shifts, payments),
    kitchenAmendments: new KitchenOrderAmendmentService(
      prisma,
      pricing,
      consumption,
      ledger,
      shifts,
    ),
    sales: new PosSaleService(prisma, pricing, consumption, ledger, shifts, dining),
  };
}
