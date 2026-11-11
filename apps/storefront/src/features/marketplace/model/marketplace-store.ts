import { createStore } from 'zustand/vanilla';

export interface MarketplaceState {
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  cart: string[];
  addToCart: (productId: string) => void;
  removeCartItem: (index: number) => void;
  favorites: string[];
  toggleFavorite: (productId: string) => void;
}

// One instance per mounted provider; never share mutable state across SSR requests.
export function createMarketplaceStore() {
  return createStore<MarketplaceState>()((set) => ({
    cartOpen: false,
    setCartOpen: (cartOpen) => set({ cartOpen }),
    cart: [],
    // Reference adds separate lines, including duplicate products.
    addToCart: (productId) => set((state) => ({ cart: [...state.cart, productId] })),
    removeCartItem: (index) => set((state) => ({ cart: state.cart.filter((_, i) => i !== index) })),
    favorites: [],
    toggleFavorite: (productId) =>
      set((state) => ({
        favorites: state.favorites.includes(productId)
          ? state.favorites.filter((id) => id !== productId)
          : [...state.favorites, productId],
      })),
  }));
}
