import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createAccountSlice } from '@/features/marketplace/account/state/account-slice';
import { createCartSlice } from '@/features/marketplace/cart/state/cart-slice';
import { createCheckoutActions } from '@/features/marketplace/checkout/state/checkout-actions';
import { createFavoritesSlice } from '@/features/marketplace/favorites/state/favorites-slice';
import { createOrdersSlice } from '@/features/marketplace/orders/state/orders-slice';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';
import { validQuantity, type MarketplaceCartLine } from '@/features/marketplace/cart/model/cart';

const CART_STORAGE_KEY = 'waffarly-marketplace-cart-v1';

function readStoredCart(value: unknown): MarketplaceCartLine[] {
  if (!Array.isArray(value)) return [];
  return value.filter((line): line is MarketplaceCartLine => {
    if (typeof line !== 'object' || line === null) return false;
    const item = line as Partial<MarketplaceCartLine>;
    if (
      typeof item.productId !== 'string' ||
      item.productId.length === 0 ||
      item.productId.length > 200
    )
      return false;
    if (typeof item.quantity !== 'number' || !validQuantity(item.quantity)) return false;
    if (
      item.quotedUnitPrice !== undefined &&
      (typeof item.quotedUnitPrice !== 'number' ||
        !Number.isFinite(item.quotedUnitPrice) ||
        item.quotedUnitPrice < 0)
    )
      return false;
    if (
      item.snapshot !== undefined &&
      (typeof item.snapshot !== 'object' ||
        item.snapshot === null ||
        item.snapshot.id !== item.productId)
    )
      return false;
    if (
      item.selection !== undefined &&
      (typeof item.selection !== 'object' ||
        item.selection === null ||
        Object.values(item.selection).some(
          (ids) => !Array.isArray(ids) || ids.some((id) => typeof id !== 'string'),
        ))
    )
      return false;
    return true;
  });
}

// A single provider-scoped store lets checkout update the cart and order together.
export function createMarketplaceStore() {
  return createStore<MarketplaceState>()(
    persist(
      (...args) => ({
        ...createAccountSlice(...args),
        ...createCartSlice(...args),
        ...createFavoritesSlice(...args),
        ...createOrdersSlice(...args),
        ...createCheckoutActions(...args),
      }),
      {
        name: CART_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ cart: state.cart }),
        skipHydration: true,
        merge: (persistedState, currentState) => ({
          ...currentState,
          cart: readStoredCart((persistedState as { cart?: unknown } | undefined)?.cart),
        }),
      },
    ),
  );
}
