import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LogOut, KeyRound } from 'lucide-react';
import { ChangePasswordDialog } from '@/components/admin/change-password-dialog';

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="shrink-0 border-b">
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
                <Link
                  to="/agents"
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === '/agents' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Manage Agents
                </Link>
                <Link
                  to="/admins"
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === '/admins' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Manage Admins
                </Link>
              </nav>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.name || user.email}
              </span>
              {user.role === 'admin' && (
                <Button variant="ghost" size="icon" onClick={() => setShowChangePassword(true)} title="Change Password">
                  <KeyRound className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto px-4 py-4">{children}</main>
      <ChangePasswordDialog open={showChangePassword} onOpenChange={setShowChangePassword} />
    </div>
  );
}
