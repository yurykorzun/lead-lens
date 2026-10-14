import { useQuery } from '@tanstack/react-query';
import type { UserListItem, CreateAgentRequest, UpdateAgentRequest, RealtorMatch } from '@lead-lens/shared';
import { api } from '@/lib/api';
import { useList, useCreate, useUpdate, useDelete, useRegenerate, type UseListParams } from './use-crud';

const ENDPOINT = '/agents';
const KEY = 'agents';

export type { UseListParams as UseAgentsParams };

export function useAgents(params: UseListParams = {}) {
  return useList<UserListItem>(ENDPOINT, KEY, params);
}

export function useCreateAgent() {
  return useCreate<CreateAgentRequest, { user: UserListItem; accessCode: string }>(ENDPOINT, KEY);
}

export function useUpdateAgent() {
  return useUpdate<UpdateAgentRequest>(ENDPOINT, KEY);
}

export function useRegenerateAgentCode() {
  return useRegenerate(ENDPOINT);
}

export function useDeleteAgent() {
  return useDelete(ENDPOINT, KEY);
}

interface RealtorSearchResponse {
  success: boolean;
  data: { items: RealtorMatch[] };
}

/** Salesforce Contacts an agent can be linked to, by name or email (2+ characters) */
export function useRealtorSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ['realtors', q],
    queryFn: () => api.get<RealtorSearchResponse>(`${ENDPOINT}/realtors?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 60_000,
  });
}

/** The Contact an agent is linked to now */
export function useRealtor(contactId: string | null | undefined) {
  return useQuery({
    queryKey: ['realtor', contactId],
    queryFn: () => api.get<{ success: boolean; data: RealtorMatch }>(`${ENDPOINT}/realtors/${encodeURIComponent(contactId ?? '')}`),
    enabled: Boolean(contactId),
    staleTime: 60_000,
    retry: false,
  });
}
