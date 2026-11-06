import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RealtorStage, RealtorStageState } from '@lead-lens/shared';
import { api } from '@/lib/api';
import { useViewAs, withViewAs } from './use-view-as';

interface StageResponse {
  success: boolean;
  data: RealtorStageState;
}

/** Where the realtor is with this buyer (the newest Realtor_Note__c with a Stage__c) */
export function useStage(recordId: string) {
  const viewAs = useViewAs();
  return useQuery({
    queryKey: ['stage', recordId, viewAs],
    queryFn: () => api.get<StageResponse>(withViewAs(`/contacts/${encodeURIComponent(recordId)}/stage`, viewAs)),
  });
}

/** The realtor moves the buyer to a stage. It is saved as a note, so the notes reload too. */
export function useSetStage(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stage: RealtorStage) =>
      api.post<StageResponse>(`/contacts/${encodeURIComponent(recordId)}/stage`, { stage }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['stage', recordId] }),
      queryClient.invalidateQueries({ queryKey: ['notes', recordId] }),
    ]),
  });
}
