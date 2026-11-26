import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocaleProvider } from '@waffarly/ui';
import { useState, type ReactNode } from 'react';
import {
  isRegisterPairingError,
  usePairingPromptStore,
} from '../features/registers/register-pairing-prompt.js';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Fallback for register actions not checked up front: show the pairing card.
        mutationCache: new MutationCache({
          onError: (error) => {
            if (isRegisterPairingError(error)) usePairingPromptStore.getState().show();
          },
        }),
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: true, refetchOnReconnect: true },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>{children}</LocaleProvider>
    </QueryClientProvider>
  );
}
