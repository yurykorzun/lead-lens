import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { AdminListItem, PaginatedAdminResponse, CreateAdminRequest, UpdateAdminRequest } from '@lead-lens/shared';
import { api } from '@/lib/api';

interface AdminListResponse {
  success: boolean;
  data: PaginatedAdminResponse;
}

interface CreateAdminResponse {
  success: boolean;
  data: AdminListItem;
}

interface UpdateAdminResponse {
  success: boolean;
  data: AdminListItem;
}

export interface UseAdminsParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export function useAdmins({ page = 1, pageSize = 25, search = '' }: UseAdminsParams = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set('search', search);

  return useQuery({
    queryKey: ['admins', { page, pageSize, search }],
    queryFn: () => api.get<AdminListResponse>(`/admins?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAdminRequest) =>
      api.post<CreateAdminResponse>('/admins', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
  });
}

export function useUpdateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAdminRequest }) =>
      api.patch<UpdateAdminResponse>(`/admins/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
  });
}

export function useDeleteAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`/admins/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.patch<{ success: boolean; data: { message: string } }>('/auth/password', data),
  });
}
