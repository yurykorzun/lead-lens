import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RealtorTask } from '@lead-lens/shared';
import { api } from '@/lib/api';
import { useViewAs, withViewAs } from '@/hooks/use-view-as';

interface TasksResponse {
  success: boolean;
  data: RealtorTask[];
}

/** The realtor task set on one borrower, earliest due first */
export function useTasks(recordId: string) {
  const asUser = useViewAs();
  return useQuery({
    queryKey: ['tasks', recordId, asUser],
    queryFn: () => api.get<TasksResponse>(withViewAs(`/contacts/${encodeURIComponent(recordId)}/tasks`, asUser)),
  });
}

/** The realtor's next open step on each of her borrowers (hers, or the one an admin views as) */
export function useOpenTasks(enabled: boolean) {
  const asUser = useViewAs();
  return useQuery({
    queryKey: ['tasks', 'open', asUser],
    queryFn: () => api.get<TasksResponse>(withViewAs('/contacts/tasks/open', asUser)),
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
