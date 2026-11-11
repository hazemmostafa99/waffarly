import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';
import type { FavoritesSlice } from '@/features/marketplace/favorites/state/favorites-slice';

export function useFavoritesStore<T>(selector: (state: FavoritesSlice) => T): T {
  return useMarketplaceStore((state) => selector(state));
}
