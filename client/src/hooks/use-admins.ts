import { useMutation } from '@tanstack/react-query';
import type { AdminListItem, CreateAdminRequest, UpdateAdminRequest } from '@lead-lens/shared';
import { api } from '@/lib/api';
import { useList, useCreate, useUpdate, useDelete, type UseListParams } from './use-crud';

const ENDPOINT = '/admins';
const KEY = 'admins';

export type { UseListParams as UseAdminsParams };

export function useAdmins(params: UseListParams = {}) {
  return useList<AdminListItem>(ENDPOINT, KEY, params);
}

export function useCreateAdmin() {
  return useCreate<CreateAdminRequest, AdminListItem>(ENDPOINT, KEY);
}

export function useUpdateAdmin() {
  return useUpdate<UpdateAdminRequest>(ENDPOINT, KEY);
}

export function useDeleteAdmin() {
  return useDelete(ENDPOINT, KEY);
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.patch<{ success: boolean; data: { message: string } }>('/auth/password', data),
  });
}
