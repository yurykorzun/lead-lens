import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/layout/app-layout';
import { AdminManager } from '@/components/admin/admin-manager';

export default function AdminsPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <AdminManager />
    </AppLayout>
  );
}
