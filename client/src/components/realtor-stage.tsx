import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { REALTOR_STAGES, REALTOR_STAGE_ON_HOLD, type RealtorStage } from '@lead-lens/shared';
import { Button } from '@/components/ui/button';
import { useStage, useSetStage } from '@/hooks/use-stage';
import { useViewAs } from '@/hooks/use-view-as';

const PATH: readonly RealtorStage[] = REALTOR_STAGES;
const CHOICES: readonly RealtorStage[] = [...REALTOR_STAGES, REALTOR_STAGE_ON_HOLD];

function when(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Where the realtor is with the buyer, from first call to closing. The realtor moves it
 * with one tap; the loan officer and admins read it here and in the Salesforce notes, so
 * nobody has to call to ask. Hidden until the org has the field (enabled: false).
 */
export function RealtorStageCard({ recordId, role }: { recordId: string; role: 'admin' | 'loan_officer' | 'agent' }) {
  const [open, setOpen] = useState(false);
  const stage = useStage(recordId);
  const set = useSetStage(recordId);
  const viewOnly = Boolean(useViewAs());
  const state = stage.data?.data;
  if (stage.isPending || stage.isError || !state?.enabled) return null;

  const current = state.stage;
  const onHold = current === REALTOR_STAGE_ON_HOLD;
  const index = current && !onHold ? PATH.indexOf(current) : -1;
  const next = index >= 0 && index < PATH.length - 1 ? PATH[index + 1] : undefined;
  const canSet = role === 'agent' && !viewOnly;

  const choose = async (s: RealtorStage) => {
    try {
      await set.mutateAsync(s);
      setOpen(false);
    } catch {
      // shown from set.error below
    }
  };

  return (
    <section className="mt-5 rounded-lg border bg-card p-4" data-testid="stage" aria-labelledby="stage-title">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="stage-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Buying stage</h3>
        {index >= 0 && <span className="text-xs text-muted-foreground">{index + 1} of {PATH.length}</span>}
      </div>
      <p className="mt-1 text-base font-semibold" data-testid="stage-current">
        {current ?? 'Not set yet'}
      </p>

      <div
        className={`mt-3 flex gap-1 ${onHold ? 'opacity-50' : ''}`}
        role="img"
        aria-label={index >= 0 ? `Step ${index + 1} of ${PATH.length}` : 'No step yet'}
      >
        {PATH.map((s, i) => (
          <span key={s} className={`h-2 flex-1 rounded-full ${i <= index ? 'bg-progress' : 'bg-progress-track'}`} />
        ))}
      </div>

      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        {next && <p>Next: <span className="text-foreground">{next}</span></p>}
        {onHold && <p>Paused. Pick a stage when things move again.</p>}
        {state.setAt && <p>Updated {when(state.setAt)}{state.setBy ? ` by ${state.setBy}` : ''}</p>}
        {!current && !canSet && <p>The realtor hasn't set a stage yet.</p>}
      </div>

      {canSet && (
        <>
          <Button
            variant={current ? 'outline' : 'default'}
            className="mt-3 h-11 w-full md:h-9"
            aria-expanded={open}
            aria-controls="stage-choices"
            onClick={() => setOpen(o => !o)}
          >
            {current ? 'Update stage' : 'Set the stage'}
            {open ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
          </Button>
          {open && (
            <ul id="stage-choices" className="mt-2 divide-y rounded-md border" aria-label="Stages">
              {CHOICES.map((s, i) => {
                const isCurrent = s === current;
                // A checklist, as on AgentDash: every stage up to the current one is ticked
                const done = isCurrent || (index >= 0 && i <= index);
                return (
                  <li key={s}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60"
                      aria-pressed={isCurrent}
                      disabled={set.isPending}
                      onClick={() => void choose(s)}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${done ? 'border-progress bg-progress text-background' : 'border-progress-track'}`}
                      >
                        {done && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className={`flex-1 ${s === REALTOR_STAGE_ON_HOLD ? 'text-muted-foreground' : ''} ${isCurrent ? 'font-medium' : ''}`}>{s}</span>
                      <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {set.isPending && <p className="mt-2 text-xs text-muted-foreground" role="status">Saving…</p>}
          {set.isError && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {set.error instanceof Error ? set.error.message : 'Could not save the stage'}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Your loan officer sees each change in Salesforce.</p>
        </>
      )}
    </section>
  );
}
