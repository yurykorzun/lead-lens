import type { ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Light or dark follows the system until someone picks one; the choice is kept per
// browser. next-themes sets the .dark class on <html> before first paint, so there is
// no flash of the wrong theme. The toaster reads the same setting.
export const THEME_STORAGE_KEY = 'lead-lens-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem storageKey={THEME_STORAGE_KEY} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}

export function useIsDark() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return { isDark, toggle: () => setTheme(isDark ? 'light' : 'dark') };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { isDark, toggle } = useIsDark();
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label} className={className}>
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
