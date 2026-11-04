import { useMemo } from 'react';
import { charId, type ItemId } from '../../domain/ids';
import { levelOf, type Level } from '../../domain/memory';
import { isHanzi } from '../../domain/text';
import { itemForToken } from '../../domain/words';
import { useStore } from '../../store/store';
import { useWordKnowledge } from '../words/useWordKnowledge';
import { useLibrary } from './library';

/** Each item's level, 0 to 3, from review alone: worked out once per change to what is remembered. */
export function useLevelOf(): (id: ItemId) => Level {
  const recall = useStore((s) => s.recall);
  return useMemo(() => {
    const now = Date.now();
    return (id: ItemId) => levelOf(recall[id], now);
  }, [recall]);
}

/**
 * A word's level, 0 to 3: its own, from review, when review has asked about
 * it; otherwise that of its weakest character — a word never asked about is
 * known as far as its characters are.
 */
export function useWordLevel(): (word: string) => Level {
  const lib = useLibrary();
  const known = useWordKnowledge();
  const levelOfId = useLevelOf();
  const recall = useStore((s) => s.recall);
  return useMemo(
    () => (word: string) => {
      const chars = [...word].filter(isHanzi);
      if (!chars.length) return 3;
      const id = itemForToken(lib, word);
      if (recall[id] && Object.keys(recall[id]!).length) return known.level(word);
      return Math.min(...chars.map((c) => levelOfId(charId(c)))) as Level;
    },
    [lib, known, levelOfId, recall],
  );
}
