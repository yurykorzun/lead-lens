import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold">Lead Lens</h1>
            {user?.role === 'admin' && (
              <nav className="flex gap-4">
                <Link
                  to="/"
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === '/' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Contacts
                </Link>
                <Link
                  to="/admin"
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === '/admin' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Manage LOs
                </Link>
              </nav>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.name || user.email}
              </span>
              <Button variant="ghost" size="icon" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
