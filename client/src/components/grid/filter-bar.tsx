import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ContactFilters } from '@lead-lens/shared';

interface FilterBarProps {
  filters: ContactFilters;
  onChange: (filters: ContactFilters) => void;
  dropdowns: Record<string, Array<{ value: string; label: string }>>;
}

export function FilterBar({ filters, onChange, dropdowns }: FilterBarProps) {
  const statusOptions = dropdowns['Status__c'] || [];
  const tempOptions = dropdowns['Temparture__c'] || [];

  const activeFilterCount = [filters.status, filters.temperature, filters.dateFrom, filters.dateTo].filter(Boolean).length;

  const clearFilters = () => {
    onChange({ page: 1, pageSize: filters.pageSize });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search contacts..."
          value={filters.search ?? ''}
          onChange={e => onChange({ ...filters, search: e.target.value, page: 1 })}
          className="pl-9 border-slate-200"
        />
      </div>
      <select
        value={filters.status ?? ''}
        onChange={e => onChange({ ...filters, status: e.target.value || undefined, page: 1 })}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Statuses</option>
        {statusOptions.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        value={filters.temperature ?? ''}
        onChange={e => onChange({ ...filters, temperature: e.target.value || undefined, page: 1 })}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        className="w-40 border-slate-200"
        placeholder="From"
      />
      <Input
        type="date"
        value={filters.dateTo ?? ''}
        onChange={e => onChange({ ...filters, dateTo: e.target.value || undefined, page: 1 })}
        className="w-40 border-slate-200"
        placeholder="To"
      />
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-slate-500 hover:text-slate-700">
          <X className="h-3.5 w-3.5" />
          Clear
          <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-xs">{activeFilterCount}</Badge>
        </Button>
      )}
    </div>
  );
}
