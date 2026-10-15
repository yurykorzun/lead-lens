import { Navigate } from 'react-router-dom';
import { LoginForm } from '@/components/auth/login-form';
import { useAuth } from '@/hooks/use-auth';
import { ThemeToggle } from '@/providers/theme-provider';

export default function LoginPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="relative flex min-h-dvh items-center justify-center">
      <ThemeToggle className="absolute right-3 top-3" />
      <div className="w-full max-w-sm space-y-6 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Lead Lens</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
