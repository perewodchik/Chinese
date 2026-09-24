import type { Library, SyllabusWord } from '../data/types';
import type { Collection } from './collection';
import { wordId, type ItemId } from './ids';
import { isLearned, type RecallBook } from './memory';

/**
 * Finding out which words you already know.
 *
 * Somebody arriving at the words with a few hundred characters behind them
 * knows a good part of HSK 1 and 2 already, and being walked through 491
 * words one card at a time to prove it is a week of reviews spent on 我 and
 * 你. So the sweep puts the words of a band on the page a screenful at a time
 * and asks only for the exceptions: leave what you know, tap what you are not
 * sure of, tap again what you have never met.
 *
 * What it records is what the rest of the app already understands, so there
 * is nothing new to store:
 *
 * - **know** is a claim, like ticking "learned" by hand — believed, not
 *   tested, and brought back over the next couple of weeks to check;
 * - **unsure** is a first answer that took a while, which puts the word in
 *   the review rotation and asks about it within the day;
 * - **new** goes into a collection of the band's words, to be learned in
 *   order.
 *
 * And so whether a word has been sorted is simply whether it has a record or
 * sits in a collection — a sweep left halfway is picked up where it stopped,
 * on whichever device, and a word taken back out of a collection comes back
 * to be sorted again.
 */

export type SweepMark = 'know' | 'unsure' | 'new';

/** A tap moves a word along: known, then not sure, then new, then known again. */
export const nextMark = (m: SweepMark): SweepMark =>
  m === 'know' ? 'unsure' : m === 'unsure' ? 'new' : 'know';

/** The bands worth sweeping: past HSK 3 there is little a sweep would find. */
export const SWEEP_BANDS = [1, 2, 3];

/** How many words a page shows: a phone's worth at three across. */
export const SWEEP_PAGE = 24;

/** The collection a band's new words go into, found again by this. */
export const wordsPresetId = (band: number) => `words-hsk-${band}`;

export const wordsCollectionName = (band: number) => `HSK ${band} words`;

export type WordStanding = 'known' | 'reviewing' | 'to-learn' | 'unsorted';

/** Where one word stands, from the memory and the collections alone. */
export function standingOf(
  id: ItemId,
  recall: RecallBook,
  collected: ReadonlySet<ItemId>,
): WordStanding {
  const book = recall[id];
  if (book && Object.keys(book).length) return isLearned(book) ? 'known' : 'reviewing';
  return collected.has(id) ? 'to-learn' : 'unsorted';
}

export interface BandSweep {
  band: number;
  words: SyllabusWord[];
  /** the band's words nobody has sorted yet, in syllabus order */
  unsorted: SyllabusWord[];
  counts: Record<WordStanding, number>;
}

/** Everything in every collection, for telling a word to learn from an unsorted one. */
export function collectedItems(collections: Collection[]): Set<ItemId> {
  const out = new Set<ItemId>();
  for (const c of collections) for (const id of c.items) out.add(id);
  return out;
}

export function sweepOf(
  lib: Library,
  band: number,
  recall: RecallBook,
  collected: ReadonlySet<ItemId>,
): BandSweep {
  const words = lib.words.filter((w) => w.hsk === band);
  const counts: Record<WordStanding, number> = { known: 0, reviewing: 0, 'to-learn': 0, unsorted: 0 };
  const unsorted: SyllabusWord[] = [];
  for (const w of words) {
    const s = standingOf(wordId(w.w), recall, collected);
    counts[s]++;
    if (s === 'unsorted') unsorted.push(w);
  }
  return { band, words, unsorted, counts };
}

/** A page of marks, split into what each kind of answer does. */
export function splitMarks(marks: ReadonlyMap<string, SweepMark>): Record<SweepMark, ItemId[]> {
  const out: Record<SweepMark, ItemId[]> = { know: [], unsure: [], new: [] };
  for (const [w, m] of marks) out[m].push(wordId(w));
  return out;
}

/** The band to offer first: the lowest one with anything left in it. */
export function firstOpenBand(
  lib: Library,
  recall: RecallBook,
  collected: ReadonlySet<ItemId>,
): number {
  for (const b of SWEEP_BANDS) {
    if (sweepOf(lib, b, recall, collected).unsorted.length) return b;
  }
  return SWEEP_BANDS[SWEEP_BANDS.length - 1];
}
