import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface EditableCellProps {
  value: string | number | boolean | undefined;
  rowId: string;
  field: string;
  onDirty: (rowId: string, field: string, value: unknown) => void;
}

export function EditableCell({ value, rowId, field, onDirty }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value ?? ''));

  if (!editing) {
    return (
      <span className="cursor-pointer px-1" onDoubleClick={() => setEditing(true)}>
        {String(value ?? '')}
      </span>
    );
  }

  return (
    <Input
      autoFocus
      value={localValue}
      onChange={e => setLocalValue(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (localValue !== String(value ?? '')) {
          onDirty(rowId, field, localValue);
        }
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setLocalValue(String(value ?? ''));
          setEditing(false);
        }
      }}
      className="h-7 px-1"
    />
  );
}
