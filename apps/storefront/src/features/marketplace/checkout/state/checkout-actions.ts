import type { StateCreator } from 'zustand/vanilla';
import { findProduct } from '@/features/marketplace/catalog/model/catalog';
import { validQuantity, type MarketplaceCartLine } from '@/features/marketplace/cart/model/cart';
import type { Fulfillment } from '@/features/marketplace/checkout/model/checkout';
import type { DemoOrder } from '@/features/marketplace/orders/model/demo-order';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';

export interface CheckoutActions {
  completeDemoCheckout: (
    snapshot: MarketplaceCartLine[],
    fulfillment: Fulfillment,
  ) => DemoOrder | null;
}

export const createCheckoutActions: StateCreator<MarketplaceState, [], [], CheckoutActions> = (
  set,
  get,
) => ({
  completeDemoCheckout: (snapshot, fulfillment) => {
    const state = get();
    if (!snapshot.length || JSON.stringify(state.cart) !== JSON.stringify(snapshot)) return null;
    const items = snapshot.flatMap((line) => {
      const product = findProduct(line.productId);
      return product && validQuantity(line.quantity)
        ? [{ ...product, quantity: line.quantity }]
        : [];
    });
    if (items.length !== snapshot.length) return null;

    const order: DemoOrder = {
      id: `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      status: 'demo-confirmed',
      fulfillment,
      items,
    };
    set((current) => ({
      orders: [order, ...current.orders],
      cart: [],
      cartOpen: false,
    }));
    return order;
  },
});
