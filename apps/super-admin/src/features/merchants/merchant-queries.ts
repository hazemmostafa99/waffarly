import { useQuery } from '@tanstack/react-query';
import type { MerchantApplicationSummary, MerchantSummary } from '@waffarly/contracts';
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

export function isPendingMerchantApplication(application: MerchantApplicationSummary) {
  return !application.approvedAt && !application.rejectedAt;
}
