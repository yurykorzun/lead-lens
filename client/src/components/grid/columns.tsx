import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { CLIENT_STATUS, type ContactRow } from '@lead-lens/shared';
import { Badge } from '@/components/ui/badge';

const columnHelper = createColumnHelper<ContactRow>();

// Semantic status colors (from design system) - lgc-ci Lead statuses, plus Client
const STATUS_COLORS: Record<string, string> = {
  'Open': 'bg-slate-100 text-slate-600 border-slate-200',
  'Contacting': 'bg-blue-50 text-blue-700 border-blue-200',
  'Meeting Set': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Pre-qualified': 'bg-amber-50 text-amber-700 border-amber-200',
  'Pre-Approved': 'bg-violet-50 text-violet-700 border-violet-200',
  'Nurture': 'bg-teal-50 text-teal-700 border-teal-200',
  [CLIENT_STATUS]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// Semantic stage colors - lgc-ci loan stages
const STAGE_COLORS: Record<string, string> = {
  'Application': 'bg-blue-50 text-blue-700 border-blue-200',
  'Pre-approval': 'bg-amber-50 text-amber-700 border-amber-200',
  'Pre-Approved / Nurture': 'bg-teal-50 text-teal-700 border-teal-200',
  'Under Contract': 'bg-violet-50 text-violet-700 border-violet-200',
  'Processing': 'bg-violet-50 text-violet-700 border-violet-200',
  'Underwriting': 'bg-violet-50 text-violet-700 border-violet-200',
  'Conditional Loan Approval': 'bg-violet-50 text-violet-700 border-violet-200',
  'Clear to Close': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Funded': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Closed Won': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Closed Lost': 'bg-rose-50 text-rose-700 border-rose-200',
};

// Temperature: dot color + short label - lgc-ci values
const TEMP_MAP: Record<string, { dot: string; label: string }> = {
  '60 days or less': { dot: 'bg-amber-500', label: '60 days or less' },
  'Need more follow ups': { dot: 'bg-sky-400', label: 'Follow Up' },
  '60 days or longer': { dot: 'bg-slate-400', label: '60+ days' },
  'Dead deal': { dot: 'bg-slate-300', label: 'Dead' },
  'Management - Please Review': { dot: 'bg-rose-500', label: 'Review' },
};

function toTitleCase(name: string): string {
  return name.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// createdDate is a plain YYYY-MM-DD. new Date() would read it as UTC midnight and show
// the day before for every US user.
export function formatDay(val?: string): string {
  if (!val) return '';
  const [y, m, d] = val.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}

function badgeCell(colorMap: Record<string, string>) {
  return (info: { getValue: () => unknown }) => {
    const val = info.getValue() as string | undefined;
    if (!val) return null;
    const colors = colorMap[val] || 'bg-slate-100 text-slate-600 border-slate-200';
    return <Badge variant="outline" className={colors}>{val}</Badge>;
  };
}

function temperatureCell(info: { getValue: () => unknown }) {
  const val = info.getValue() as string | undefined;
  if (!val) return null;
  const temp = TEMP_MAP[val] || { dot: 'bg-slate-300', label: val };
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${temp.dot}`} />
      <span className="text-slate-700">{temp.label}</span>
    </span>
  );
}

const nameColumn = columnHelper.accessor('name', {
  id: 'name',
  header: 'Name',
  cell: info => {
    const name = info.getValue();
    return <span className="font-medium">{name ? toTitleCase(name) : ''}</span>;
  },
});
const phoneColumn = columnHelper.accessor('phone', { header: 'Phone', cell: info => info.getValue() });
const statusColumn = columnHelper.accessor('status', { header: 'Status', cell: badgeCell(STATUS_COLORS) });
const tempColumn = columnHelper.accessor('temperature', { header: 'Temp', cell: temperatureCell });
const stageColumn = columnHelper.accessor('stage', { header: 'Loan Stage', cell: badgeCell(STAGE_COLORS) });
const sourceColumn = columnHelper.accessor('leadSource', { header: 'Lead Source', cell: info => info.getValue() });
const referredByColumn = columnHelper.accessor('referredBy', { header: 'Referred By', cell: info => info.getValue() });
const createdColumn = columnHelper.accessor('createdDate', { header: 'Created', cell: info => formatDay(info.getValue()) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adminColumns: ColumnDef<ContactRow, any>[] = [
  columnHelper.accessor('name', {
    id: 'name',
    header: 'Name',
    cell: info => {
      const name = info.getValue();
      const email = info.row.original.email;
      return (
        <div>
          <span className="font-medium">{name ? toTitleCase(name) : ''}</span>
          {email && <p className="text-xs text-slate-500">{email}</p>}
        </div>
      );
    },
  }),
  phoneColumn,
  statusColumn,
  tempColumn,
  stageColumn,
  sourceColumn,
  referredByColumn,
  columnHelper.accessor('ownerName', { header: 'Owner', cell: info => info.getValue() }),
  createdColumn,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const loanOfficerColumns: ColumnDef<ContactRow, any>[] = [
  nameColumn,
  phoneColumn,
  statusColumn,
  tempColumn,
  stageColumn,
  referredByColumn,
  createdColumn,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const agentColumns: ColumnDef<ContactRow, any>[] = [
  nameColumn,
  phoneColumn,
  statusColumn,
  tempColumn,
  stageColumn,
  sourceColumn,
  referredByColumn,
  createdColumn,
];
