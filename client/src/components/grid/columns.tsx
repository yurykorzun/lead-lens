import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import type { ContactRow } from '@lead-lens/shared';
import { Badge } from '@/components/ui/badge';

const columnHelper = createColumnHelper<ContactRow>();

// Semantic status colors (from design system)
const STATUS_COLORS: Record<string, string> = {
  'Meeting Set': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Contacted': 'bg-blue-50 text-blue-700 border-blue-200',
  'Not Contacted': 'bg-slate-100 text-slate-600 border-slate-200',
  'Nurture': 'bg-teal-50 text-teal-700 border-teal-200',
};

// Semantic stage colors
const STAGE_COLORS: Record<string, string> = {
  'Lead': 'bg-blue-50 text-blue-700 border-blue-200',
  'Application': 'bg-amber-50 text-amber-700 border-amber-200',
  'In Process': 'bg-violet-50 text-violet-700 border-violet-200',
  'Meeting Set': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Denied': 'bg-rose-50 text-rose-700 border-rose-200',
  'Dead Deal': 'bg-slate-100 text-slate-500 border-slate-200',
};

// Temperature: dot color + short label
const TEMP_MAP: Record<string, { dot: string; label: string }> = {
  'Hot': { dot: 'bg-red-500', label: 'Hot' },
  '30 days or less': { dot: 'bg-amber-500', label: 'Warm' },
  '30-60 days': { dot: 'bg-sky-400', label: 'Cool' },
  '60 days or longer': { dot: 'bg-slate-400', label: 'Cold' },
  'Need more follow ups': { dot: 'bg-amber-500', label: 'Follow Up' },
};

function toTitleCase(name: string): string {
  return name.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function badgeCell(colorMap: Record<string, string>) {
  return (info: { getValue: () => unknown }) => {
    const val = info.getValue() as string | undefined;
    if (!val) return null;
    const colors = colorMap[val] || 'bg-slate-100 text-slate-600 border-slate-200';
    return <Badge variant="outline" className={colors}>{val}</Badge>;
  };
}

function phoneCell(info: { getValue: () => unknown; row: { original: ContactRow } }) {
  const phone = info.getValue() as string | undefined;
  const mobile = info.row.original.mobilePhone;
  if (!phone && !mobile) return null;
  if (phone && mobile && phone !== mobile) {
    return (
      <div>
        <div>{phone}</div>
        <div className="text-xs text-slate-500">{mobile}</div>
      </div>
    );
  }
  return phone || mobile;
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
  columnHelper.accessor('phone', {
    header: 'Phone',
    cell: phoneCell,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: badgeCell(STATUS_COLORS),
  }),
  columnHelper.accessor('temperature', {
    header: 'Temp',
    cell: temperatureCell,
  }),
  columnHelper.accessor('stage', {
    header: 'Stage',
    cell: badgeCell(STAGE_COLORS),
  }),
  columnHelper.accessor('leadSource', {
    header: 'Lead Source',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('ownerName', {
    header: 'Owner',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('createdDate', {
    header: 'Created',
    cell: info => {
      const val = info.getValue();
      return val ? new Date(val).toLocaleDateString() : '';
    },
  }),
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const loanOfficerColumns: ColumnDef<ContactRow, any>[] = [
  columnHelper.accessor('name', {
    id: 'name',
    header: 'Name',
    cell: info => {
      const name = info.getValue();
      return <span className="font-medium">{name ? toTitleCase(name) : ''}</span>;
    },
  }),
  columnHelper.accessor('phone', {
    header: 'Phone',
    cell: phoneCell,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: badgeCell(STATUS_COLORS),
  }),
  columnHelper.accessor('temperature', {
    header: 'Temp',
    cell: temperatureCell,
  }),
  columnHelper.accessor('stage', {
    header: 'Stage',
    cell: badgeCell(STAGE_COLORS),
  }),
  columnHelper.accessor('createdDate', {
    header: 'Created',
    cell: info => {
      const val = info.getValue();
      return val ? new Date(val).toLocaleDateString() : '';
    },
  }),
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const agentColumns: ColumnDef<ContactRow, any>[] = [
  columnHelper.accessor('name', {
    id: 'name',
    header: 'Name',
    cell: info => {
      const name = info.getValue();
      return <span className="font-medium">{name ? toTitleCase(name) : ''}</span>;
    },
  }),
  columnHelper.accessor('phone', {
    header: 'Phone',
    cell: phoneCell,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: badgeCell(STATUS_COLORS),
  }),
  columnHelper.accessor('temperature', {
    header: 'Temp',
    cell: temperatureCell,
  }),
  columnHelper.accessor('stage', {
    header: 'Stage',
    cell: badgeCell(STAGE_COLORS),
  }),
  columnHelper.accessor('leadSource', {
    header: 'Lead Source',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('referredByText', {
    header: 'Referred By',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('createdDate', {
    header: 'Created',
    cell: info => {
      const val = info.getValue();
      return val ? new Date(val).toLocaleDateString() : '';
    },
  }),
];
