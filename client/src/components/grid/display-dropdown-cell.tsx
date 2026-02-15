import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface DisplayDropdownCellProps {
  value: string | undefined | null;
  options: Array<{ value: string; label: string }>;
  rowId: string;
  field: string;
  onDirty: (rowId: string, field: string, value: unknown) => void;
  renderDisplay?: (value: string) => ReactNode;
}

export function DisplayDropdownCell({
  value,
  options,
  rowId,
  field,
  onDirty,
  renderDisplay,
}: DisplayDropdownCellProps) {
  const [editing, setEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [editing]);

  if (!editing) {
    const displayValue = value || '';
    return (
      <span
        className="group/cell flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:bg-muted"
        onClick={() => setEditing(true)}
      >
        {displayValue ? (
          renderDisplay ? renderDisplay(displayValue) : <span>{displayValue}</span>
        ) : (
          <span className="text-muted-foreground/0 group-hover/cell:text-muted-foreground/50">
            &mdash;
          </span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover/cell:text-muted-foreground/50" />
      </span>
    );
  }

  return (
    <select
      ref={selectRef}
      value={String(value ?? '')}
      onChange={(e) => {
        onDirty(rowId, field, e.target.value || null);
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setEditing(false);
      }}
      className="h-7 w-full rounded border border-input bg-background px-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value=""></option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
