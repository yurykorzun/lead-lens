import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useContacts } from '@/hooks/use-contacts';
import { useMetadata } from '@/hooks/use-metadata';
import { AppLayout } from '@/components/layout/app-layout';
import { ContactGrid } from '@/components/grid/contact-grid';
import { FilterBar } from '@/components/grid/filter-bar';
import { ContactDetailPanel } from '@/components/contact-detail-panel';
import { adminColumns, loanOfficerColumns } from '@/components/grid/columns';
import { Button } from '@/components/ui/button';
import type { ContactRow, ContactFilters } from '@lead-lens/shared';

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [filters, setFilters] = useState<ContactFilters>({ page: 1, pageSize: 50 });
  const { data, isLoading, error } = useContacts(filters);
  const { data: metadataRes } = useMetadata();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dropdowns = metadataRes?.data ?? {};
  const columns = user?.role === 'admin' ? adminColumns : loanOfficerColumns;

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
          ) : isLoading ? (
            <p className="text-muted-foreground">Loading contacts...</p>
          ) : (
            <>
              <ContactGrid
                data={data?.data ?? []}
                columns={columns}
                onRowClick={(c: ContactRow) => setSelectedId(c.id)}
                selectedId={selectedId ?? undefined}
                className="min-h-0 flex-1"
              />
              {pagination && pagination.totalPages > 1 && (
                <div className="flex shrink-0 items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} contacts)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
                      disabled={pagination.page <= 1}
                    >
                      Previous
                    </Button>
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
            role={user.role as 'admin' | 'loan_officer'}
          />
        )}
      </div>
    </AppLayout>
  );
}
