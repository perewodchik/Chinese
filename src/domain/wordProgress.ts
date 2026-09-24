import type { Library } from '../data/types';
import { wordId } from './ids';
import { isLearned, type Recall, type RecallBook } from './memory';

/**
 * How far into each band's words you are, beside how far into its characters.
 *
 * The bar across the top counted characters only, so a morning spent sorting
 * the HSK 1 words moved nothing on it. A band is its characters and its words
 * together now, and this is the words' half, band by band, in the same shape
 * the characters' half is counted in.
 */
export interface WordBand {
  band: number;
  size: number;
  /** counted as known: the same line a character crosses to count as learned */
  done: number;
  /** of those, confirmed by an answer in review rather than only claimed */
  proven: number;
}

export const WORD_PROGRESS_BANDS = [1, 2, 3, 4, 5, 6, 7];

export function wordBands(
  lib: Library,
  recall: RecallBook,
  /** whether a known word's record is more than a claim; nothing is, unless told */
  confirmed: (r: Recall | undefined) => boolean = () => false,
): WordBand[] {
  const bands = WORD_PROGRESS_BANDS.map((band) => ({ band, size: 0, done: 0, proven: 0 }));
  for (const w of lib.words) {
    const b = bands[Math.min(w.hsk, 7) - 1];
    if (!b) continue;
    b.size++;
    const book = recall[wordId(w.w)];
    if (!isLearned(book)) continue;
    b.done++;
    if (confirmed(book?.recognise)) b.proven++;
  }
  return bands;
}
