import { useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useAgents } from '@/hooks/use-agents';
import { useLoanOfficers } from '@/hooks/use-loan-officers';
import { ViewAsContext } from '@/hooks/use-view-as';
import { AppLayout } from '@/components/layout/app-layout';
import { SELECT_CLASS } from '@/components/grid/filter-bar';
import { DashboardContent } from '@/pages/dashboard';
import type { UserListItem } from '@lead-lens/shared';

const VALID_ROLES = { officers: 'loan_officer', agents: 'agent' } as const;
type ViewKey = keyof typeof VALID_ROLES;

const LABELS: Record<ViewKey, { title: string; person: string }> = {
  officers: { title: 'Officer View', person: 'loan officer' },
  agents: { title: 'Agent View', person: 'realtor' },
};

/** The Salesforce Id their dashboard is scoped by - none means they see nothing yet */
function sfIdOf(viewKey: ViewKey, u: UserListItem) {
  return (viewKey === 'agents' ? u.sfContactId : u.sfUserId) || null;
}

function PersonPicker({ viewKey, value, onChange }: { viewKey: ViewKey; value: string; onChange: (sfId: string) => void }) {
  const [search, setSearch] = useState('');
  // Only one of the two lists is ever shown, so only that one fetches
  const agents = useAgents({ pageSize: 100, search: viewKey === 'agents' ? search : '' });
  const officers = useLoanOfficers({ pageSize: 100, search: viewKey === 'officers' ? search : '' });
  const list = (viewKey === 'agents' ? agents : officers).data?.data.items ?? [];
  const people = list
    .filter(u => sfIdOf(viewKey, u))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        aria-label={`Find a ${LABELS[viewKey].person}`}
        placeholder={`Find a ${LABELS[viewKey].person}`}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-9 w-48 rounded-md border border-input bg-background px-3 text-base shadow-sm md:text-sm"
      />
      <select
        aria-label={`View as ${LABELS[viewKey].person}`}
        className={SELECT_CLASS}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Every borrower (columns only)</option>
        {people.map(u => (
          <option key={u.id} value={sfIdOf(viewKey, u)!}>{u.name}{u.status === 'disabled' ? ' (disabled)' : ''}</option>
        ))}
      </select>
    </div>
  );
}

export default function ViewAsPage() {
  const { role } = useParams<{ role: string }>();
  const { user, isLoading } = useAuth();
  const [params, setParams] = useSearchParams();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  const viewKey = role as ViewKey;
  const displayRole = VALID_ROLES[viewKey];
  if (!displayRole) return <Navigate to="/" replace />;

  // ?as=<Salesforce Id> keeps the choice in the URL, so reload and Back keep it
  const asId = params.get('as') ?? '';
  const viewAs = asId ? `${displayRole}:${asId}` : undefined;
  const pick = (sfId: string) => setParams(sfId ? { as: sfId } : {}, { replace: true });
  const { title, person } = LABELS[viewKey];

  return (
    <AppLayout>
      <div className="flex h-full flex-col gap-4">
        <div role="note" className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-notice-border bg-notice px-4 py-2 text-sm text-notice-foreground">
          <p>
            <span className="font-semibold">{title}</span>
            {viewAs
              ? <span> - exactly the borrowers this {person} sees, read-only.</span>
              : <span> - the columns a {person} sees, shown for every borrower. Pick a person to see their list.</span>}
          </p>
          <PersonPicker viewKey={viewKey} value={asId} onChange={pick} />
        </div>
        <div className="min-h-0 flex-1">
          {/* key: a new person starts from page 1 with no filters and no open borrower */}
          <ViewAsContext.Provider value={viewAs}>
            <DashboardContent key={viewAs ?? 'all'} displayRole={displayRole} showOpenTasks={Boolean(viewAs) && displayRole === 'agent'} />
          </ViewAsContext.Provider>
        </div>
      </div>
    </AppLayout>
  );
}
