import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateStorefrontTemplateRequest,
  StorefrontTemplateSummary,
  UpdateStorefrontTemplateRequest,
} from '@waffarly/contracts';
import { adminQueryKeys } from '../../app/query-keys.js';
import { apiRequest } from '../../lib/api-client.js';

export function useStorefrontTemplatesQuery() {
  return useQuery({
    queryKey: adminQueryKeys.templates,
    queryFn: () => apiRequest<StorefrontTemplateSummary[]>('/admin/templates'),
    staleTime: 0,
  });
}

export function useCreateStorefrontTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateStorefrontTemplateRequest) =>
      apiRequest<StorefrontTemplateSummary>('/admin/templates', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.templates });
    },
  });
}

export function useUpdateStorefrontTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateStorefrontTemplateRequest }) =>
      apiRequest<StorefrontTemplateSummary>(`/admin/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.templates });
    },
  });
}
