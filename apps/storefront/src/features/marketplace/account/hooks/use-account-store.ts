import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';
import type { AccountSlice } from '@/features/marketplace/account/state/account-slice';

export function useAccountStore<T>(selector: (state: AccountSlice) => T): T {
  return useMarketplaceStore((state) => selector(state));
}
