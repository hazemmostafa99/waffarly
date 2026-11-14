'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { createStorefrontStore, type StorefrontState } from '../features/cart/storefront-store';

const StorefrontStoreContext = createContext<StoreApi<StorefrontState> | null>(null);

export function StorefrontProviders({ slug, children }: { slug: string; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );
  const [store] = useState(() => createStorefrontStore(slug));

  useEffect(() => {
    void store.persist.rehydrate();
  }, [store]);

  return (
    <QueryClientProvider client={queryClient}>
      <StorefrontStoreContext.Provider value={store}>{children}</StorefrontStoreContext.Provider>
    </QueryClientProvider>
  );
}

export function useStorefrontStore<T>(selector: (state: StorefrontState) => T): T {
  const store = useContext(StorefrontStoreContext);
  if (!store) throw new Error('StorefrontProviders is required.');
  return useStore(store, selector);
}
