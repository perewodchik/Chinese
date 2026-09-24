import type { Collection } from './collection';
import { planDrill, type DrillQueue } from './drill';
import { isWordId, type ItemId } from './ids';
import { isDue, type RecallBook } from './memory';
import { wordsBandOf } from './sweep';

/**
 * Reviewing words: what is due, and which new ones join.
 *
 * A word has one schedule, `recognise` — see it, know what it means. It uses
 * the same scheduler as a character's recognition, and the same mixing of new
 * with due, so everything said in `drill.ts` holds here. What is particular
 * to words is where new ones come from and how many a day.
 *
 * New words come out of collections, in the order they sit there: the band
 * collections the sweep fills first, lowest band first, then any other
 * collection holding words, oldest first. Nothing is introduced that was not
 * put somewhere to be learned — the same rule that keeps characters out of
 * rotation until you have said you mean to study them.
 *
 * And no more than so many a day, however long the sitting: a word met for
 * the first time comes back within the day, and ten new ones today are ten
 * reviews tomorrow and the day after. The count of how many came in today is
 * read off the memory — words from a collection whose record began today —
 * so it holds across sittings and devices without being stored anywhere.
 */

export const NEW_WORDS_PER_DAY = [5, 10, 15, 20];
export const DEFAULT_NEW_WORDS = 10;

/** Word collections in the order their words are learned in. */
function learningOrder(collections: Collection[]): Collection[] {
  const band = (c: Collection) => wordsBandOf(c) ?? Infinity;
  return collections
    .filter((c) => c.items.some(isWordId))
    .sort((a, b) => band(a) - band(b) || a.createdAt - b.createdAt);
}

export interface WordPool {
  /** words with a record: the ones review can ask about now or later */
  reviewed: ItemId[];
  /** words waiting in collections with no record yet, in the order to learn them */
  waiting: ItemId[];
}

export function wordPool(book: RecallBook, collections: Collection[]): WordPool {
  const reviewed: ItemId[] = [];
  for (const id in book) if (isWordId(id) && book[id]?.recognise) reviewed.push(id);
  const seen = new Set(reviewed);
  const waiting: ItemId[] = [];
  for (const c of learningOrder(collections)) {
    for (const id of c.items) {
      if (!isWordId(id) || seen.has(id)) continue;
      seen.add(id);
      waiting.push(id);
    }
  }
  return { reviewed, waiting };
}

/** Midnight this morning, where the device is. */
export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** How many words from collections began their record today. */
export function introducedToday(book: RecallBook, collections: Collection[], now: number): number {
  const from = startOfDay(now);
  const collected = new Set<ItemId>();
  for (const c of collections) for (const id of c.items) if (isWordId(id)) collected.add(id);
  let n = 0;
  for (const id of collected) {
    const r = book[id]?.recognise;
    if (r && (r.since ?? r.last) >= from) n++;
  }
  return n;
}

export interface WordReviewSummary {
  due: number;
  /** new words the day still has room for, and there are to give */
  fresh: number;
  /** words with a record at all */
  seen: number;
  /** waiting in collections, whatever today's room */
  waiting: number;
}

export function summariseWords(
  book: RecallBook,
  collections: Collection[],
  perDay: number,
  now: number,
): WordReviewSummary {
  const pool = wordPool(book, collections);
  const due = pool.reviewed.filter((id) => isDue(book[id]!.recognise!, now)).length;
  const room = Math.max(0, perDay - introducedToday(book, collections, now));
  return {
    due,
    fresh: Math.min(room, pool.waiting.length),
    seen: pool.reviewed.length,
    waiting: pool.waiting.length,
  };
}

/** One sitting of words: what is due, with today's new words folded in among them. */
export function planWordSitting(
  book: RecallBook,
  collections: Collection[],
  size: number,
  perDay: number,
  now: number,
): DrillQueue {
  const pool = wordPool(book, collections);
  const room = Math.max(0, perDay - introducedToday(book, collections, now));
  return planDrill(book, {
    skill: 'recognise',
    pool: [...pool.reviewed, ...pool.waiting],
    now,
    max: size,
    fresh: Math.min(room, Math.ceil(size / 3)),
  });
}
