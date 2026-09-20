import { useMemo } from 'react';
import { reviewPool, summarise } from '../../domain/drill';
import { SKILLS } from '../../domain/memory';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';

/** What Review would ask about right now, for the count on its tab. */
export function useDueCount(): number {
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  return useMemo(() => {
    const pool = reviewPool(lib, recall);
    const counts = summarise(recall, pool, SKILLS, Date.now());
    return SKILLS.reduce((n, s) => n + counts[s].due, 0);
  }, [lib, recall]);
}
