import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import type { ContactRow } from '@lead-lens/shared';
import { Badge } from '@/components/ui/badge';

const columnHelper = createColumnHelper<ContactRow>();

// Badge color maps
const STAGE_COLORS: Record<string, string> = {
  'Lead': 'bg-blue-100 text-blue-800 border-blue-200',
  'In Process': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Application': 'bg-amber-100 text-amber-800 border-amber-200',
  'Meeting Set': 'bg-green-100 text-green-800 border-green-200',
  'LP Leon Lead-Purchase Drips': 'bg-purple-100 text-purple-800 border-purple-200',
};

const TEMP_COLORS: Record<string, string> = {
  '60 days or longer': 'bg-blue-100 text-blue-800 border-blue-200',
  '30-60 days': 'bg-sky-100 text-sky-800 border-sky-200',
  '30 days or less': 'bg-orange-100 text-orange-800 border-orange-200',
  'Hot': 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_COLORS: Record<string, string> = {
  'Meeting Set': 'bg-green-100 text-green-800 border-green-200',
  'Contacted': 'bg-blue-100 text-blue-800 border-blue-200',
  'Not Contacted': 'bg-gray-100 text-gray-600 border-gray-200',
  'Nurture': 'bg-teal-100 text-teal-800 border-teal-200',
};

function badgeCell(colorMap: Record<string, string>) {
  return (info: { getValue: () => unknown }) => {
    const val = info.getValue() as string | undefined;
    if (!val) return null;
    const colors = colorMap[val] || 'bg-gray-100 text-gray-700 border-gray-200';
    return <Badge variant="outline" className={colors}>{val}</Badge>;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adminColumns: ColumnDef<ContactRow, any>[] = [
  columnHelper.accessor('name', {
    id: 'name',
    header: 'Name',
    cell: info => <span className="font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('email', {
    header: 'Email',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('phone', {
    header: 'Phone',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: badgeCell(STATUS_COLORS),
  }),
  columnHelper.accessor('temperature', {
    header: 'Temperature',
    cell: badgeCell(TEMP_COLORS),
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
    cell: info => <span className="font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('phone', {
    header: 'Phone',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: badgeCell(STATUS_COLORS),
  }),
  columnHelper.accessor('temperature', {
    header: 'Temperature',
    cell: badgeCell(TEMP_COLORS),
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
