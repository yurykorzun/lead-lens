import type { UserListItem, CreateLoanOfficerRequest, UpdateLoanOfficerRequest } from '@lead-lens/shared';
import { useList, useCreate, useUpdate, useDelete, useRegenerate, type UseListParams } from './use-crud';

const ENDPOINT = '/loan-officers';
const KEY = 'loan-officers';

export type { UseListParams as UseLoanOfficersParams };

export function useLoanOfficers(params: UseListParams = {}) {
  return useList<UserListItem>(ENDPOINT, KEY, params);
}

export function useCreateLoanOfficer() {
  return useCreate<CreateLoanOfficerRequest, { user: UserListItem; accessCode: string }>(ENDPOINT, KEY);
}

export function useUpdateLoanOfficer() {
  return useUpdate<UpdateLoanOfficerRequest>(ENDPOINT, KEY);
}

export function useRegenerateCode() {
  return useRegenerate(ENDPOINT);
}

export function useDeleteLoanOfficer() {
  return useDelete(ENDPOINT, KEY);
}
