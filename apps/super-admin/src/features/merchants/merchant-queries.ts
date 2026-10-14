import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActivateFirstMonthRequest, MerchantApplicationSummary, MerchantSummary } from '@waffarly/contracts';
import { adminQueryKeys } from '../../app/query-keys.js';
import { apiRequest } from '../../lib/api-client.js';

export function useMerchantsQuery() {
  return useQuery({
    queryKey: adminQueryKeys.merchants,
    queryFn: () => apiRequest<MerchantSummary[]>('/admin/merchants'),
    staleTime: 0,
  });
}

export function useMerchantApplicationsQuery() {
  return useQuery({
    queryKey: adminQueryKeys.applications,
    queryFn: () => apiRequest<MerchantApplicationSummary[]>('/admin/merchant-applications'),
    staleTime: 0,
  });
}

export function useActivateFirstMonthMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (merchantId: string) => {
      const body: ActivateFirstMonthRequest = { externalCollectionConfirmed: true };
      return apiRequest<MerchantSummary>(`/admin/merchants/${merchantId}/activate-first-month`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.merchants });
    },
  });
}

export function isPendingMerchantApplication(application: MerchantApplicationSummary) {
  return !application.approvedAt && !application.rejectedAt;
}
