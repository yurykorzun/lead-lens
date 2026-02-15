import { createColumnHelper, type CellContext, type ColumnDef } from '@tanstack/react-table';
import type { ContactRow } from '@lead-lens/shared';
import { Badge } from '@/components/ui/badge';
import { EditableCell } from './editable-cell';
import { DisplayDropdownCell } from './display-dropdown-cell';
import { DisplayCheckboxCell } from './display-checkbox-cell';
import type { ReactNode } from 'react';

const columnHelper = createColumnHelper<ContactRow>();

type OnDirty = (rowId: string, field: string, value: unknown) => void;
type DropdownOptions = Array<{ value: string; label: string }>;
type MetaData = {
  onDirty: OnDirty;
  dropdowns: Record<string, DropdownOptions>;
};

function getRowMeta(ctx: CellContext<ContactRow, unknown>): MetaData {
  return ctx.table.options.meta as MetaData;
}

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
};

function badgeRenderer(colorMap: Record<string, string>) {
  return (value: string): ReactNode => {
    const colors = colorMap[value] || 'bg-gray-100 text-gray-700 border-gray-200';
    return <Badge variant="outline" className={colors}>{value}</Badge>;
  };
}

function editableText(field: string) {
  return (ctx: CellContext<ContactRow, unknown>) => {
    const { onDirty } = getRowMeta(ctx);
    return (
      <EditableCell
        value={ctx.getValue() as string | undefined}
        rowId={ctx.row.original.id}
        field={field}
        onDirty={onDirty}
      />
    );
  };
}

function editableDropdown(
  field: string,
  sfFieldName: string,
  renderDisplay?: (value: string) => ReactNode,
) {
  return (ctx: CellContext<ContactRow, unknown>) => {
    const { onDirty, dropdowns } = getRowMeta(ctx);
    const options = dropdowns[sfFieldName] || [];
    return (
      <DisplayDropdownCell
        value={ctx.getValue() as string | undefined}
        options={options}
        rowId={ctx.row.original.id}
        field={field}
        onDirty={onDirty}
        renderDisplay={renderDisplay}
      />
    );
  };
}

function editableCheckbox(field: string) {
  return (ctx: CellContext<ContactRow, unknown>) => {
    const { onDirty } = getRowMeta(ctx);
    return (
      <DisplayCheckboxCell
        value={ctx.getValue() as boolean | undefined}
        rowId={ctx.row.original.id}
        field={field}
        onDirty={onDirty}
      />
    );
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
    cell: editableDropdown('status', 'Status__c', badgeRenderer(STATUS_COLORS)),
  }),
  columnHelper.accessor('temperature', {
    header: 'Temperature',
    cell: editableDropdown('temperature', 'Temparture__c', badgeRenderer(TEMP_COLORS)),
  }),
  columnHelper.accessor('noOfCalls', {
    header: '# Calls',
    cell: editableDropdown('noOfCalls', 'No_of_Calls__c'),
  }),
  columnHelper.accessor('message', {
    header: 'Message',
    cell: editableText('message'),
  }),
  columnHelper.accessor('hotLead', {
    header: 'Hot Lead',
    cell: editableCheckbox('hotLead'),
  }),
  columnHelper.accessor('paal', {
    header: 'PAAL',
    cell: editableCheckbox('paal'),
  }),
  columnHelper.accessor('inProcess', {
    header: 'In Process',
    cell: editableCheckbox('inProcess'),
  }),
  columnHelper.accessor('stage', {
    header: 'Stage',
    cell: editableDropdown('stage', 'MtgPlanner_CRM__Stage__c', badgeRenderer(STAGE_COLORS)),
  }),
  columnHelper.accessor('thankYouToReferralSource', {
    header: 'Thank You',
    cell: editableCheckbox('thankYouToReferralSource'),
  }),
  columnHelper.accessor('leadSource', {
    header: 'Lead Source',
    cell: editableDropdown('leadSource', 'LeadSource'),
  }),
  columnHelper.accessor('bdr', {
    header: 'BDR',
    cell: editableDropdown('bdr', 'BDR__c'),
  }),
  columnHelper.accessor('loanPartner', {
    header: 'Loan Partner',
    cell: editableDropdown('loanPartner', 'Loan_Partners__c'),
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
  columnHelper.accessor('email', {
    header: 'Email',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('phone', {
    header: 'Phone',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('stage', {
    header: 'Stage',
    cell: editableDropdown('stage', 'MtgPlanner_CRM__Stage__c', badgeRenderer(STAGE_COLORS)),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: editableDropdown('status', 'Status__c', badgeRenderer(STATUS_COLORS)),
  }),
  columnHelper.accessor('temperature', {
    header: 'Temperature',
    cell: editableDropdown('temperature', 'Temparture__c', badgeRenderer(TEMP_COLORS)),
  }),
  columnHelper.accessor('createdDate', {
    header: 'Created',
    cell: info => {
      const val = info.getValue();
      return val ? new Date(val).toLocaleDateString() : '';
    },
  }),
];
