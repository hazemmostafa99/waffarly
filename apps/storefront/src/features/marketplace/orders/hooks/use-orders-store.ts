import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';
import type { OrdersSlice } from '@/features/marketplace/orders/state/orders-slice';

export function useOrdersStore<T>(selector: (state: OrdersSlice) => T): T {
  return useMarketplaceStore((state) => selector(state));
}
