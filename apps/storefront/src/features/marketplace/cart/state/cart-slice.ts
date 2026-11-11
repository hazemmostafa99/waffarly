import type { StateCreator } from 'zustand/vanilla';
import { findProduct } from '@/features/marketplace/catalog/model/catalog';
import {
  MAX_CART_QUANTITY,
  validQuantity,
  type MarketplaceCartLine,
} from '@/features/marketplace/cart/model/cart';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';

export interface CartSlice {
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  cart: MarketplaceCartLine[];
  addToCart: (productId: string, quantity?: number) => boolean;
  setCartQuantity: (productId: string, quantity: number) => void;
  removeCartItem: (productId: string) => void;
}

export const createCartSlice: StateCreator<MarketplaceState, [], [], CartSlice> = (set, get) => ({
  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
  cart: [],
  addToCart: (productId, quantity = 1) => {
    if (!findProduct(productId) || !validQuantity(quantity)) return false;
    const currentQuantity = get().cart.find((line) => line.productId === productId)?.quantity ?? 0;
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
      cart: state.cart.map((line) => (line.productId === productId ? { ...line, quantity } : line)),
    }));
  },
  removeCartItem: (productId) =>
    set((state) => ({ cart: state.cart.filter((line) => line.productId !== productId) })),
});
