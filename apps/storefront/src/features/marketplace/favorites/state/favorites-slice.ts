import type { StateCreator } from 'zustand/vanilla';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';

export interface FavoritesSlice {
  favorites: string[];
  toggleFavorite: (productId: string) => void;
}

export const createFavoritesSlice: StateCreator<MarketplaceState, [], [], FavoritesSlice> = (
  set,
) => ({
  favorites: [],
  toggleFavorite: (productId) =>
    set((state) => ({
      favorites: state.favorites.includes(productId)
        ? state.favorites.filter((id) => id !== productId)
        : [...state.favorites, productId],
    })),
});
