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
}

export interface StorefrontState extends StorefrontPersistedState {
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  addCartLine: (line: Omit<StorefrontCartLine, 'key'>) => void;
  setCartQuantity: (key: string, quantity: number) => void;
  removeCartLine: (key: string) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
}

export function getCartLineKey(
  productId: string,
  variantId: string | null,
  selections: CatalogProductQuoteSelection[],
): string {
  const normalized = selections
    .map(({ groupId, optionIds }) => [groupId, [...optionIds].sort()])
    .sort(([left], [right]) => String(left).localeCompare(String(right)));
  return JSON.stringify([productId, variantId, normalized]);
}

export function createStorefrontStore(slug: string) {
  return createStore<StorefrontState>()(
    persist<StorefrontState, [], [], StorefrontPersistedState>(
      (set) => ({
        cart: [],
        favorites: [],
        hasHydrated: false,
        setHasHydrated: (value) => set({ hasHydrated: value }),
        addCartLine: (line) =>
          set((state) => {
            const key = getCartLineKey(line.productId, line.variantId, line.selections);
            const existing = state.cart.find((item) => item.key === key);
            if (existing) {
              return {
                cart: state.cart.map((item) =>
                  item.key === key
                    ? { ...item, quantity: Math.min(item.quantity + line.quantity, 99), unitPriceSnapshot: line.unitPriceSnapshot }
                    : item,
                ),
              };
            }
            return { cart: [...state.cart, { ...line, key }] };
          }),
        setCartQuantity: (key, quantity) =>
          set((state) => ({
            cart: quantity <= 0
              ? state.cart.filter((item) => item.key !== key)
              : state.cart.map((item) => item.key === key
                ? { ...item, quantity: Math.min(quantity, 99) }
                : item),
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
        version: 1,
        storage: createJSONStorage<StorefrontPersistedState>(() =>
          typeof window === 'undefined'
            ? { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
            : window.localStorage,
        ),
        partialize: ({ cart, favorites }) => ({ cart, favorites }),
        migrate: () => ({ cart: [], favorites: [] }),
        onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
      },
    ),
  );
}
