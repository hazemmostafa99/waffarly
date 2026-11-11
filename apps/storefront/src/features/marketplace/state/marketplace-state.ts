import type { CartSlice } from '@/features/marketplace/cart/state/cart-slice';
import type { CheckoutActions } from '@/features/marketplace/checkout/state/checkout-actions';
import type { FavoritesSlice } from '@/features/marketplace/favorites/state/favorites-slice';
import type { OrdersSlice } from '@/features/marketplace/orders/state/orders-slice';

/** Shared type for the composed Marketplace store. State and actions stay feature-owned. */
export type MarketplaceState = CartSlice & FavoritesSlice & OrdersSlice & CheckoutActions;
