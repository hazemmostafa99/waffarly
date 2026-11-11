import type { StateCreator } from 'zustand/vanilla';
import { cartProducts, validQuantity, type MarketplaceCartLine } from '@/features/marketplace/cart/model/cart';
import { restaurantCheckout } from '@/features/marketplace/checkout/model/restaurant-checkout';
import type { Fulfillment } from '@/features/marketplace/checkout/model/checkout';
import type { DemoOrder } from '@/features/marketplace/orders/model/demo-order';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';

export interface CheckoutActions {
  completeDemoCheckout: (
    snapshot: MarketplaceCartLine[],
    fulfillment: Fulfillment,
    pricing?: { unitPrices: string[]; deliveryFee: string },
  ) => DemoOrder | null;
}

export const createCheckoutActions: StateCreator<MarketplaceState, [], [], CheckoutActions> = (
  set,
  get,
) => ({
  completeDemoCheckout: (snapshot, fulfillment, pricing) => {
    const state = get();
    if (!snapshot.length || JSON.stringify(state.cart) !== JSON.stringify(snapshot)) return null;
    if (snapshot.some((line) => !validQuantity(line.quantity))) return null;
    const items = cartProducts(snapshot);
    if (pricing) {
      if (pricing.unitPrices.length !== items.length || !Number.isFinite(Number(pricing.deliveryFee)) || Number(pricing.deliveryFee) < 0) return null;
      for (const [index, item] of items.entries()) {
        const price = Number(pricing.unitPrices[index]);
        if (!Number.isFinite(price) || price < 0) return null;
        item.price = price;
      }
    }
    if (items.length !== snapshot.length) return null;
    const summary = restaurantCheckout(items, fulfillment);
    if (summary.issue) return null;

    const order: DemoOrder = {
      id: `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      status: 'demo-confirmed',
      fulfillment,
      items,
      deliveryFee: pricing ? Number(pricing.deliveryFee) : summary.deliveryFee,
      restaurantName: summary.name,
    };
    set((current) => ({
      orders: [order, ...current.orders],
      cart: [],
      cartOpen: false,
    }));
    return order;
  },
});
