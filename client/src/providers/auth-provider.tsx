import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, Session } from '@lead-lens/shared';
import { api } from '@/lib/api';

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.setToken(token);
      api
        .get<{ success: boolean; data: { user: User } }>('/auth/verify')
        .then(res => setUser(res.data.user))
        .catch(() => {
          setToken(null);
          localStorage.removeItem('token');
          api.setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
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
