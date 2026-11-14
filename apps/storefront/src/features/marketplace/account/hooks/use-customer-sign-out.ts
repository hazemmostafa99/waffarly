'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customerSessionKey, signOutCustomer } from '@/features/account/data/customer-auth-api';
import { useAccountStore } from './use-account-store';

export function useCustomerSignOut() {
  const client = useQueryClient();
  const leaveDemoAccount = useAccountStore((state) => state.leaveDemoAccount);
  return useMutation({
    mutationFn: signOutCustomer,
    onSuccess: async () => {
      await Promise.all([
        client.cancelQueries({ queryKey: customerSessionKey }),
        client.cancelQueries({ queryKey: ['customer-orders'] }),
      ]);
      client.removeQueries({ queryKey: ['customer-orders'] });
      client.setQueryData(customerSessionKey, null);
      leaveDemoAccount();
    },
  });
}
