import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { AgentListItem, PaginatedAgentResponse, CreateAgentRequest, UpdateAgentRequest } from '@lead-lens/shared';
import { api } from '@/lib/api';

interface AgentListResponse {
  success: boolean;
  data: PaginatedAgentResponse;
}

interface CreateAgentResponse {
  success: boolean;
  data: {
    user: AgentListItem;
    accessCode: string;
  };
}

interface UpdateAgentResponse {
  success: boolean;
  data: AgentListItem;
}

interface RegenerateCodeResponse {
  success: boolean;
  data: { accessCode: string };
}

export interface UseAgentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export function useAgents({ page = 1, pageSize = 25, search = '' }: UseAgentsParams = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set('search', search);

  return useQuery({
    queryKey: ['agents', { page, pageSize, search }],
    queryFn: () => api.get<AgentListResponse>(`/agents?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAgentRequest) =>
      api.post<CreateAgentResponse>('/agents', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAgentRequest }) =>
      api.patch<UpdateAgentResponse>(`/agents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useRegenerateAgentCode() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<RegenerateCodeResponse>(`/agents/${id}/regenerate-code`),
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}
