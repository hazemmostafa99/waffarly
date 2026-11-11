'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  customerSessionKey,
  signInCustomer,
  signUpCustomer,
} from '@/features/account/data/customer-auth-api';
import type { CustomerProfile } from '@waffarly/contracts';

export function useCustomerAuth() {
  const client = useQueryClient();
  const router = useRouter();
  const onSuccess = async (profile: CustomerProfile) => {
    await client.cancelQueries({ queryKey: customerSessionKey });
    client.setQueryData(customerSessionKey, profile);
    router.replace('/account');
  };
  const signIn = useMutation({ mutationFn: signInCustomer, onSuccess, gcTime: 0 });
  const signUp = useMutation({ mutationFn: signUpCustomer, onSuccess, gcTime: 0 });
  return { signIn, signUp };
}
