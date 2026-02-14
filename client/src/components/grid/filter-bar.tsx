import { Input } from '@/components/ui/input';
import type { ContactFilters } from '@lead-lens/shared';

interface FilterBarProps {
  filters: ContactFilters;
  onChange: (filters: ContactFilters) => void;
  dropdowns: Record<string, Array<{ value: string; label: string }>>;
}

export function FilterBar({ filters, onChange, dropdowns }: FilterBarProps) {
  const statusOptions = dropdowns['Status__c'] || [];
  const tempOptions = dropdowns['Temparture__c'] || [];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <Input
        placeholder="Search contacts..."
        value={filters.search ?? ''}
        onChange={e => onChange({ ...filters, search: e.target.value, page: 1 })}
        className="max-w-xs"
      />
      <select
        value={filters.status ?? ''}
        onChange={e => onChange({ ...filters, status: e.target.value || undefined, page: 1 })}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
      >
        <option value="">All Statuses</option>
        {statusOptions.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        value={filters.temperature ?? ''}
        onChange={e => onChange({ ...filters, temperature: e.target.value || undefined, page: 1 })}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
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
    </div>
  );
}
