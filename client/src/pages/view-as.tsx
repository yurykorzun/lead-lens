import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/layout/app-layout';
import { DashboardContent } from '@/pages/dashboard';

const VALID_ROLES = { officers: 'loan_officer', agents: 'agent' } as const;
type ViewKey = keyof typeof VALID_ROLES;

const LABELS: Record<ViewKey, string> = {
  officers: 'Officer View',
  agents: 'Agent View',
};

export default function ViewAsPage() {
  const { role } = useParams<{ role: string }>();
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  const viewKey = role as ViewKey;
  const displayRole = VALID_ROLES[viewKey];
  if (!displayRole) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="flex h-full flex-col gap-2">
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
          <span className="text-sm font-medium text-amber-800">
            {LABELS[viewKey]} — Viewing contacts as a {viewKey === 'officers' ? 'loan officer' : 'real estate agent'} would see them
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <DashboardContent displayRole={displayRole} />
        </div>
      </div>
    </AppLayout>
  );
}
