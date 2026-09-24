import type { Library, SyllabusWord } from '../data/types';
import { charId, wordId, type ItemId } from './ids';
import { isDue, isLearned, type RecallBook } from './memory';
import { wordIndex } from './vocab';

/**
 * What the app knows about a word, and what you know of it.
 *
 * The syllabus words carry the reading and the sense their band means. A word
 * off the lists — a compound a passage used, a name — may still be one the
 * characters' own entries mention, with CC-CEDICT's first reading; that is
 * better than nothing on a card, and it is marked as off the syllabus.
 */

export interface WordInfo extends SyllabusWord {
  /** on the 2026 lists, rather than found among the characters' words */
  listed: boolean;
}

export function wordInfo(lib: Library, w: string): WordInfo | null {
  const listed = lib.byWord.get(w);
  if (listed) return { ...listed, listed: true };
  const found = wordIndex(lib).get(w);
  if (found) return { w, py: found.p, d: found.d, hsk: found.hsk ?? 0, listed: false };
  return null;
}

/**
 * Where you stand with a word.
 *
 * `known` is what review has let stand — the same line a character crosses to
 * count as learned. `learning` is anything short of that you have started on:
 * a word you were not sure of, one failed back, one sitting in a collection.
 * Everything else is `new`.
 */
export type WordStatus = 'known' | 'learning' | 'new';

export interface WordKnowledge {
  status(w: string): WordStatus;
  /** false until anything at all is known about any word — before the sweep */
  any: boolean;
}

export function wordKnowledge(
  lib: Library,
  recall: RecallBook,
  collected: ReadonlySet<ItemId>,
): WordKnowledge {
  let any = false;
  for (const id in recall) {
    if (id.startsWith('w')) {
      any = true;
      break;
    }
  }
  if (!any) for (const id of collected) if (id.startsWith('w')) (any = true);

  return {
    any,
    status(w) {
      const id = wordId(w);
      const book = recall[id];
      if (book && Object.keys(book).length) return isLearned(book) ? 'known' : 'learning';
      if (collected.has(id)) return 'learning';
      // A single character that is no word on the lists — 们, the 汤 of 汤姆 —
      // is read as the character it is.
      if ([...w].length === 1 && !lib.byWord.has(w)) {
        const c = recall[charId(w)];
        return c && isLearned(c) ? 'known' : c ? 'learning' : 'new';
      }
      return 'new';
    },
  };
}

/**
 * What tapping a word in a passage opens: the word, when it is one — any run
 * of two or more, or a single character the lists count as a word — and
 * otherwise the character. 们 on its own is a character, not a word.
 */
export function itemForToken(lib: Library, text: string): ItemId {
  return [...text].length > 1 || lib.byWord.has(text) ? wordId(text) : charId(text);
}

export interface WordInventory {
  /** words review has let stand as known, syllabus order first */
  known: string[];
  /**
   * Words worth meeting again: the ones being learned, and known ones the
   * schedule says are falling due — soonest due first.
   */
  learning: string[];
}

/**
 * The words to hand a writer: what you can read as words, and what you would
 * gain from meeting again. Worked out when the prompt is built, not stored.
 */
export function wordInventory(lib: Library, recall: RecallBook, now: number, maxLearning = 20): WordInventory {
  const rank = new Map(lib.words.map((w, i) => [w.w, i]));
  const known: string[] = [];
  const again: Array<{ w: string; due: number }> = [];
  for (const id in recall) {
    if (!id.startsWith('w')) continue;
    const r = recall[id]?.recognise;
    if (!r) continue;
    const w = id.slice(1);
    const learned = isLearned(recall[id]);
    if (learned) known.push(w);
    if (!learned || isDue(r, now)) again.push({ w, due: r.due });
  }
  known.sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
  again.sort((a, b) => a.due - b.due);
  return { known, learning: again.slice(0, maxLearning).map((x) => x.w) };
}
