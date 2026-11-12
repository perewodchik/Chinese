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

/** How a band of texts sits with someone, by the share of its words they know (the cover's thresholds, V4). */
export type BandFit = 'comfortable' | 'stretch' | 'hard';

export const fitOfShare = (share: number): BandFit => (share >= 0.9 ? 'comfortable' : share >= 0.75 ? 'stretch' : 'hard');

/**
 * Where someone is, in words (G1): the band they are working through — the
 * lowest whose words are not nine in ten known — with its share, and how
 * that band and the next one read for them.
 */
export function whereYouAre(bands: readonly WordBand[]): {
  band: number;
  share: number;
  /** this band and the next, each with its share and how it reads */
  reach: Array<{ band: number; share: number; fit: BandFit }>;
} {
  const share = (b: WordBand) => (b.size ? b.done / b.size : 0);
  const at = bands.findIndex((b) => b.size > 0 && share(b) < 0.9);
  const i = at < 0 ? Math.max(0, bands.length - 1) : at;
  const reach = bands.slice(i, i + 2).filter((b) => b.size > 0).map((b) => ({ band: b.band, share: share(b), fit: fitOfShare(share(b)) }));
  return { band: bands[i]?.band ?? 1, share: bands[i] ? share(bands[i]!) : 0, reach };
}
