import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useContacts } from '@/hooks/use-contacts';
import { useMetadata } from '@/hooks/use-metadata';
import { AppLayout } from '@/components/layout/app-layout';
import { ContactGrid } from '@/components/grid/contact-grid';
import { FilterBar } from '@/components/grid/filter-bar';
import { ContactDetailPanel } from '@/components/contact-detail-panel';
import { adminColumns, loanOfficerColumns, agentColumns } from '@/components/grid/columns';
import { Button } from '@/components/ui/button';
import type { ContactRow, ContactFilters } from '@lead-lens/shared';

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [filters, setFilters] = useState<ContactFilters>({ page: 1, pageSize: 50 });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search, apply other filters immediately
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (filters.search !== debouncedFilters.search) {
      debounceRef.current = setTimeout(() => setDebouncedFilters(filters), 300);
    } else {
      setDebouncedFilters(filters);
    }
    return () => clearTimeout(debounceRef.current);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, error } = useContacts(debouncedFilters);
  const { data: metadataRes } = useMetadata();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dropdowns = metadataRes?.data ?? {};
  const columns = user?.role === 'admin' ? adminColumns : user?.role === 'agent' ? agentColumns : loanOfficerColumns;

  // Derive selected contact from fresh data — no useEffect sync needed
  const selectedContact = selectedId
    ? data?.data?.find(c => c.id === selectedId) ?? null
    : null;

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const pagination = data?.pagination;

  return (
    <AppLayout>
      <div className="flex h-full gap-4">
        {/* Left: table area */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <FilterBar filters={filters} onChange={setFilters} dropdowns={dropdowns} />

          {error ? (
            <p className="text-red-600">Error loading contacts: {error.message}</p>
          ) : (
            <>
              <ContactGrid
                data={data?.data ?? []}
                columns={columns}
                onRowClick={(c: ContactRow) => setSelectedId(c.id)}
                selectedId={selectedId ?? undefined}
                className="min-h-0 flex-1"
                isLoading={isLoading}
              />
              {pagination && (
                <div className="flex shrink-0 items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">
                      {((pagination.page - 1) * (filters.pageSize || 50) + 1)}–{Math.min(pagination.page * (filters.pageSize || 50), pagination.totalCount)} of {pagination.totalCount.toLocaleString()}
                    </span>
                    <select
                      value={filters.pageSize || 50}
                      onChange={e => setFilters(f => ({ ...f, pageSize: Number(e.target.value), page: 1 }))}
                      className="h-8 rounded border border-slate-200 bg-white px-2 text-sm text-slate-700"
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
                      onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
                      disabled={pagination.page <= 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center text-sm text-slate-500">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: detail panel */}
        {selectedContact && (
          <ContactDetailPanel
            contact={selectedContact}
            onClose={() => setSelectedId(null)}
            dropdowns={dropdowns}
            role={user.role as 'admin' | 'loan_officer' | 'agent'}
          />
        )}
      </div>
    </AppLayout>
  );
}
