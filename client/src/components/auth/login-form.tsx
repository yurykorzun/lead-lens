import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type LoginMode = 'admin' | 'loan_officer';

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
      await login(email, credential, mode === 'loan_officer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border p-1">
        <button
          type="button"
          onClick={() => { setMode('admin'); setCredential(''); setError(''); }}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === 'admin' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Admin
        </button>
        <button
          type="button"
          onClick={() => { setMode('loan_officer'); setCredential(''); setError(''); }}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === 'loan_officer' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Loan Officer
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="credential">
            {mode === 'admin' ? 'Password' : 'Access Code'}
          </Label>
          <Input
            id="credential"
            type={mode === 'admin' ? 'password' : 'text'}
            value={credential}
            onChange={e => setCredential(e.target.value)}
            placeholder={mode === 'loan_officer' ? 'Enter your access code' : ''}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
