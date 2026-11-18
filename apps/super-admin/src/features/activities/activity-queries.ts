import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BusinessActivityKey,
  BusinessActivitySummary,
  UpdateBusinessActivityRequest,
} from '@waffarly/contracts';
import { adminQueryKeys } from '../../app/query-keys.js';
import { apiRequest } from '../../lib/api-client.js';

export function useBusinessActivitiesQuery() {
  return useQuery({
    queryKey: adminQueryKeys.activities,
    queryFn: () => apiRequest<BusinessActivitySummary[]>('/admin/activities'),
    staleTime: 0,
  });
}

export function useUpdateBusinessActivityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      key,
      body,
    }: {
      key: BusinessActivityKey;
      body: UpdateBusinessActivityRequest;
    }) =>
      apiRequest<BusinessActivitySummary>(`/admin/activities/${key}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.activities });
    },
  });
}
