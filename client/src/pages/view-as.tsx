import { Navigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useViewAsUser } from '@/hooks/use-view-as';
import { AppLayout } from '@/components/layout/app-layout';
import { DashboardContent } from '@/pages/dashboard';

const VALID_ROLES = { officers: 'loan_officer', agents: 'agent' } as const;
type ViewKey = keyof typeof VALID_ROLES;

const LABELS: Record<ViewKey, string> = {
  officers: 'Officer View',
  agents: 'Agent View',
};

const ROLE_NOUN: Record<ViewKey, string> = {
  officers: 'loan officer',
  agents: 'real estate agent',
};

const BACK_TO: Record<ViewKey, { to: string; label: string }> = {
  officers: { to: '/admin', label: 'Back to Manage LOs' },
  agents: { to: '/agents', label: 'Back to Manage Agents' },
};

export default function ViewAsPage() {
  const { role, userId } = useParams<{ role: string; userId?: string }>();
  const { user, isLoading } = useAuth();
  const { data: targetRes, isLoading: targetLoading, error: targetError } = useViewAsUser(userId);

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  const viewKey = role as ViewKey;
  const displayRole = VALID_ROLES[viewKey];
  if (!displayRole) return <Navigate to="/" replace />;

  const target = targetRes?.data;
  const back = BACK_TO[viewKey];

  // Wait for the identity before querying, so we never flash the admin's own
  // unscoped contact list while pretending to be someone else.
  if (userId && targetLoading) return null;

  return (
    <AppLayout>
      <div className="flex h-full flex-col gap-2">
        <div className="flex shrink-0 items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
          <span className="text-sm font-medium text-amber-800">
            {targetError ? (
              <>That {ROLE_NOUN[viewKey]} could not be found — showing nothing.</>
            ) : target ? (
              <>
                {LABELS[viewKey]} — viewing as <strong>{target.name}</strong>. Read-only; these are the
                contacts {target.name} sees when they log in.
              </>
            ) : (
              <>{LABELS[viewKey]} — viewing contacts as a {ROLE_NOUN[viewKey]} would see them</>
            )}
          </span>
          <Link
            to={back.to}
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-amber-900 underline-offset-2 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {back.label}
          </Link>
        </div>
        <div className="min-h-0 flex-1">
          {targetError ? null : (
            <DashboardContent
              /* keyed so filters and paging reset when the target changes */
              key={target?.id ?? 'role'}
              displayRole={displayRole}
              viewAsUserId={target?.id}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
