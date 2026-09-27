import type { Library } from '../data/types';
import type { Collection } from './collection';
import { charId, idValue, isCharId, isWordId, wordId, type ItemId } from './ids';
import { isDue, isLearned, type Rating, type RecallBook, type Skill } from './memory';
import { readyToLearn } from './series';
import { wordPool } from './wordReview';

/**
 * The day's lesson: which new things to meet, and how the meeting went.
 *
 * Before this, a character entered the schedule by being ticked in the
 * library — a claim, first asked about a week or more later, by which time
 * the first review was really a first meeting — and a new word was shown
 * once, answer and all, in the middle of a review. A lesson meets a handful
 * of new items properly (photo, sound, parts, a sentence), practises each a
 * few ways, and ends with one plain question per item whose answer is the
 * item's first real grade. Nothing is stored as a claim.
 *
 * Pure: the page runs the lesson, this picks it and grades it.
 */

export const NEW_PER_DAY = [3, 5, 8, 10, 15];
export const DEFAULT_NEW_PER_DAY = 5;

/** Reviews due today past which new items are halved, and past which they stop. */
export const HALVE_AT = 60;
export const STOP_AT = 120;

export type Throttle = 'none' | 'half' | 'stop';

/** The skills the daily review asks about. `use` is left to words now. */
export const REVIEW_SKILLS: Skill[] = ['recognise', 'sound', 'write'];

/** Characters and words with anything due today — the backlog the lesson makes room for. */
export function dueItemCount(book: RecallBook, now: number): number {
  let n = 0;
  for (const id in book) {
    if (!isCharId(id) && !isWordId(id)) continue;
    const sk = book[id];
    if (REVIEW_SKILLS.some((s) => sk[s] && isDue(sk[s]!, now))) n++;
  }
  return n;
}

export function throttleFor(due: number): Throttle {
  return due > STOP_AT ? 'stop' : due > HALVE_AT ? 'half' : 'none';
}

export interface LessonPick {
  ids: ItemId[];
  /** how many the day allowed, after the throttle */
  size: number;
  throttle: Throttle;
}

/**
 * Today's new items, in the order to meet them.
 *
 * Words first, from the word collections in the order Review already learns
 * them (the sweep's bands, lowest first). Any character of a word not yet
 * known comes just before the word, so 火 and 车 are met, then 火车 — the
 * unit feel of a course, out of data the app already has. Then characters on
 * their own: those every part of which is known (the cheapest to learn),
 * then the next in the teaching order of the current band.
 *
 * Nothing that already has a record is picked: that is review's.
 */
export function pickLesson(
  lib: Library,
  book: RecallBook,
  collections: Collection[],
  perDay: number,
  due: number,
  band: number,
): LessonPick {
  const throttle = throttleFor(due);
  const size = throttle === 'stop' ? 0 : throttle === 'half' ? Math.ceil(perDay / 2) : perDay;
  const out: ItemId[] = [];
  const taken = new Set<ItemId>();
  const fresh = (id: ItemId) => !taken.has(id) && !book[id];
  const add = (id: ItemId) => {
    taken.add(id);
    out.push(id);
  };

  const { waiting } = wordPool(book, collections);
  for (const w of waiting) {
    if (out.length >= size) break;
    if (!fresh(w)) continue;
    // A one-character word is its character: met once, as the character,
    // and graded as both (see `twinWord`).
    const only = [...idValue(w)];
    if (only.length === 1) {
      const c = charId(only[0]!);
      taken.add(w);
      if (lib.byChar.has(only[0]!) && fresh(c) && !isLearned(book[c])) add(c);
      else if (!book[w]) add(w);
      continue;
    }
    const chars = [...idValue(w)].map(charId).filter((c) => lib.byChar.has(idValue(c)) && fresh(c) && !isLearned(book[c]));
    // A word whose new characters would not fit today waits for tomorrow,
    // rather than being met without them.
    if (out.length + chars.length + 1 > size && out.length > 0) continue;
    for (const c of chars) add(c);
    add(w);
  }

  if (out.length < size) {
    const known = new Set<string>();
    for (const id in book) if (isCharId(id) && isLearned(book[id])) known.add(idValue(id));
    for (const r of readyToLearn(lib, known, 50)) {
      if (out.length >= size) break;
      if (r.entry.hsk <= band && fresh(charId(r.entry.c))) add(charId(r.entry.c));
    }
    const next = lib.characters.filter((c) => c.hsk <= band).sort((a, b) => a.hsk - b.hsk || a.i - b.i);
    for (const c of next) {
      if (out.length >= size) break;
      if (fresh(charId(c.c))) add(charId(c.c));
    }
  }

  // The first word may run a little over with its characters: better met whole than not at all.
  return { ids: out, size, throttle };
}

/* ------------------------------------------------------------ grading it */

export interface Practised {
  /** wrong tries over the practice cards */
  misses: number;
  /** "I already know this", said on meeting it */
  knew: boolean;
  /** the final check: right, wrong, or not asked (knew it already) */
  check: 'right' | 'wrong' | null;
}

/**
 * An item's first grade, from the whole lesson: the final check decides, and
 * a clean practice run is what makes a right check "good" rather than "hard".
 * Never "easy" — a first answer is the least reliable evidence there will
 * ever be, however it went.
 */
export function lessonRating(p: Practised): Rating {
  if (p.knew) return 'good';
  if (p.check === 'wrong') return 'again';
  return p.misses === 0 ? 'good' : 'hard';
}

/**
 * The syllabus word a character is on its own — 的, 我 — which a lesson
 * grades along with the character, so it is not met a second time as a word.
 */
export function twinWord(lib: Library, id: ItemId, book: RecallBook): ItemId | null {
  if (!isCharId(id)) return null;
  const w = wordId(idValue(id));
  return lib.byWord.has(idValue(id)) && !book[w] ? w : null;
}

/** Characters and words among a lesson's ids. */
export const lessonCounts = (ids: readonly ItemId[]) => ({
  chars: ids.filter(isCharId).length,
  words: ids.filter(isWordId).length,
});
