import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ContactRow, ContactFilters } from '@lead-lens/shared';

/** What GET /api/contacts returns (server/src/routes/contacts.ts) */
export interface ContactsResponse {
  success: boolean;
  data: ContactRow[];
  pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
}

export function useContacts(filters: ContactFilters) {
  return useQuery({
    queryKey: ['contacts', filters],
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      if (filters.temperature) params.set('temperature', filters.temperature);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return api.get<ContactsResponse>(`/contacts${qs ? `?${qs}` : ''}`);
    },
  });
}
