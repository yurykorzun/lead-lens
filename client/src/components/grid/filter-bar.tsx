import { useState } from 'react';
import { CalendarRange, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ContactFilters } from '@lead-lens/shared';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  filters: ContactFilters;
  onChange: (filters: ContactFilters) => void;
  dropdowns: Record<string, Array<{ value: string; label: string }>>;
}

// Native select styled like the Input, so it follows the theme and keeps the platform picker
export const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-background px-3 text-base text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm';

export function FilterBar({ filters, onChange, dropdowns }: FilterBarProps) {
  const statusOptions = dropdowns['Status'] || [];
  const tempOptions = dropdowns['Temperature__c'] || [];

  const activeFilterCount = [filters.status, filters.temperature, filters.dateFrom, filters.dateTo].filter(Boolean).length;
  const dateCount = [filters.dateFrom, filters.dateTo].filter(Boolean).length;
  // Phones fold the dates away, because two date rows pushed the list below the fold.
  // They start open when a date is already set, and the dot on the button says so when closed.
  const [showDates, setShowDates] = useState(dateCount > 0);

  const clearFilters = () => {
    onChange({ page: 1, pageSize: filters.pageSize });
  };

  return (
    <div role="search" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 rounded-lg border bg-card p-3 md:flex md:flex-wrap">
      <div className="relative col-span-3 min-w-[200px] md:flex-1">
        <Search aria-hidden="true" className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search by name"
          placeholder="Search by name…"
          value={filters.search ?? ''}
          onChange={e => onChange({ ...filters, search: e.target.value, page: 1 })}
          className="pl-9"
        />
      </div>
      <select
        aria-label="Status"
        value={filters.status ?? ''}
        onChange={e => onChange({ ...filters, status: e.target.value || undefined, page: 1 })}
        className={SELECT_CLASS}
      >
        <option value="">All statuses</option>
        {statusOptions.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        aria-label="Temperature"
        value={filters.temperature ?? ''}
        onChange={e => onChange({ ...filters, temperature: e.target.value || undefined, page: 1 })}
        className={SELECT_CLASS}
      >
        <option value="">All temperatures</option>
        {tempOptions.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setShowDates(o => !o)}
        aria-expanded={showDates}
        aria-controls="created-dates"
        aria-label="Created date"
        title="Created date"
        className="relative h-9 w-11 md:hidden"
      >
        <CalendarRange />
        {dateCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" />}
      </Button>
      {/* One group, so "from" and "to" wrap together and never split across rows */}
      <div id="created-dates" className={cn('col-span-3 grid-cols-2 gap-3 md:flex md:items-center md:gap-2', showDates ? 'grid' : 'hidden')}>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground md:flex-row md:items-center md:gap-2">
          Created from
          <Input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={e => onChange({ ...filters, dateFrom: e.target.value || undefined, page: 1 })}
            className="md:w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground md:flex-row md:items-center md:gap-2">
          To
          <Input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={e => onChange({ ...filters, dateTo: e.target.value || undefined, page: 1 })}
            className="md:w-40"
          />
        </label>
      </div>
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="col-span-3 gap-1.5 justify-self-start text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
          Clear
          <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-xs tabular-nums">{activeFilterCount}</Badge>
        </Button>
      )}
    </div>
  );
}
