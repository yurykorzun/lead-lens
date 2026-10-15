import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import App from '@/App';
import { Toaster } from '@/components/ui/sonner';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <App />
          <Toaster position="bottom-right" richColors />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>
);
