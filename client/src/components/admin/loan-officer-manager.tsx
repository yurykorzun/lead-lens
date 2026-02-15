import { useState } from 'react';
import { MoreHorizontal, Pencil, KeyRound, Ban, CheckCircle } from 'lucide-react';
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
  useLoanOfficers,
  useCreateLoanOfficer,
  useUpdateLoanOfficer,
  useRegenerateCode,
  useDeleteLoanOfficer,
} from '@/hooks/use-loan-officers';

export function LoanOfficerManager() {
  const { data: response, isLoading } = useLoanOfficers();
  const createMutation = useCreateLoanOfficer();
  const updateMutation = useUpdateLoanOfficer();
  const regenerateMutation = useRegenerateCode();
  const deleteMutation = useDeleteLoanOfficer();

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createError, setCreateError] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState('');

  const [codeModal, setCodeModal] = useState<{ name: string; code: string } | null>(null);

  const loanOfficers = response?.data ?? [];

  const handleCreate = async () => {
    setCreateError('');
    try {
      const res = await createMutation.mutateAsync({ name: createName, email: createEmail });
      setShowCreate(false);
      setCreateName('');
      setCreateEmail('');
      setCodeModal({ name: createName, code: res.data.accessCode });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create');
    }
  };

  const handleEdit = async () => {
    if (!editId) return;
    setEditError('');
    try {
      await updateMutation.mutateAsync({ id: editId, data: { name: editName, email: editEmail } });
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
    if (currentStatus === 'active') {
      await deleteMutation.mutateAsync(id);
    } else {
      await updateMutation.mutateAsync({ id, data: { status: 'active' } });
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading loan officers...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Loan Officers</h2>
        <Button onClick={() => setShowCreate(true)}>Add Loan Officer</Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Created</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Last Login</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loanOfficers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No loan officers yet. Add one to get started.
                </td>
              </tr>
            ) : (
              loanOfficers.map(lo => (
                <tr key={lo.id} className="border-b transition-colors hover:bg-muted/50">
                  <td className="px-3 py-2 font-medium">{lo.name}</td>
                  <td className="px-3 py-2">{lo.email}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={
                        lo.status === 'active'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-red-100 text-red-800 border-red-200'
                      }
                    >
                      {lo.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {lo.createdAt ? new Date(lo.createdAt).toLocaleDateString() : ''}
                  </td>
                  <td className="px-3 py-2">
                    {lo.lastLoginAt ? new Date(lo.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-3 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditId(lo.id);
                            setEditName(lo.name);
                            setEditEmail(lo.email);
                            setEditError('');
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRegenerate(lo.id, lo.name)}>
                          <KeyRound className="mr-2 h-4 w-4" />
                          New Code
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(lo.id, lo.status)}
                          className={lo.status === 'active' ? 'text-destructive focus:text-destructive' : ''}
                        >
                          {lo.status === 'active' ? (
                            <><Ban className="mr-2 h-4 w-4" /> Disable</>
                          ) : (
                            <><CheckCircle className="mr-2 h-4 w-4" /> Enable</>
                          )}
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

      {/* Create Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Loan Officer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lo-name">Name</Label>
              <Input
                id="lo-name"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lo-email">Email</Label>
              <Input
                id="lo-email"
                type="email"
                value={createEmail}
                onChange={e => setCreateEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={!createName || !createEmail || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editId !== null} onOpenChange={() => setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Loan Officer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
              />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <Button
              className="w-full"
              onClick={handleEdit}
              disabled={!editName || !editEmail || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Access Code Modal */}
      {codeModal && (
        <AccessCodeModal
          open
          onClose={() => setCodeModal(null)}
          name={codeModal.name}
          accessCode={codeModal.code}
        />
      )}
    </div>
  );
}
