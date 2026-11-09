import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useOpenTasks } from '@/hooks/use-tasks';
import { TaskRow } from '@/components/contact-tasks';

const FIRST = 3;

/** The signed-in realtor's next open step on each of her borrowers, earliest due first */
export function OpenTasks() {
  const [showAll, setShowAll] = useState(false);
  const tasks = useOpenTasks(true);
  const items = tasks.data?.data ?? [];

  // An empty list is normal (no borrowers assigned yet), and a failure must not block the grid
  if (!tasks.isSuccess || items.length === 0) return null;

  const shown = showAll ? items : items.slice(0, FIRST);
  return (
    <section aria-labelledby="open-tasks" className="shrink-0 rounded-lg border bg-card px-4 pt-3" data-testid="open-tasks">
      <h2 id="open-tasks" className="text-sm font-medium">
        To do <span className="tabular-nums text-muted-foreground">({items.length})</span>
      </h2>
      {/* Expanded, the list scrolls on its own so the borrower table stays on screen */}
      <ul className={showAll ? 'max-h-72 divide-y overflow-y-auto' : 'divide-y'}>
        {shown.map(t => <TaskRow key={t.id} task={t} showBorrower />)}
      </ul>
      {items.length > FIRST && (
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => setShowAll(s => !s)}>
          {showAll ? 'Show fewer' : `Show all ${items.length}`}
        </Button>
      )}
    </section>
  );
}
