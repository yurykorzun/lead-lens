import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ViewAsUser {
  id: string;
  name: string;
  role: 'loan_officer' | 'agent';
}

/** Identity of the loan officer or agent an admin is previewing. */
export function useViewAsUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['view-as', userId],
    enabled: Boolean(userId),
    retry: false,
    queryFn: () => api.get<{ success: boolean; data: ViewAsUser }>(`/view-as/${userId}`),
  });
}
