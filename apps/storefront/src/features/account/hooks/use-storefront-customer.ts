'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStorefrontSlug } from '@/components/storefront/storefront-link';
import {
  loadStorefrontCustomer,
  signOutStorefrontCustomer,
  storefrontCustomerSessionKey,
} from '../data/storefront-customer-api';

/** All tenant account surfaces share the server session; no credentials are persisted locally. */
export function useStorefrontCustomer({
  refreshOnMount = false,
}: { refreshOnMount?: boolean } = {}) {
  const slug = useStorefrontSlug();
  return useQuery({
    queryKey: storefrontCustomerSessionKey(slug),
    queryFn: () => loadStorefrontCustomer(slug),
    retry: false,
    staleTime: 30_000,
    refetchOnMount: refreshOnMount ? 'always' : true,
    refetchOnWindowFocus: 'always',
  });
}

export function useStorefrontSignOut() {
  const slug = useStorefrontSlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => signOutStorefrontCustomer(slug),
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: storefrontCustomerSessionKey(slug) });
      queryClient.setQueryData(storefrontCustomerSessionKey(slug), null);
      queryClient.removeQueries({ queryKey: ['storefront-customer-orders', slug] });
      queryClient.removeQueries({ queryKey: ['storefront-customer-addresses', slug] });
    },
    gcTime: 0,
  });
}
