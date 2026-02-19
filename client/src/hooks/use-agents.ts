import type { UserListItem, CreateAgentRequest, UpdateAgentRequest } from '@lead-lens/shared';
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
