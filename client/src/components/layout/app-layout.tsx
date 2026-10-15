import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LogOut, KeyRound, Menu, Moon, Sun } from 'lucide-react';
import { ChangePasswordDialog } from '@/components/admin/change-password-dialog';
import { ThemeToggle, useIsDark } from '@/providers/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ADMIN_PAGES = [
  { to: '/', label: 'Contacts' },
  { to: '/admin', label: 'Manage LOs' },
  { to: '/agents', label: 'Manage Agents' },
  { to: '/admins', label: 'Manage Admins' },
];
const VIEW_AS_PAGES = [
  { to: '/view/officers', label: 'Officer View' },
  { to: '/view/agents', label: 'Agent View' },
];

function NavLink({ to, label, current }: { to: string; label: string; current: boolean }) {
  return (
    <Link
      to={to}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'inline-flex h-8 items-center whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        current ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggle } = useIsDark();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const isAdmin = user?.role === 'admin';
  const isCurrent = (to: string) => location.pathname === to;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="shrink-0 border-b">
        <div className="flex h-14 items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-6">
            <h1 className="whitespace-nowrap text-lg font-semibold">Lead Lens</h1>
            {isAdmin && (
              <nav aria-label="Main" className="hidden items-center gap-4 lg:flex">
                {ADMIN_PAGES.map(p => <NavLink key={p.to} {...p} current={isCurrent(p.to)} />)}
                <span aria-hidden="true" className="h-4 w-px bg-border" />
                {VIEW_AS_PAGES.map(p => <NavLink key={p.to} {...p} current={isCurrent(p.to)} />)}
              </nav>
            )}
          </div>
          {user && (
            <>
              {/* Wide screens: name and icon buttons */}
              <div className="hidden items-center gap-1 lg:flex">
                <span className="mr-3 max-w-56 truncate text-sm text-muted-foreground">{user.name || user.email}</span>
                <ThemeToggle />
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => setShowChangePassword(true)} aria-label="Change password" title="Change password">
                    <KeyRound />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out" title="Sign out">
                  <LogOut />
                </Button>
              </div>

              {/* Narrow screens: everything in one menu, so sign out is always reachable */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 lg:hidden">
                    <Menu /> Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.name || user.email}</DropdownMenuLabel>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      {[...ADMIN_PAGES, ...VIEW_AS_PAGES].map(p => (
                        <DropdownMenuItem key={p.to} onSelect={() => navigate(p.to)} className={cn('min-h-10', isCurrent(p.to) && 'font-semibold')}>
                          {p.label}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={toggle} className="min-h-10">
                    {isDark ? <Sun /> : <Moon />} {isDark ? 'Light theme' : 'Dark theme'}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onSelect={() => setShowChangePassword(true)} className="min-h-10">
                      <KeyRound /> Change password
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={logout} className="min-h-10">
                    <LogOut /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto px-4 py-4">{children}</main>
      <ChangePasswordDialog open={showChangePassword} onOpenChange={setShowChangePassword} />
    </div>
  );
}
