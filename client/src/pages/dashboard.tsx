import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useContacts } from '@/hooks/use-contacts';
import { useMetadata } from '@/hooks/use-metadata';
import { useDirtyTracker } from '@/hooks/use-dirty-tracker';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/app-layout';
import { ContactGrid } from '@/components/grid/contact-grid';
import { FilterBar } from '@/components/grid/filter-bar';
import { SaveBar } from '@/components/grid/save-bar';
import { adminColumns, loanOfficerColumns } from '@/components/grid/columns';
import type { ContactFilters } from '@lead-lens/shared';

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [filters, setFilters] = useState<ContactFilters>({ page: 1, pageSize: 50 });
  const { data, isLoading, error } = useContacts(filters);
  const { data: metadataRes } = useMetadata();
  const { dirtyCount, markDirty, clearDirty, getDirtyUpdates } = useDirtyTracker();
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const dropdowns = metadataRes?.data ?? {};

  const columns = user?.role === 'admin' ? adminColumns : loanOfficerColumns;

  // Beforeunload guard
  useEffect(() => {
    if (dirtyCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyCount]);

  const handleSave = useCallback(async () => {
    const updates = getDirtyUpdates();
    if (updates.length === 0) return;

    setSaving(true);
    try {
      await api.patch('/contacts', { updates });
      clearDirty();
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [getDirtyUpdates, clearDirty, queryClient]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const pagination = data?.pagination;

  return (
    <AppLayout>
      <div className="space-y-4">
        <FilterBar filters={filters} onChange={setFilters} dropdowns={dropdowns} />
        <SaveBar dirtyCount={dirtyCount} onSave={handleSave} saving={saving} />
        {error ? (
          <p className="text-red-600">Error loading contacts: {error.message}</p>
        ) : isLoading ? (
          <p className="text-muted-foreground">Loading contacts...</p>
        ) : (
          <>
            <ContactGrid data={data?.data ?? []} columns={columns} onDirty={markDirty} dropdowns={dropdowns} />
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} contacts)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
                    disabled={pagination.page <= 1}
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
