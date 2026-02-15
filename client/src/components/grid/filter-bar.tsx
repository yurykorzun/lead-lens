import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ContactFilters } from '@lead-lens/shared';

interface FilterBarProps {
  filters: ContactFilters;
  onChange: (filters: ContactFilters) => void;
  dropdowns: Record<string, Array<{ value: string; label: string }>>;
}

export function FilterBar({ filters, onChange, dropdowns }: FilterBarProps) {
  const statusOptions = dropdowns['Status__c'] || [];
  const tempOptions = dropdowns['Temparture__c'] || [];

  const hasActiveFilters = filters.search || filters.status || filters.temperature || filters.dateFrom || filters.dateTo;

  const clearFilters = () => {
    onChange({ page: 1, pageSize: filters.pageSize });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <div className="relative max-w-xs flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={filters.search ?? ''}
          onChange={e => onChange({ ...filters, search: e.target.value, page: 1 })}
          className="pl-9"
        />
      </div>
      <select
        value={filters.status ?? ''}
        onChange={e => onChange({ ...filters, status: e.target.value || undefined, page: 1 })}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All Statuses</option>
        {statusOptions.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        value={filters.temperature ?? ''}
        onChange={e => onChange({ ...filters, temperature: e.target.value || undefined, page: 1 })}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All Temperatures</option>
        {tempOptions.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <Input
        type="date"
        value={filters.dateFrom ?? ''}
        onChange={e => onChange({ ...filters, dateFrom: e.target.value || undefined, page: 1 })}
        className="w-40"
      />
      <Input
        type="date"
        value={filters.dateTo ?? ''}
        onChange={e => onChange({ ...filters, dateTo: e.target.value || undefined, page: 1 })}
        className="w-40"
      />
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
