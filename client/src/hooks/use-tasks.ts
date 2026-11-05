import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RealtorTask } from '@lead-lens/shared';
import { api } from '@/lib/api';
import { useViewAs, withViewAs } from './use-view-as';

interface TasksResponse {
  success: boolean;
  data: RealtorTask[];
}

/** The realtor task set on one borrower, earliest due first */
export function useTasks(recordId: string) {
  const viewAs = useViewAs();
  return useQuery({
    queryKey: ['tasks', recordId, viewAs],
    queryFn: () => api.get<TasksResponse>(withViewAs(`/contacts/${encodeURIComponent(recordId)}/tasks`, viewAs)),
  });
}

/** The signed-in realtor's open tasks on all her borrowers */
export function useOpenTasks(enabled: boolean) {
  return useQuery({
    queryKey: ['tasks', 'open'],
    queryFn: () => api.get<TasksResponse>('/contacts/tasks/open'),
    enabled,
  });
}

/** Marks one of her tasks Completed in Salesforce. There is no undo from Lead Lens. */
export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, taskId }: { recordId: string; taskId: string }) =>
      api.post<{ success: boolean; data: RealtorTask }>(
        `/contacts/${encodeURIComponent(recordId)}/tasks/${encodeURIComponent(taskId)}/complete`,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
