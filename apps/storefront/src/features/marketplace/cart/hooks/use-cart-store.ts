import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';
import type { CartSlice } from '@/features/marketplace/cart/state/cart-slice';

export function useCartStore<T>(selector: (state: CartSlice) => T): T {
  return useMarketplaceStore((state) => selector(state));
}
