import { useState } from 'react';
import { NOTE_MAX_LENGTH, type ContactNote } from '@lead-lens/shared';
import { Button } from '@/components/ui/button';
import { useNotes, useAddNote } from '@/hooks/use-notes';

const ROLE_LABELS: Record<ContactNote['authorRole'], string> = {
  admin: 'Admin',
  loan_officer: 'Loan officer',
  agent: 'Realtor',
};

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Notes on a borrower, shared by everyone who sees it in Lead Lens (its realtor, its loan
 * officer, admins). They live in Lead Lens only and never reach Salesforce.
 */
export function ContactNotes({ recordId }: { recordId: string }) {
  const [draft, setDraft] = useState('');
  const notes = useNotes(recordId);
  const add = useAddNote(recordId);
  const items = notes.data?.data ?? [];
  const tooLong = draft.length > NOTE_MAX_LENGTH;

  const save = async () => {
    const body = draft.trim();
    if (!body || tooLong) return;
    try {
      await add.mutateAsync(body);
      setDraft('');
    } catch {
      // the error is shown from add.error below
    }
  };

  return (
    <section className="mt-6" data-testid="notes">
      <h3 className="mb-1 text-sm font-medium text-muted-foreground">Notes</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Kept in Lead Lens only. Everyone who can see this borrower here can read them.
      </p>

      <textarea
        aria-label="New note"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={3}
        placeholder="Add a note"
        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`text-xs ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}>
          {tooLong ? `${draft.length} / ${NOTE_MAX_LENGTH} - too long` : ''}
        </span>
        <Button size="sm" onClick={save} disabled={!draft.trim() || tooLong || add.isPending}>
          {add.isPending ? 'Saving...' : 'Add note'}
        </Button>
      </div>
      {add.isError && (
        <p className="mt-2 text-sm text-destructive">{add.error instanceof Error ? add.error.message : 'Could not save the note'}</p>
      )}

      <div className="mt-4 space-y-3">
        {notes.isPending ? (
          <p className="text-sm text-muted-foreground">Loading notes...</p>
        ) : notes.isError ? (
          <p className="text-sm text-destructive">Could not load notes</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          items.map(n => (
            <div key={n.id} className="rounded-lg border bg-muted/30 p-3" data-testid="note">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">{n.mine ? 'You' : n.authorName}</span> · {ROLE_LABELS[n.authorRole] ?? n.authorRole}
                </span>
                <span>{when(n.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">{n.body}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
