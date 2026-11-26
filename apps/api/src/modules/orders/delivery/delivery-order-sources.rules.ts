/**
 * Decides which delivery orders the cashier delivery desk can dispatch and follow.
 * Cashier deliveries and website deliveries (storefront and Waffarly) share one courier flow.
 */
import type { Prisma } from '@waffarly/database';

/** Order sources handled by the POS courier desk. */
export const deliveryDeskOrderSources = ['pos', 'storefront', 'waffarly'] as const;

/** Tenant-scoped filter for a delivery order the courier desk may handle. */
export function deliveryDeskOrderWhere(
  merchantId: string,
  orderId: string,
): Prisma.StorefrontOrderWhereInput {
  return {
    id: orderId,
    merchantId,
    source: { in: [...deliveryDeskOrderSources] },
    fulfillmentType: 'delivery',
  };
}

/**
 * A website delivery has no cashier shift until its first dispatch. That dispatch
 * links it to the dispatching cashier's open shift so customer and courier cash
 * follow the same shift rules as cashier deliveries.
 */
export function needsShiftLinkOnDispatch(order: {
  source: string;
  posShiftId: string | null;
}): boolean {
  return order.source !== 'pos' && order.posShiftId === null;
}
