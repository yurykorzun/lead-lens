import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import type { ContactRow } from '@lead-lens/shared';

interface ContactGridProps {
  data: ContactRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<ContactRow, any>[];
  onDirty: (rowId: string, field: string, value: unknown) => void;
  dropdowns: Record<string, Array<{ value: string; label: string }>>;
}

export function ContactGrid({ data, columns, onDirty, dropdowns }: ContactGridProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: { onDirty, dropdowns },
  });

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="border-b bg-muted/50">
              {headerGroup.headers.map(header => (
                <th key={header.id} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                No contacts found.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map(row => (
              <tr key={row.id} className="border-b hover:bg-muted/30">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
