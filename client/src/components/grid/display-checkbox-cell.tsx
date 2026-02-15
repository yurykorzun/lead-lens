import { Checkbox } from '@/components/ui/checkbox';

interface DisplayCheckboxCellProps {
  value: boolean | undefined;
  rowId: string;
  field: string;
  onDirty: (rowId: string, field: string, value: unknown) => void;
}

export function DisplayCheckboxCell({
  value,
  rowId,
  field,
  onDirty,
}: DisplayCheckboxCellProps) {
  return (
    <div className="flex items-center justify-center">
      <Checkbox
        checked={value ?? false}
        onCheckedChange={(checked) => {
          onDirty(rowId, field, Boolean(checked));
        }}
        className={value ? '' : 'opacity-40 hover:opacity-100'}
      />
    </div>
  );
}
