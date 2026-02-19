import { useState, useEffect } from 'react';
import { MoreHorizontal, Pencil, KeyRound, Ban, CheckCircle, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AccessCodeModal } from './access-code-modal';
import {
  useAgents,
  useCreateAgent,
  useUpdateAgent,
  useRegenerateAgentCode,
  useDeleteAgent,
} from '@/hooks/use-agents';

const PAGE_SIZE = 25;

export function AgentManager() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: response, isLoading, isFetching } = useAgents({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
  });
  const createMutation = useCreateAgent();
  const updateMutation = useUpdateAgent();
  const regenerateMutation = useRegenerateAgentCode();
  const deleteMutation = useDeleteAgent();

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createError, setCreateError] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState('');

  const [codeModal, setCodeModal] = useState<{ name: string; code: string } | null>(null);

  const agents = response?.data?.items ?? [];
  const total = response?.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleCreate = async () => {
    setCreateError('');
    const trimmedName = createName.trim();
    const trimmedEmail = createEmail.trim().toLowerCase();

    if (!trimmedName) { setCreateError('Name is required'); return; }
    if (!trimmedEmail) { setCreateError('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setCreateError('Please enter a valid email address'); return; }

    try {
      const res = await createMutation.mutateAsync({ name: trimmedName, email: trimmedEmail });
      setShowCreate(false);
      setCreateName('');
      setCreateEmail('');
      setCodeModal({ name: trimmedName, code: res.data.accessCode });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create');
    }
  };

  const handleEdit = async () => {
    if (!editId) return;
    setEditError('');
    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim().toLowerCase();

    if (!trimmedName) { setEditError('Name is required'); return; }
    if (!trimmedEmail) { setEditError('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setEditError('Please enter a valid email address'); return; }

    try {
      await updateMutation.mutateAsync({ id: editId, data: { name: trimmedName, email: trimmedEmail } });
      setEditId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleRegenerate = async (id: string, name: string) => {
    try {
      const res = await regenerateMutation.mutateAsync(id);
      setCodeModal({ name, code: res.data.accessCode });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate code');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    await updateMutation.mutateAsync({ id, data: { status: newStatus } });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Permanently delete agent "${name}"? This cannot be undone.`)) return;
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Real Estate Agents</h2>
        <Button onClick={() => { setShowCreate(true); setCreateName(''); setCreateEmail(''); setCreateError(''); }}>Add Agent</Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Contacts are matched by the agent's <strong>name</strong> in the Salesforce field{' '}
        <span className="font-mono text-xs">Referred_By_Text</span>.
        The name entered here must match exactly how it appears in Salesforce.
      </p>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Leads</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Created</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Last Login</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Loading agents...</td>
              </tr>
            ) : agents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {debouncedSearch ? 'No agents match your search.' : 'No agents yet. Add one to get started.'}
                </td>
              </tr>
            ) : (
              agents.map(a => (
                <tr key={a.id} className="border-b transition-colors hover:bg-muted/50">
                  <td className="px-3 py-2 font-medium">{a.name}</td>
                  <td className="px-3 py-2">{a.email}</td>
                  <td className="px-3 py-2 tabular-nums">{a.activeLeads?.toLocaleString() ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={a.status === 'active' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>
                      {a.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}</td>
                  <td className="px-3 py-2">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                  <td className="px-3 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditId(a.id); setEditName(a.name); setEditEmail(a.email); setEditError(''); }}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRegenerate(a.id, a.name)}>
                          <KeyRound className="mr-2 h-4 w-4" /> New Code
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleToggleStatus(a.id, a.status)} className={a.status === 'active' ? 'text-destructive focus:text-destructive' : ''}>
                          {a.status === 'active' ? <><Ban className="mr-2 h-4 w-4" /> Disable</> : <><CheckCircle className="mr-2 h-4 w-4" /> Enable</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(a.id, a.name)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1 || isFetching}><ChevronLeft className="h-4 w-4" /></Button>
            <span>Page {page} of {totalPages.toLocaleString()}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages || isFetching}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Real Estate Agent</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="agent-name">Name</Label><Input id="agent-name" value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Full name" /></div>
            <div className="space-y-2"><Label htmlFor="agent-email">Email</Label><Input id="agent-email" type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="email@example.com" /></div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <Button className="w-full" onClick={handleCreate} disabled={!createName || !createEmail || createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editId !== null} onOpenChange={() => setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Agent</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="edit-agent-name">Name</Label><Input id="edit-agent-name" value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="edit-agent-email">Email</Label><Input id="edit-agent-email" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} /></div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <Button className="w-full" onClick={handleEdit} disabled={!editName || !editEmail || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {codeModal && <AccessCodeModal open onClose={() => setCodeModal(null)} name={codeModal.name} accessCode={codeModal.code} />}
    </div>
  );
}
