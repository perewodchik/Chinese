import { useMemo } from 'react';
import { reviewPool, summarise } from '../../domain/drill';
import { SKILLS } from '../../domain/memory';
import { summariseWords } from '../../domain/wordReview';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';

/** What Review would ask about right now, for the count on its tab: characters and words. */
export function useDueCount(): number {
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const collections = useStore((s) => s.collections);
  const perDay = useStore((s) => s.settings.newWordsPerDay);
  return useMemo(() => {
    const now = Date.now();
    const pool = reviewPool(lib, recall);
    const counts = summarise(recall, pool, SKILLS, now);
    const chars = SKILLS.reduce((n, s) => n + counts[s].due, 0);
    return chars + summariseWords(recall, collections, perDay, now).due;
  }, [lib, recall, collections, perDay]);
}
