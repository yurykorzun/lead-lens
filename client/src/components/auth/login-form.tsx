import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type LoginMode = 'admin' | 'loan_officer' | 'agent';

export function LoginForm() {
  const { login } = useAuth();
  const [mode, setMode] = useState<LoginMode>('loan_officer');
  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, credential, mode !== 'admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Sign in as" className="flex rounded-lg border p-1">
        <button
          type="button"
          onClick={() => { setMode('admin'); setCredential(''); setError(''); }}
          aria-pressed={mode === 'admin'}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            mode === 'admin' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Admin
        </button>
        <button
          type="button"
          onClick={() => { setMode('loan_officer'); setCredential(''); setError(''); }}
          aria-pressed={mode === 'loan_officer'}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            mode === 'loan_officer' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Loan Officer
        </button>
        <button
          type="button"
          onClick={() => { setMode('agent'); setCredential(''); setError(''); }}
          aria-pressed={mode === 'agent'}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            mode === 'agent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Agent
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="credential">
            {mode === 'admin' ? 'Password' : 'Access Code'}
          </Label>
          <Input
            id="credential"
            type={mode === 'admin' ? 'password' : 'text'}
            autoComplete={mode === 'admin' ? 'current-password' : 'off'}
            value={credential}
            onChange={e => setCredential(e.target.value)}
            placeholder={mode !== 'admin' ? 'From your welcome email' : ''}
            required
          />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
