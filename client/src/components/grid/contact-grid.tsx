import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import { Phone, Mail } from 'lucide-react';
import type { ContactRow } from '@lead-lens/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { StatusBadge, StageBadge, Temperature } from './cells';
import { toTitleCase, formatDay, formatPhone } from './format';

interface ContactGridProps {
  data: ContactRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<ContactRow, any>[];
  onRowClick?: (contact: ContactRow) => void;
  selectedId?: string;
  className?: string;
  isLoading?: boolean;
  /** Shown in the empty state when filters are narrowing the list */
  onClearFilters?: () => void;
}

// Fixed widths, so the skeleton doesn't jump on every render
const SKELETON_WIDTHS = ['72%', '55%', '64%', '80%', '58%', '68%', '50%', '76%', '62%', '70%'];

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <tr key={i} className={cn('border-b', i % 2 === 1 && 'bg-row-alt')}>
          {Array.from({ length: columns + 1 }).map((_, j) => (
            <td key={j} className="px-3 py-3">
              <div className="h-4 animate-pulse rounded bg-muted motion-reduce:animate-none" style={{ width: SKELETON_WIDTHS[(i + j) % SKELETON_WIDTHS.length] }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// Always visible, not only on hover: a phone has no hover and a keyboard user never sees it
function InlineActions({ contact }: { contact: ContactRow }) {
  const phone = contact.phone;
  const email = contact.email;
  const link = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="flex items-center justify-end gap-0.5">
      {phone && (
        <a href={`tel:${phone}`} onClick={e => e.stopPropagation()} className={link} aria-label={`Call ${contact.name || formatPhone(phone)}`} title={`Call ${formatPhone(phone)}`}>
          <Phone className="h-4 w-4" />
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} onClick={e => e.stopPropagation()} className={link} aria-label={`Email ${contact.name || email}`} title={`Email ${email}`}>
          <Mail className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

export function ContactGrid({ data, columns, onRowClick, selectedId, className, isLoading, onClearFilters }: ContactGridProps) {
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table is not React Compiler compatible yet
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnPinning: { left: ['name'] },
    },
  });

  // One background per row state, shared by the row and its pinned cell (which must be opaque)
  const rowBg = (isSelected: boolean, isOdd: boolean, hover: string) =>
    isSelected ? 'bg-row-selected' : cn(isOdd ? 'bg-row-alt' : 'bg-background', hover);

  const rows = table.getRowModel().rows;
  // One layout in the page at a time, so each name exists once (screen readers, tests)
  const isPhone = useMediaQuery('(max-width: 639px)');
  const empty = (
    <>
      <p className="text-sm text-muted-foreground">No contacts match your filters.</p>
      {onClearFilters && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </>
  );

  // A shadow on the right edge while columns are hidden off to the side; without it the
  // table looked complete at tablet width and Lead Source, Owner and Created went unseen.
  // Holds the vertical scrollbar's width (the shadow sits beside it), or null for no shadow.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = useState<number | null>(null);
  const measureOverflow = useCallback(() => {
    const el = scrollRef.current;
    const hidden = el ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : false;
    setMoreRight(hidden && el ? el.offsetWidth - el.clientWidth : null);
  }, []);
  useLayoutEffect(() => {
    measureOverflow();
    const el = scrollRef.current;
    if (!el) return;
    // The table too: a late web font or longer names widen it without resizing the box
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measureOverflow, rows.length, columns, isPhone]);

  return (
    <div className={cn('relative isolate flex flex-col overflow-hidden rounded-md border', className)}>
    <div ref={scrollRef} onScroll={measureOverflow} className="min-h-0 overflow-auto">
      {/* Phones: one card per borrower, so status and stage are visible without scrolling sideways */}
      {isPhone ? (
      <ul aria-label="Contacts" className="divide-y">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="space-y-2 p-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            </li>
          ))
        ) : rows.length === 0 ? (
          <li className="px-3 py-12 text-center">{empty}</li>
        ) : (
          rows.map(row => {
            const c = row.original;
            const isSelected = c.id === selectedId;
            return (
              <li key={row.id} className={cn('flex items-start gap-2 p-3', isSelected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-background')}>
                <button
                  type="button"
                  onClick={() => onRowClick?.(c)}
                  aria-current={isSelected ? 'true' : undefined}
                  className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block truncate font-medium">{c.name ? toTitleCase(c.name) : 'No name'}</span>
                  {c.email && <span className="block truncate text-xs text-muted-foreground">{c.email}</span>}
                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <StatusBadge value={c.status} />
                    {c.stage && <StageBadge value={c.stage} />}
                    {c.temperature && <Temperature value={c.temperature} />}
                    {c.createdDate && <span className="text-xs text-muted-foreground">{formatDay(c.createdDate)}</span>}
                  </span>
                </button>
                <InlineActions contact={c} />
              </li>
            );
          })
        )}
      </ul>
      ) : (
      <table className="w-full text-sm tabular-nums">
        <thead className="sticky top-0 z-30">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="border-b bg-muted">
              {headerGroup.headers.map(header => {
                const isPinned = header.column.getIsPinned();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    className={cn(
                      'whitespace-nowrap bg-muted px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                      isPinned && 'sticky left-0 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]',
                    )}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              })}
              <th className="w-20 bg-muted px-2 py-2.5"><span className="sr-only">Contact</span></th>
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading ? (
            <SkeletonRows columns={columns.length} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="px-3 py-12 text-center">{empty}</td>
            </tr>
          ) : (
            rows.map(row => {
              const isSelected = row.original.id === selectedId;
              const isOdd = row.index % 2 === 1;
              const open = () => onRowClick?.(row.original);

              return (
                <tr
                  key={row.id}
                  onClick={open}
                  onKeyDown={e => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
                  }}
                  tabIndex={0}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'group cursor-pointer border-b transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    rowBg(isSelected, isOdd, 'hover:bg-row-hover'),
                  )}
                >
                  {row.getVisibleCells().map(cell => {
                    const isPinned = cell.column.getIsPinned();
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'whitespace-nowrap px-3 py-2.5',
                          isPinned && cn(
                            'sticky left-0 z-10 transition-colors',
                            isSelected
                              ? 'shadow-[inset_3px_0_0_var(--color-primary),2px_0_5px_-2px_rgba(0,0,0,0.08)]'
                              : 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]',
                            rowBg(isSelected, isOdd, 'group-hover:bg-row-hover'),
                          ),
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5">
                    <InlineActions contact={row.original} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      )}
    </div>
      {/* A shadow, not a fade to the page color, so it reads the same on striped and selected rows */}
      {moreRight !== null && (
        <div aria-hidden="true" style={{ right: moreRight }} className="pointer-events-none absolute inset-y-0 z-40 w-6 bg-gradient-to-l from-black/10 to-transparent dark:from-white/10" />
      )}
    </div>
  );
}
