import { useMemo } from 'react';
import type { ItemId } from '../../domain/ids';
import { levelOf, type Level } from '../../domain/memory';
import { useStore } from '../../store/store';

/** Each item's level, 0 to 3, from review alone: worked out once per change to what is remembered. */
export function useLevelOf(): (id: ItemId) => Level {
  const recall = useStore((s) => s.recall);
  return useMemo(() => {
    const now = Date.now();
    return (id: ItemId) => levelOf(recall[id], now);
  }, [recall]);
}
