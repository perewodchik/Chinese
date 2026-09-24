import { useMemo } from 'react';
import { collectedItems } from '../../domain/sweep';
import { wordKnowledge, type WordKnowledge } from '../../domain/words';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';

/** Where you stand with every word, worked out once per change to what you know. */
export function useWordKnowledge(): WordKnowledge {
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const collections = useStore((s) => s.collections);
  return useMemo(
    () => wordKnowledge(lib, recall, collectedItems(collections)),
    [lib, recall, collections],
  );
}
