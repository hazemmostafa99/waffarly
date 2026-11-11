'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import {
  createMarketplaceStore,
  type MarketplaceState,
} from '@/features/marketplace/state/marketplace-store';

function createMarketplaceQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
      mutations: { retry: 0 },
    },
  });
}

const MarketplaceStoreContext = createContext<ReturnType<typeof createMarketplaceStore> | null>(
  null,
);

export function MarketplaceProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createMarketplaceQueryClient);
  const [store] = useState(createMarketplaceStore);

  return (
    <QueryClientProvider client={queryClient}>
      <MarketplaceStoreContext.Provider value={store}>{children}</MarketplaceStoreContext.Provider>
    </QueryClientProvider>
  );
}

export function useMarketplaceStore<T>(selector: (state: MarketplaceState) => T): T {
  const store = useContext(MarketplaceStoreContext);
  if (!store) throw new Error('useMarketplaceStore requires MarketplaceProviders.');
  return useStore(store, selector);
}
