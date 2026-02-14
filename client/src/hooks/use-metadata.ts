import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse } from '@lead-lens/shared';

interface DropdownValues {
  [fieldName: string]: Array<{ value: string; label: string }>;
}

export function useMetadata() {
  return useQuery({
    queryKey: ['metadata', 'dropdowns'],
    queryFn: () => api.get<ApiResponse<DropdownValues>>('/metadata/dropdowns'),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}
