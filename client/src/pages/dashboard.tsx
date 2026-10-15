import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useContacts } from '@/hooks/use-contacts';
import { useMetadata } from '@/hooks/use-metadata';
import { AppLayout } from '@/components/layout/app-layout';
import { ContactGrid } from '@/components/grid/contact-grid';
import { FilterBar, SELECT_CLASS } from '@/components/grid/filter-bar';
import { ContactDetailPanel } from '@/components/contact-detail-panel';
import { adminColumns, loanOfficerColumns, agentColumns } from '@/components/grid/columns';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { ContactRow, ContactFilters } from '@lead-lens/shared';

type DisplayRole = 'admin' | 'loan_officer' | 'agent';

const COLUMNS_BY_ROLE = {
  admin: adminColumns,
  loan_officer: loanOfficerColumns,
  agent: agentColumns,
} as const;

export function DashboardContent({ displayRole }: { displayRole: DisplayRole }) {
  const [filters, setFilters] = useState<ContactFilters>({ page: 1, pageSize: 50 });
  // What is actually queried. Typing in search waits 300ms and then goes out together
  // with the page reset it caused; every other change, and clearing the search, is
  // applied at once, so no request ever pairs a new page with a stale search.
  const [queryFilters, setQueryFilters] = useState<ContactFilters>(filters);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const updateFilters = (next: ContactFilters) => {
    setFilters(next);
    clearTimeout(searchTimer.current);
    if ((next.search ?? '') !== (filters.search ?? '') && next.search) {
      searchTimer.current = setTimeout(() => setQueryFilters(next), 300);
    } else {
      setQueryFilters(next);
    }
  };

  const { data, isLoading, error, refetch, isFetching, isPlaceholderData } = useContacts(queryFilters);
  const { data: metadataRes } = useMetadata();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Below 1024px the panel covers the screen, so what's under it must not take focus
  const panelCovers = useMediaQuery('(max-width: 1023px)');

  const dropdowns = metadataRes?.data ?? {};
  const columns = COLUMNS_BY_ROLE[displayRole];

  // Derive selected contact from fresh data — no useEffect sync needed
  const selectedContact = selectedId
    ? data?.data?.find(c => c.id === selectedId) ?? null
    : null;
  // When the open contact leaves the results (a search or filter), close it for good, so
  // it doesn't pop back open and take focus when the filter is cleared
  if (selectedId && data && !isPlaceholderData && !selectedContact) setSelectedId(null);

  const pagination = data?.pagination;
  const pageSize = filters.pageSize || 50;
  const hasFilters = Boolean(filters.search || filters.status || filters.temperature || filters.dateFrom || filters.dateTo);
  const clearFilters = () => updateFilters({ page: 1, pageSize });

  return (
    <div className="flex h-full gap-4">
      {/* Left: table area */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <FilterBar filters={filters} onChange={updateFilters} dropdowns={dropdowns} />

        {error ? (
          <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">
            <p className="font-medium text-destructive">Could not load contacts.</p>
            <p className="mt-1 text-muted-foreground">{error.message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        ) : (
          <>
            <ContactGrid
              data={data?.data ?? []}
              columns={columns}
              onRowClick={(c: ContactRow) => setSelectedId(c.id)}
              selectedId={selectedId ?? undefined}
              className="min-h-0 flex-1"
              isLoading={isLoading}
              onClearFilters={hasFilters ? clearFilters : undefined}
            />
            {pagination && (
              <nav aria-label="Pagination" className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
                    {pagination.totalCount === 0
                      ? '0 contacts'
                      : `${((pagination.page - 1) * pageSize + 1).toLocaleString()}–${Math.min(pagination.page * pageSize, pagination.totalCount).toLocaleString()} of ${pagination.totalCount.toLocaleString()}`}
                  </span>
                  <select
                    aria-label="Rows per page"
                    value={pageSize}
                    onChange={e => updateFilters({ ...filters, pageSize: Number(e.target.value), page: 1 })}
                    className={SELECT_CLASS}
                  >
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateFilters({ ...filters, page: (filters.page || 1) - 1 })}
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center text-sm tabular-nums text-muted-foreground">
                    {pagination.page} / {Math.max(pagination.totalPages, 1)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateFilters({ ...filters, page: (filters.page || 1) + 1 })}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>

      {/* Right: detail panel */}
      {selectedContact && (
        <ContactDetailPanel
          key={selectedContact.id}
          contact={selectedContact}
          onClose={() => setSelectedId(null)}
          role={displayRole}
          covers={panelCovers}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <AppLayout>
      <DashboardContent displayRole={user.role as DisplayRole} />
    </AppLayout>
  );
}
