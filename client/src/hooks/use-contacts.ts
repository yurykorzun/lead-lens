import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PaginatedResponse, ContactRow, ContactFilters } from '@lead-lens/shared';

export function useContacts(filters: ContactFilters) {
  return useQuery({
    queryKey: ['contacts', filters],
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.loanOfficerId) params.set('loanOfficerId', filters.loanOfficerId);
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      if (filters.temperature) params.set('temperature', filters.temperature);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return api.get<PaginatedResponse<ContactRow>>(`/contacts${qs ? `?${qs}` : ''}`);
    },
  });
}
