import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActivitiesModulesCatalog,
  BusinessActivityKey,
  BusinessActivitySummary,
  UpdateBusinessActivityRequest,
} from '@waffarly/contracts';
import { adminQueryKeys } from '../../app/query-keys.js';
import { apiRequest } from '../../lib/api-client.js';

export function useActivitiesModulesCatalogQuery() {
  return useQuery({
    queryKey: adminQueryKeys.activitiesModules,
    queryFn: () => apiRequest<ActivitiesModulesCatalog>('/admin/activities-modules'),
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
      apiRequest<BusinessActivitySummary>(`/admin/activities-modules/activities/${key}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.activitiesModules });
    },
  });
}
