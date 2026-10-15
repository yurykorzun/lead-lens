import { CLIENT_STATUS } from '@lead-lens/shared';
import { Badge } from '@/components/ui/badge';

// One tone per meaning, each with its dark-theme pair. Written out in full because
// Tailwind only generates classes it can see as literal strings.
const TONES = {
  neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/70 dark:text-zinc-300 dark:border-zinc-700',
  blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900',
  amber: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
  violet: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900',
  teal: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-900',
  rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900',
} as const;

// Every lgc-ci Lead Status (GROUP BY Status, 2026-10-15; the tracker mirror's Status__c holds
// the same values), plus Client. One tone per step: gray not yet worked or filed away, blue
// being contacted, amber engaged, violet pre-approved, teal parked, green client, rose
// unqualified. A value missing here shows gray - re-run the query when one is added.
const STATUS_COLORS: Record<string, string> = {
  'Open': TONES.neutral,
  'Open - Not Contacted': TONES.neutral,
  'Contacting': TONES.blue,
  'Meeting Set': TONES.amber,
  'Qualified': TONES.amber,
  'Pre-Approved': TONES.violet,
  'Preapproved - 6 Months & Older': TONES.violet,
  'Nurture': TONES.teal,
  'Unqualified': TONES.rose,
  'Closed': TONES.neutral,
  'Duplicate': TONES.neutral,
  'Not a lead': TONES.neutral,
  [CLIENT_STATUS]: TONES.green,
};

// Every lgc-ci loan stage (GROUP BY StageName, 2026-10-15; client rows with no loan show the
// mirror's Status__c, which holds the same names): blue applied, amber getting approved, violet
// in the deal up to Clear to Close, green finished (closed, funded or sold), rose lost
const STAGE_COLORS: Record<string, string> = {
  'Application': TONES.blue,
  'Pre-approval': TONES.amber,
  'Documents Gathering': TONES.amber,
  'Pre-Approved / Nurture': TONES.teal,
  'Under Contract': TONES.violet,
  'Processing': TONES.violet,
  'Underwriting': TONES.violet,
  'Conditional Loan Approval': TONES.violet,
  'Clear to Close': TONES.violet,
  'Close': TONES.green,
  'Funded': TONES.green,
  'Sold / Funds Received': TONES.green,
  'Closed Won': TONES.green,
  'Closed Lost': TONES.rose,
  'Dead Deal': TONES.rose,
};

// Temperature: dot color + short label - lgc-ci values. The label carries the meaning,
// the dot only repeats it.
const TEMP_MAP: Record<string, { dot: string; label: string }> = {
  '60 days or less': { dot: 'bg-amber-500', label: '60 days or less' },
  'Need more follow ups': { dot: 'bg-sky-400', label: 'Follow Up' },
  '60 days or longer': { dot: 'bg-zinc-400', label: '60+ days' },
  'Dead deal': { dot: 'bg-zinc-300 dark:bg-zinc-600', label: 'Dead' },
  'Management - Please Review': { dot: 'bg-rose-500', label: 'Review' },
};

// A muted dash, so an empty cell reads as "nothing here" and not as still loading.
// Screen readers get the word: an aria-label on a plain span is not read out.
export function Empty() {
  return (
    <>
      <span aria-hidden="true" className="text-muted-foreground/60">-</span>
      <span className="sr-only">None</span>
    </>
  );
}

function ToneBadge({ value, colors }: { value?: string; colors: Record<string, string> }) {
  if (!value) return <Empty />;
  return <Badge variant="outline" className={`whitespace-nowrap ${colors[value] || TONES.neutral}`}>{value}</Badge>;
}

export function StatusBadge({ value }: { value?: string }) {
  return <ToneBadge value={value} colors={STATUS_COLORS} />;
}

export function StageBadge({ value }: { value?: string }) {
  return <ToneBadge value={value} colors={STAGE_COLORS} />;
}

export function Temperature({ value }: { value?: string }) {
  if (!value) return <Empty />;
  const temp = TEMP_MAP[value] || { dot: 'bg-zinc-300 dark:bg-zinc-600', label: value };
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
      <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${temp.dot}`} />
      <span>{temp.label}</span>
    </span>
  );
}
