import { createColumnHelper, type CellContext } from '@tanstack/react-table';
import type { ContactRow } from '@lead-lens/shared';
import { EditableCell } from './editable-cell';

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

function editableDropdown(field: string, sfFieldName: string) {
  return (ctx: CellContext<ContactRow, unknown>) => {
    const { onDirty, dropdowns } = getRowMeta(ctx);
    const options = dropdowns[sfFieldName] || [];
    const value = String(ctx.getValue() ?? '');
    return (
      <select
        value={value}
        onChange={(e) => {
          onDirty(ctx.row.original.id, field, e.target.value || null);
        }}
        className="h-7 w-full rounded border border-input bg-transparent px-1 text-sm"
      >
        <option value="">--</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  };
}

function editableCheckbox(field: string) {
  return (ctx: CellContext<ContactRow, unknown>) => {
    const { onDirty } = getRowMeta(ctx);
    const value = (ctx.getValue() ?? false) as boolean;
    return (
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => {
          onDirty(ctx.row.original.id, field, e.target.checked);
        }}
        className="h-4 w-4 rounded border-gray-300"
      />
    );
  };
}

export const columns = [
  columnHelper.accessor('name', {
    header: 'Name',
    cell: info => info.getValue(),
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
    cell: editableDropdown('status', 'Status__c'),
  }),
  columnHelper.accessor('temperature', {
    header: 'Temperature',
    cell: editableDropdown('temperature', 'Temparture__c'),
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
    cell: editableDropdown('stage', 'MtgPlanner_CRM__Stage__c'),
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
