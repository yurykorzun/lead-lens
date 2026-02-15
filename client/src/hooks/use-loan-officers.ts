import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoanOfficerListItem, CreateLoanOfficerRequest, UpdateLoanOfficerRequest } from '@lead-lens/shared';
import { api } from '@/lib/api';

interface LoanOfficerListResponse {
  success: boolean;
  data: LoanOfficerListItem[];
}

interface CreateLoanOfficerResponse {
  success: boolean;
  data: {
    user: LoanOfficerListItem;
    accessCode: string;
  };
}

interface UpdateLoanOfficerResponse {
  success: boolean;
  data: LoanOfficerListItem;
}

interface RegenerateCodeResponse {
  success: boolean;
  data: { accessCode: string };
}

export function useLoanOfficers() {
  return useQuery({
    queryKey: ['loan-officers'],
    queryFn: () => api.get<LoanOfficerListResponse>('/loan-officers'),
  });
}

export function useCreateLoanOfficer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLoanOfficerRequest) =>
      api.post<CreateLoanOfficerResponse>('/loan-officers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-officers'] });
    },
  });
}

export function useUpdateLoanOfficer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLoanOfficerRequest }) =>
      api.patch<UpdateLoanOfficerResponse>(`/loan-officers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-officers'] });
    },
  });
}

export function useRegenerateCode() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<RegenerateCodeResponse>(`/loan-officers/${id}/regenerate-code`),
  });
}

export function useDeleteLoanOfficer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`/loan-officers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-officers'] });
    },
  });
}
