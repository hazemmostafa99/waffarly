'use client';

import { useQuery } from '@tanstack/react-query';
import { customerSessionKey, loadCustomer } from '@/features/account/data/customer-auth-api';

export function useCustomerSession() {
  return useQuery({
    queryKey: customerSessionKey,
    queryFn: loadCustomer,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
