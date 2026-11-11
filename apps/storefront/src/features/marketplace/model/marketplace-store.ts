import { createStore } from 'zustand/vanilla';
import { findProduct, MAX_CART_QUANTITY, validQuantity, type MarketplaceCartLine } from './catalog';

export interface MarketplaceState {
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  cart: MarketplaceCartLine[];
  addToCart: (productId: string, quantity?: number) => boolean;
  setCartQuantity: (productId: string, quantity: number) => void;
  removeCartItem: (productId: string) => void;
  favorites: string[];
  toggleFavorite: (productId: string) => void;
}

// One instance per mounted provider; never share mutable state across SSR requests.
export function createMarketplaceStore() {
  return createStore<MarketplaceState>()((set, get) => ({
    cartOpen: false,
    setCartOpen: (cartOpen) => set({ cartOpen }),
    cart: [],
    addToCart: (productId, quantity = 1) => {
      if (!findProduct(productId) || !validQuantity(quantity)) return false;
      const currentQuantity =
        get().cart.find((line) => line.productId === productId)?.quantity ?? 0;
      if (currentQuantity + quantity > MAX_CART_QUANTITY) return false;
      set((state) => {
        const existing = state.cart.find((line) => line.productId === productId);
        return {
          cart: existing
            ? state.cart.map((line) =>
                line.productId === productId
                  ? { ...line, quantity: Math.min(MAX_CART_QUANTITY, line.quantity + quantity) }
                  : line,
              )
            : [...state.cart, { productId, quantity }],
        };
      });
      return true;
    },
    setCartQuantity: (productId, quantity) => {
      if (!validQuantity(quantity)) return;
      set((state) => ({
        cart: state.cart.map((line) =>
          line.productId === productId ? { ...line, quantity } : line,
        ),
      }));
    },
    removeCartItem: (productId) =>
      set((state) => ({ cart: state.cart.filter((line) => line.productId !== productId) })),
    favorites: [],
    toggleFavorite: (productId) =>
      set((state) => ({
        favorites: state.favorites.includes(productId)
          ? state.favorites.filter((id) => id !== productId)
          : [...state.favorites, productId],
      })),
  }));
}
