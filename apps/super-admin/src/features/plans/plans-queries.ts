import { useQuery } from '@tanstack/react-query';
import type { MonthlyPlanSummary } from '@waffarly/contracts';
import { adminQueryKeys } from '../../app/query-keys.js';
import { apiRequest } from '../../lib/api-client.js';

export function useMonthlyPlansQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.plans,
    queryFn: () => apiRequest<MonthlyPlanSummary[]>('/admin/plans'),
    enabled,
    staleTime: 0,
  });
}
