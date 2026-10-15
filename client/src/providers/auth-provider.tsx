import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, Session } from '@lead-lens/shared';
import { api, ApiRequestError } from '@/lib/api';
import { queryClient } from './query-provider';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, credential: string, isAccessCode?: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(() => !!localStorage.getItem('token'));

  useEffect(() => {
    if (!token) return;
    api.setToken(token);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const RETRY_DELAYS = [1000, 3000];

    const check = (attempt: number) => {
      api
        .get<{ success: boolean; data: { user: User } }>('/auth/verify')
        .then(res => { if (!cancelled) { setUser(res.data.user); setIsLoading(false); } })
        .catch(err => {
          if (cancelled) return;
          // Only a rejected session signs you out. A dropped connection or a reload in the
          // middle of this check used to delete the saved login too.
          if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
            setToken(null);
            localStorage.removeItem('token');
            api.setToken(null);
            setIsLoading(false);
          } else if (attempt < RETRY_DELAYS.length) {
            // A network blip: try again before sending anyone to the sign-in page
            timer = setTimeout(() => check(attempt + 1), RETRY_DELAYS[attempt]);
          } else {
            setIsLoading(false);
          }
        });
    };
    check(0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [token]);

  const login = async (email: string, credential: string, isAccessCode = false) => {
    const body = isAccessCode
      ? { email, accessCode: credential }
      : { email, password: credential };
    const res = await api.post<{ success: boolean; data: Session }>('/auth/login', body);
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('token', res.data.token);
    api.setToken(res.data.token);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    api.setToken(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
