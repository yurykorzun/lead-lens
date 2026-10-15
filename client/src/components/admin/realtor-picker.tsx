import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import type { RealtorMatch } from '@lead-lens/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRealtorSearch, useRealtor } from '@/hooks/use-agents';

function describe(r: RealtorMatch) {
  return [r.kind, r.company, r.email].filter(Boolean).join(' · ');
}

function borrowerCount(r: RealtorMatch) {
  if (r.borrowers === undefined) return 'count unavailable';
  return `${r.borrowers.toLocaleString()} ${r.borrowers === 1 ? 'borrower' : 'borrowers'}`;
}

/**
 * Pick the Salesforce Contact an agent login is linked to. The agent sees the borrowers
 * that point at this record, so the list shows how many each match carries - an empty
 * duplicate of the same realtor shows 0 and sorts last.
 */
export function RealtorPicker({
  id,
  value,
  onChange,
  initialTerm = '',
}: {
  id: string;
  value: string;
  onChange: (match: RealtorMatch | null) => void;
  initialTerm?: string;
}) {
  const [term, setTerm] = useState(initialTerm);
  const [debounced, setDebounced] = useState(initialTerm);
  const [picked, setPicked] = useState<RealtorMatch | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 300);
    return () => clearTimeout(timer);
  }, [term]);

  const current = useRealtor(value && picked?.id !== value ? value : null);
  const search = useRealtorSearch(debounced);
  const selected = picked?.id === value ? picked : current.data?.data;

  if (value) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-md border px-3 py-2" data-testid="realtor-selected">
        <div className="min-w-0 text-sm">
          {selected ? (
            <>
              <div className="font-medium">{selected.name} <span className="font-normal text-muted-foreground">· {borrowerCount(selected)}</span></div>
              <div className="truncate text-xs text-muted-foreground">{describe(selected)}</div>
            </>
          ) : current.isError ? (
            <div className="text-destructive">No Salesforce Contact with this Id</div>
          ) : (
            <div className="text-muted-foreground">Loading…</div>
          )}
          <div className="font-mono text-xs text-muted-foreground">{value}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setPicked(null); onChange(null); }}>
          <X className="mr-1 h-4 w-4" /> Change
        </Button>
      </div>
    );
  }

  const items = search.data?.data.items ?? [];
  const ready = debounced.trim().length >= 2;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={term}
          onChange={e => setTerm(e.target.value)}
          placeholder="Search Salesforce by name or email"
          className="pl-9"
          autoComplete="off"
        />
      </div>
      {ready && (
        <div className="max-h-60 overflow-y-auto rounded-md border" role="listbox">
          {search.isFetching && items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
          ) : search.isError ? (
            <p className="px-3 py-2 text-sm text-destructive">{search.error instanceof Error ? search.error.message : 'Search failed'}</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nobody in Salesforce matches. Try the email they use there.</p>
          ) : (
            items.map(r => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={false}
                className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/60"
                onClick={() => { setPicked(r); onChange(r); }}
              >
                <div className="font-medium">{r.name} <span className="font-normal text-muted-foreground">· {borrowerCount(r)}</span></div>
                <div className="truncate text-xs text-muted-foreground">{describe(r)}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
