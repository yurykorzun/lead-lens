import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import type { ContactRow } from '@lead-lens/shared';
import { Empty, StatusBadge, StageBadge, Temperature } from './cells';
import { toTitleCase, formatDay, formatPhone } from './format';

const columnHelper = createColumnHelper<ContactRow>();

const textCell = (info: { getValue: () => unknown }) => (info.getValue() as string | undefined) || <Empty />;

const nameColumn = columnHelper.accessor('name', {
  id: 'name',
  header: 'Name',
  cell: info => {
    const name = info.getValue();
    const email = info.row.original.email;
    return (
      <div>
        <span className="font-medium">{name ? toTitleCase(name) : ''}</span>
        {email && <p className="text-xs text-muted-foreground">{email}</p>}
      </div>
    );
  },
});
const phoneColumn = columnHelper.accessor('phone', { header: 'Phone', cell: info => formatPhone(info.getValue()) || <Empty /> });
const statusColumn = columnHelper.accessor('status', { header: 'Status', cell: info => <StatusBadge value={info.getValue()} /> });
const tempColumn = columnHelper.accessor('temperature', { header: 'Temp', cell: info => <Temperature value={info.getValue()} /> });
const stageColumn = columnHelper.accessor('stage', { header: 'Loan Stage', cell: info => <StageBadge value={info.getValue()} /> });
const sourceColumn = columnHelper.accessor('leadSource', { header: 'Lead Source', cell: textCell });
const referredByColumn = columnHelper.accessor('referredBy', { header: 'Referred By', cell: textCell });
const createdColumn = columnHelper.accessor('createdDate', { header: 'Created', cell: info => formatDay(info.getValue()) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adminColumns: ColumnDef<ContactRow, any>[] = [
  nameColumn,
  phoneColumn,
  statusColumn,
  tempColumn,
  stageColumn,
  sourceColumn,
  referredByColumn,
  columnHelper.accessor('ownerName', { header: 'Owner', cell: textCell }),
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
