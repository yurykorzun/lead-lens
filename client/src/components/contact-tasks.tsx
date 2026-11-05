import { Check } from 'lucide-react';
import type { RealtorTask } from '@lead-lens/shared';
import { Button } from '@/components/ui/button';
import { formatDay } from '@/components/grid/format';
import { useTasks, useCompleteTask } from '@/hooks/use-tasks';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Overdue" / "Due today" / the date, for an open task */
export function DueLabel({ task }: { task: RealtorTask }) {
  if (task.done) return <span className="text-muted-foreground">Done</span>;
  if (!task.dueDate) return null;
  const t = today();
  if (task.dueDate < t) return <span className="font-medium text-destructive">Overdue · {formatDay(task.dueDate)}</span>;
  if (task.dueDate === t) return <span className="font-medium text-foreground">Due today</span>;
  return <span className="text-muted-foreground">Due {formatDay(task.dueDate)}</span>;
}

export function TaskRow({ task, showBorrower = false }: { task: RealtorTask; showBorrower?: boolean }) {
  const complete = useCompleteTask();
  return (
    <li className="flex items-center justify-between gap-3 py-2.5" data-testid="task">
      <div className="min-w-0">
        <p className={`text-sm ${task.done ? 'text-muted-foreground line-through' : ''}`}>
          {task.subject}
          {showBorrower && task.borrowerName && <span className="text-muted-foreground"> · {task.borrowerName}</span>}
        </p>
        <p className="text-xs"><DueLabel task={task} /></p>
        {complete.isError && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {complete.error instanceof Error ? complete.error.message : 'Could not mark it done'}
          </p>
        )}
      </div>
      {task.canComplete && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={complete.isPending}
          onClick={() => complete.mutate({ recordId: task.borrowerId, taskId: task.id })}
        >
          <Check aria-hidden="true" className="h-4 w-4" />
          {complete.isPending ? 'Saving…' : 'Mark done'}
        </Button>
      )}
    </li>
  );
}

/**
 * The fixed realtor steps on a borrower (call 1/2/3, showing 1/2/3). Salesforce creates
 * them; the realtor marks hers done here, and the team sees it on the Salesforce record.
 * The LO and admins see them read-only. The LP's own tasks never show here.
 */
export function ContactTasks({ recordId, role }: { recordId: string; role: 'admin' | 'loan_officer' | 'agent' }) {
  const tasks = useTasks(recordId);
  const items = tasks.data?.data ?? [];

  // No section until a borrower has steps: Salesforce creates them only for borrowers
  // referred to a realtor, and none exist until the creation flow ships
  if (tasks.isSuccess && items.length === 0) return null;

  return (
    <section className="mt-6" data-testid="tasks">
      <h3 className="mb-1 text-sm font-medium text-muted-foreground">Realtor steps</h3>
      {role === 'agent' && (
        <p className="mb-2 text-xs text-muted-foreground">
          Mark each step done when it happens. The team sees it in Salesforce.
        </p>
      )}
      {tasks.isPending ? (
        <p className="text-sm text-muted-foreground">Loading steps…</p>
      ) : tasks.isError ? (
        <p className="text-sm text-destructive">Could not load steps</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card px-4">
          {items.map(t => <TaskRow key={t.id} task={t} />)}
        </ul>
      )}
    </section>
  );
}
