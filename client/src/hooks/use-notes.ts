import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ContactNote } from '@lead-lens/shared';
import { api } from '@/lib/api';
import { useViewAs, withViewAs } from './use-view-as';

interface NotesResponse {
  success: boolean;
  data: ContactNote[];
}

/** Realtor notes on one borrower, newest first (Realtor_Note__c in Salesforce) */
export function useNotes(recordId: string) {
  const viewAs = useViewAs();
  return useQuery({
    queryKey: ['notes', recordId, viewAs],
    queryFn: () => api.get<NotesResponse>(withViewAs(`/contacts/${encodeURIComponent(recordId)}/notes`, viewAs)),
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
