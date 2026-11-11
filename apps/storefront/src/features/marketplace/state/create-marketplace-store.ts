import { createStore } from 'zustand/vanilla';
import { createAccountSlice } from '@/features/marketplace/account/state/account-slice';
import { createCartSlice } from '@/features/marketplace/cart/state/cart-slice';
import { createCheckoutActions } from '@/features/marketplace/checkout/state/checkout-actions';
import { createFavoritesSlice } from '@/features/marketplace/favorites/state/favorites-slice';
import { createOrdersSlice } from '@/features/marketplace/orders/state/orders-slice';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';

// A single provider-scoped store lets checkout update the cart and order together.
export function createMarketplaceStore() {
  return createStore<MarketplaceState>()((...args) => ({
    ...createAccountSlice(...args),
    ...createCartSlice(...args),
    ...createFavoritesSlice(...args),
    ...createOrdersSlice(...args),
    ...createCheckoutActions(...args),
  }));
}
