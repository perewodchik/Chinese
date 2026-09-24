import { wordsCollectionName, wordsPresetId, type SweepMark } from '../domain/sweep';
import type { ItemId } from '../domain/ids';
import { addItems, createCollection, gradeItem, setLearned } from './commands';
import { getState } from './store';

/**
 * Commands about words, built from the ones every item already has.
 *
 * A word is an item like a character — `w东西` beside `c东` — so marking it
 * learned, grading it and collecting it are the same actions. What is here is
 * only what is particular to words: which collection a band's words go into,
 * and what each answer in the sweep means.
 */

/** The collection a band's new words are gathered in, made the first time it is needed. */
export function wordsCollection(band: number): string {
  const found = getState().collections.find((c) => c.presetId === wordsPresetId(band));
  if (found) return found.id;
  return createCollection({
    name: wordsCollectionName(band),
    presetId: wordsPresetId(band),
    note: `The HSK ${band} words you marked new while sorting, in the order the syllabus gives them — the commonest first.`,
  }).id;
}

/**
 * One page of the sweep, saved.
 *
 * Known words become claims, the way ticking "learned" does. A word you were
 * not sure of is taken as a first answer that took a while — graded hard — so
 * it is in the review rotation and asked about within the day. New words go
 * into the band's collection.
 */
export function saveSweep(band: number, marks: Record<SweepMark, ItemId[]>): void {
  setLearned(marks.know, true);
  for (const id of marks.unsure) gradeItem(id, 'recognise', 'hard');
  if (marks.new.length) addItems(wordsCollection(band), marks.new);
}
