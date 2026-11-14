import type { StateCreator } from 'zustand/vanilla';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { favoriteSnapshot } from '../model/favorites';

export interface FavoritesSlice {
  favorites: string[];
  favoriteSnapshots: Record<string, MarketplaceProduct>;
  toggleFavorite: (productId: string, product?: MarketplaceProduct) => void;
}

export const createFavoritesSlice: StateCreator<MarketplaceState, [], [], FavoritesSlice> = (
  set,
) => ({
  favorites: [],
  favoriteSnapshots: {},
  toggleFavorite: (productId, product) =>
    set((state) => {
      const removing = state.favorites.includes(productId);
      const snapshots = { ...state.favoriteSnapshots };
      if (removing) delete snapshots[productId];
      else if (product?.id === productId) snapshots[productId] = favoriteSnapshot(product);
      return {
        favorites: removing
          ? state.favorites.filter((id) => id !== productId)
          : [...state.favorites, productId],
        favoriteSnapshots: snapshots,
      };
    }),
});
