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
  isLoading?: boolean;
}

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <tr key={i} className={cn('border-b', i % 2 === 1 && 'bg-slate-50/50')}>
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="px-3 py-3">
              <div className="h-4 animate-pulse rounded bg-slate-200" style={{ width: `${50 + Math.random() * 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ContactGrid({ data, columns, onRowClick, selectedId, className, isLoading }: ContactGridProps) {
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
    <div className={cn('overflow-auto rounded-md border border-slate-200', className)}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-30">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50">
              {headerGroup.headers.map(header => {
                const isPinned = header.column.getIsPinned();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      'whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600',
                      isPinned && 'sticky left-0 z-40 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]',
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
          {isLoading ? (
            <SkeletonRows columns={columns.length} />
          ) : table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-12 text-center">
                <p className="text-sm text-slate-500">No contacts match your filters.</p>
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
                    'group cursor-pointer border-b border-slate-100 transition-colors',
                    isSelected
                      ? 'bg-blue-50/80'
                      : isOdd
                        ? 'bg-slate-50/50 hover:bg-blue-50/50'
                        : 'hover:bg-blue-50/50',
                  )}
                >
                  {row.getVisibleCells().map(cell => {
                    const isPinned = cell.column.getIsPinned();
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-3 py-2.5',
                          isPinned && cn(
                            'sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] transition-colors',
                            isSelected
                              ? 'bg-blue-50/80'
                              : isOdd
                                ? 'bg-slate-50/50 group-hover:bg-blue-50/50'
                                : 'bg-white group-hover:bg-blue-50/50',
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
