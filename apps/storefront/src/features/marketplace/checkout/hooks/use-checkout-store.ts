import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';
import type { CheckoutActions } from '@/features/marketplace/checkout/state/checkout-actions';

export function useCheckoutStore<T>(selector: (state: CheckoutActions) => T): T {
  return useMarketplaceStore((state) => selector(state));
}
