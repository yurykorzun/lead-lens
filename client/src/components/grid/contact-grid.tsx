import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import type { ContactRow } from '@lead-lens/shared';
import { cn } from '@/lib/utils';

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
    state: {
      columnPinning: { left: ['name'] },
    },
    meta: { onDirty, dropdowns },
  });

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="border-b bg-muted/60">
              {headerGroup.headers.map(header => {
                const isPinned = header.column.getIsPinned();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      'whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground',
                      isPinned && 'sticky left-0 z-20 bg-muted/60 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]',
                    )}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              })}
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
              <tr key={row.id} className="group border-b transition-colors hover:bg-muted/50">
                {row.getVisibleCells().map(cell => {
                  const isPinned = cell.column.getIsPinned();
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-3 py-2',
                        isPinned && 'sticky left-0 z-10 bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] group-hover:bg-muted/50',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
