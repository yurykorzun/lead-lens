import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ContactNote } from '@lead-lens/shared';
import { api } from '@/lib/api';
import { useViewAs, withViewAs } from '@/hooks/use-view-as';

interface NotesResponse {
  success: boolean;
  data: ContactNote[];
}

/** Notes on one borrower, newest first. Lead Lens only - never written to Salesforce. */
export function useNotes(recordId: string) {
  const asUser = useViewAs();
  return useQuery({
    queryKey: ['notes', recordId, asUser],
    queryFn: () => api.get<NotesResponse>(withViewAs(`/contacts/${encodeURIComponent(recordId)}/notes`, asUser)),
  });
}

export function useAddNote(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api.post<{ success: boolean; data: ContactNote }>(`/contacts/${encodeURIComponent(recordId)}/notes`, { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes', recordId] }),
  });
}
