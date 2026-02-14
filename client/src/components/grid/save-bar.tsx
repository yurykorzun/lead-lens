import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

interface SaveBarProps {
  dirtyCount: number;
  onSave: () => void;
  saving?: boolean;
}

export function SaveBar({ dirtyCount, onSave, saving }: SaveBarProps) {
  if (dirtyCount === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <span className="text-sm font-medium">
        {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
      </span>
      <Button size="sm" onClick={onSave} disabled={saving}>
        <Save className="mr-1 h-4 w-4" />
        {saving ? 'Saving...' : 'Save changes'}
      </Button>
    </div>
  );
}
