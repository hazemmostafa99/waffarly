import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CatalogProductQuoteSelection } from '@waffarly/contracts';

export interface StorefrontCartLine {
  key: string;
  productId: string;
  variantId: string | null;
  selections: CatalogProductQuoteSelection[];
  quantity: number;
  unitPriceSnapshot: string;
}

interface StorefrontPersistedState {
  cart: StorefrontCartLine[];
  favorites: string[];
  fulfillmentType: 'pickup' | 'delivery';
  pickupBranchId: string;
  deliveryAreaId: string;
}

export interface StorefrontState extends StorefrontPersistedState {
  cartNotice: { id: number; kind: 'added' | 'updated' } | null;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  addCartLine: (line: Omit<StorefrontCartLine, 'key'>) => boolean;
  updateCartLine: (key: string, line: Omit<StorefrontCartLine, 'key'>) => boolean;
  setCartQuantity: (key: string, quantity: number) => void;
  removeCartLine: (key: string) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  setFulfillmentType: (value: 'pickup' | 'delivery') => void;
  setPickupBranchId: (value: string) => void;
  setDeliveryAreaId: (value: string) => void;
}

export function getCartLineKey(
  productId: string,
  variantId: string | null,
  selections: CatalogProductQuoteSelection[],
): string {
  const normalized = selections
    .map(({ groupId, optionIds, optionQuantities }) => [
      groupId,
      [...optionIds]
        .sort()
        .map((id) => [id, optionQuantities?.find((entry) => entry.optionId === id)?.quantity ?? 1]),
    ])
    .sort(([left], [right]) => String(left).localeCompare(String(right)));
  return JSON.stringify([productId, variantId, normalized]);
}

export function createStorefrontStore(slug: string) {
  return createStore<StorefrontState>()(
    persist<StorefrontState, [], [], StorefrontPersistedState>(
      (set) => ({
        cart: [],
        favorites: [],
        fulfillmentType: 'pickup',
        pickupBranchId: '',
        deliveryAreaId: '',
        setFulfillmentType: (fulfillmentType) => set({ fulfillmentType }),
        setPickupBranchId: (pickupBranchId) => set({ pickupBranchId }),
        setDeliveryAreaId: (deliveryAreaId) => set({ deliveryAreaId }),
        cartNotice: null,
        hasHydrated: false,
        setHasHydrated: (value) => set({ hasHydrated: value }),
        addCartLine: (line) => {
          let added = false;
          set((state) => {
            const key = getCartLineKey(line.productId, line.variantId, line.selections);
            const existing = state.cart.find((item) => item.key === key);
            const quantity = line.quantity + (existing?.quantity ?? 0);
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return state;
            added = true;
            const cartNotice = { id: (state.cartNotice?.id ?? 0) + 1, kind: 'added' as const };
            return {
              cartNotice,
              cart: existing
                ? state.cart.map((item) => (item.key === key ? { ...line, key, quantity } : item))
                : [...state.cart, { ...line, key }],
            };
          });
          return added;
        },
        updateCartLine: (originalKey, line) => {
          let updated = false;
          set((state) => {
            if (!state.cart.some((item) => item.key === originalKey)) return state;
            const key = getCartLineKey(line.productId, line.variantId, line.selections);
            const matching = state.cart.find(
              (item) => item.key === key && item.key !== originalKey,
            );
            const quantity = line.quantity + (matching?.quantity ?? 0);
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return state;
            updated = true;
            return {
              cartNotice: { id: (state.cartNotice?.id ?? 0) + 1, kind: 'updated' },
              cart: state.cart
                .filter((item) => !matching || item.key !== matching.key)
                .map((item) => (item.key === originalKey ? { ...line, key, quantity } : item)),
            };
          });
          return updated;
        },
        setCartQuantity: (key, quantity) =>
          set((state) => ({
            cart:
              quantity <= 0
                ? state.cart.filter((item) => item.key !== key)
                : state.cart.map((item) =>
                    item.key === key ? { ...item, quantity: Math.min(quantity, 99) } : item,
                  ),
          })),
        removeCartLine: (key) =>
          set((state) => ({ cart: state.cart.filter((item) => item.key !== key) })),
        clearCart: () => set({ cart: [] }),
        toggleFavorite: (productId) =>
          set((state) => ({
            favorites: state.favorites.includes(productId)
              ? state.favorites.filter((id) => id !== productId)
              : [...state.favorites, productId],
          })),
      }),
      {
        name: `waffarly:storefront:${slug}:v1`,
        version: 3,
        storage: createJSONStorage<StorefrontPersistedState>(() =>
          typeof window === 'undefined'
            ? { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
            : window.localStorage,
        ),
        partialize: ({ cart, favorites, fulfillmentType, pickupBranchId, deliveryAreaId }) => ({
          cart,
          favorites,
          fulfillmentType,
          pickupBranchId,
          deliveryAreaId,
        }),
        migrate: (persisted, version) => {
          const defaults = {
            fulfillmentType: 'pickup' as const,
            pickupBranchId: '',
            deliveryAreaId: '',
          };
          if (version !== 1 && version !== 2) return { cart: [], favorites: [], ...defaults };
          const state = persisted as StorefrontPersistedState;
          return {
            ...state,
            ...defaults,
            cart: state.cart.map((line) => ({
              ...line,
              key: getCartLineKey(line.productId, line.variantId, line.selections),
            })),
          };
        },
        onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
      },
    ),
  );
}
