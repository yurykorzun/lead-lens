import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { PaginatedResponse } from '@lead-lens/shared';
import { api } from '@/lib/api';

export interface UseListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

interface ListResponse<T> {
  success: boolean;
  data: PaginatedResponse<T>;
}

interface CreateResponse<T> {
  success: boolean;
  data: T;
}

interface UpdateResponse<T> {
  success: boolean;
  data: T;
}

export function useList<T>(endpoint: string, queryKey: string, { page = 1, pageSize = 25, search = '' }: UseListParams = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set('search', search);

  return useQuery({
    queryKey: [queryKey, { page, pageSize, search }],
    queryFn: () => api.get<ListResponse<T>>(`${endpoint}?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreate<TRequest, TResponse = unknown>(endpoint: string, queryKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TRequest) =>
      api.post<CreateResponse<TResponse>>(endpoint, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });
}

export function useUpdate<TRequest>(endpoint: string, queryKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TRequest }) =>
      api.patch<UpdateResponse<unknown>>(`${endpoint}/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });
}

export function useDelete(endpoint: string, queryKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`${endpoint}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });
}

export function useRegenerate(endpoint: string) {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ success: boolean; data: { accessCode: string } }>(`${endpoint}/${id}/regenerate-code`),
  });
}
