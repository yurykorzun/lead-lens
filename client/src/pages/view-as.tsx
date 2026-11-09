import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useAgents } from '@/hooks/use-agents';
import { useLoanOfficers } from '@/hooks/use-loan-officers';
import { ViewAsContext } from '@/hooks/use-view-as';
import { AppLayout } from '@/components/layout/app-layout';
import { SELECT_CLASS } from '@/components/grid/filter-bar';
import { DashboardContent } from '@/pages/dashboard';

const VALID_ROLES = { officers: 'loan_officer', agents: 'agent' } as const;
type ViewKey = keyof typeof VALID_ROLES;

const LABELS: Record<ViewKey, { view: string; person: string; everyone: string }> = {
  officers: { view: 'Officer View', person: 'loan officer', everyone: 'All loan officers (columns only)' },
  agents: { view: 'Agent View', person: 'real estate agent', everyone: 'All agents (columns only)' },
};

/** Both lists load (hooks cannot be conditional); only the one for this view is shown */
function usePeople(viewKey: ViewKey) {
  const agents = useAgents({ pageSize: 100 });
  const officers = useLoanOfficers({ pageSize: 100 });
  const list = viewKey === 'agents' ? agents : officers;
  return (list.data?.data?.items ?? []).filter(u => u.status === 'active');
}

export default function ViewAsPage() {
  const { role } = useParams<{ role: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading } = useAuth();
  const viewKey = role as ViewKey;
  const people = usePeople(viewKey in VALID_ROLES ? viewKey : 'agents');

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  const displayRole = VALID_ROLES[viewKey];
  if (!displayRole) return <Navigate to="/" replace />;

  const labels = LABELS[viewKey];
  const asUser = searchParams.get('user') ?? undefined;
  const person = people.find(p => p.id === asUser);
  const pick = (id: string) => setSearchParams(id ? { user: id } : {}, { replace: true });

  return (
    <AppLayout>
      <div className="flex h-full flex-col gap-4">
        <div role="note" className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-notice-border bg-notice px-4 py-2 text-sm text-notice-foreground">
          <span className="font-semibold">{labels.view}</span>
          <select
            aria-label={`View as ${labels.person}`}
            value={asUser ?? ''}
            onChange={e => pick(e.target.value)}
            className={`${SELECT_CLASS} max-w-full`}
          >
            <option value="">{labels.everyone}</option>
            {/* Keep a picked person selectable while the list is still loading */}
            {asUser && !person && <option value={asUser}>Loading…</option>}
            {people.map(p => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
          </select>
          <span>
            {asUser
              ? `- exactly what ${person?.name || 'this person'} sees, read-only. Nothing can be marked done or added here.`
              : `- the columns a ${labels.person} sees, shown for every borrower. Pick someone to see their own dashboard.`}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          {/* key: a new person starts with fresh filters and no open borrower */}
          <ViewAsContext.Provider value={asUser}>
            <DashboardContent key={asUser ?? 'all'} displayRole={displayRole} showOpenTasks={Boolean(asUser) && displayRole === 'agent'} />
          </ViewAsContext.Provider>
        </div>
      </div>
    </AppLayout>
  );
}
