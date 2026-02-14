import { useState, useCallback } from 'react';

interface DirtyCell {
  rowId: string;
  field: string;
  value: unknown;
}

export function useDirtyTracker() {
  const [dirtyMap, setDirtyMap] = useState<Map<string, DirtyCell>>(new Map());

  const markDirty = useCallback((rowId: string, field: string, value: unknown) => {
    setDirtyMap(prev => {
      const next = new Map(prev);
      next.set(`${rowId}:${field}`, { rowId, field, value });
      return next;
    });
  }, []);

  const clearDirty = useCallback(() => {
    setDirtyMap(new Map());
  }, []);

  const getDirtyUpdates = useCallback(() => {
    const grouped = new Map<string, Record<string, unknown>>();
    for (const cell of dirtyMap.values()) {
      const existing = grouped.get(cell.rowId) || {};
      existing[cell.field] = cell.value;
      grouped.set(cell.rowId, existing);
    }
    return Array.from(grouped.entries()).map(([id, fields]) => ({ id, fields }));
  }, [dirtyMap]);

  return {
    dirtyCount: dirtyMap.size,
    markDirty,
    clearDirty,
    getDirtyUpdates,
  };
}
