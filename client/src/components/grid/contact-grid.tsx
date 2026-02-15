import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import type { ContactRow } from '@lead-lens/shared';
import { cn } from '@/lib/utils';

interface ContactGridProps {
  data: ContactRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<ContactRow, any>[];
  onRowClick?: (contact: ContactRow) => void;
  selectedId?: string;
  className?: string;
}

export function ContactGrid({ data, columns, onRowClick, selectedId, className }: ContactGridProps) {
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table is not React Compiler compatible yet
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnPinning: { left: ['name'] },
    },
  });

  return (
    <div className={cn('overflow-auto rounded-md border', className)}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-30">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="border-b bg-muted/60">
              {headerGroup.headers.map(header => {
                const isPinned = header.column.getIsPinned();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      'whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground',
                      isPinned && 'sticky left-0 z-40 bg-muted/60 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]',
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
            table.getRowModel().rows.map(row => {
              const isSelected = row.original.id === selectedId;
              const isOdd = row.index % 2 === 1;

              return (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn(
                    'group cursor-pointer border-b transition-colors hover:bg-muted/50',
                    isSelected ? 'bg-primary/5' : isOdd && 'bg-muted/20',
                  )}
                >
                  {row.getVisibleCells().map(cell => {
                    const isPinned = cell.column.getIsPinned();
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-3 py-2',
                          isPinned && cn(
                            'sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] group-hover:bg-muted/50',
                            isSelected ? 'bg-primary/5' : isOdd ? 'bg-muted/20' : 'bg-background',
                          ),
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
