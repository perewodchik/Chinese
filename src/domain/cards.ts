import type { Library } from '../data/types';
import { idValue, isCharId, isWordId, type ItemId } from './ids';
import { isDue, type RecallBook } from './memory';
import { interleave, planReview, type SessionTarget } from './reviewSession';
import type { TextSet } from './text';
import { answeredSince, startOfToday } from './today';

/**
 * The cards: one deck, a fixed number a day.
 *
 * The review behind it was already right about what to ask — the item
 * closest to being lost, one question per item, characters and words mixed.
 * What it got wrong was the size. It showed the whole debt ("go over 520")
 * and asked for minutes against it, and a learner who missed three days came
 * back to a number that said not to bother. A day here is a number of cards,
 * chosen once; what is due beyond it stays due, most-at-risk first, and is
 * never shown as a total to be worked off.
 *
 * New cards come from the shelves: the words chosen there with "Learn this
 * word", in the order they were chosen, a few a day.
 */

export const CARD_SIZES = [10, 20, 30, 50] as const;

/**
 * What a card can ask, and the learner chooses which: what an item means and
 * how it is said (turned over), its pinyin typed with the tones, or the
 * character written from memory. A kind switched off is not asked at all —
 * not turned into another kind — and its schedule waits until it is back.
 */
export type CardSkill = 'recognise' | 'sound' | 'write';
export const CARD_SKILLS: readonly CardSkill[] = ['recognise', 'sound', 'write'];
export const DEFAULT_CARDS = 20;

/** About how long a card takes, for "about 6 minutes". */
export const SECONDS_PER_CARD = 18;

export interface CardPlan {
  /** what is asked, in order: due cards, with the new ones dealt in among them */
  cards: Array<SessionTarget & { fresh: boolean }>;
  /** answers already given today */
  answeredToday: number;
  /** the day's size, after what was answered today */
  left: number;
  /** cards due now, all of them: for the planner, never for a heading */
  due: number;
  /** words chosen on a shelf and not met yet */
  waiting: ItemId[];
}

/** Everything chosen to learn on the shelves and never asked about, newest shelf first, each list in its own order. */
export function waitingCards(sets: TextSet[], book: RecallBook, lib: Library): ItemId[] {
  const out: ItemId[] = [];
  const seen = new Set<ItemId>();
  for (const set of [...sets].sort((a, b) => b.createdAt - a.createdAt)) {
    for (const id of set.study ?? []) {
      if (seen.has(id) || book[id]) continue;
      seen.add(id);
      if (isCharId(id) ? lib.byChar.has(idValue(id)) : isWordId(id)) out.push(id);
    }
  }
  return out;
}

/** Items met for the first time since `from`: a new card's first answer is when it came in. */
export function metSince(book: RecallBook, from: number): number {
  let n = 0;
  for (const id in book) {
    const skills = Object.values(book[id] ?? {});
    if (!skills.length) continue;
    const first = Math.min(...skills.map((r) => r!.since ?? r!.last));
    if (first >= from) n++;
  }
  return n;
}

/**
 * Today's cards: what is left of the day's size, filled with the cards most
 * at risk, and up to `newPerDay` new ones spread among them.
 */
export function planCards(
  lib: Library,
  book: RecallBook,
  sets: TextSet[],
  now: number,
  opts: { size: number; newPerDay: number; skills?: readonly CardSkill[] },
): CardPlan {
  const today = startOfToday(now);
  const answeredToday = answeredSince(book, today);
  const left = Math.max(0, opts.size - answeredToday);
  const waiting = waitingCards(sets, book, lib);
  const freshRoom = Math.max(0, opts.newPerDay - metSince(book, today));
  // A minute holds about five cards in the planner's own reckoning.
  const review = planReview(lib, book, now, Math.max(1, (left * SECONDS_PER_CARD) / 60), opts.skills ?? CARD_SKILLS);
  const fresh = waiting.slice(0, Math.min(freshRoom, Math.ceil(left / 4)));
  const due = review.targets.slice(0, Math.max(0, left - fresh.length));
  return { cards: dealIn(due, fresh), answeredToday, left, due: review.dueItems, waiting };
}

/**
 * One shelf's words as a sitting of their own, outside the day's size: the
 * ones being learned, soonest due first, then the ones not met yet.
 */
export function planShelf(lib: Library, book: RecallBook, set: TextSet, now: number, size: number): CardPlan {
  const items = (set.study ?? []).filter((id) => (isCharId(id) ? lib.byChar.has(idValue(id)) : isWordId(id)));
  const met = items
    .filter((id) => book[id]?.recognise)
    .sort((a, b) => book[a]!.recognise!.due - book[b]!.recognise!.due)
    .map((id) => ({ id, skill: 'recognise' as const, record: book[id]!.recognise! }));
  const fresh = items.filter((id) => !book[id]);
  const cards = dealIn(met.slice(0, size), fresh.slice(0, Math.max(0, size - Math.min(met.length, size))));
  return {
    cards: cards.slice(0, size),
    answeredToday: answeredSince(book, startOfToday(now)),
    left: size,
    due: met.filter((t) => isDue(t.record, now)).length,
    waiting: fresh,
  };
}

/** New cards spread through the due ones, one in every few, rather than bunched at the start. */
function dealIn(due: SessionTarget[], fresh: ItemId[]): Array<SessionTarget & { fresh: boolean }> {
  const out: Array<SessionTarget & { fresh: boolean }> = interleave(due).map((t) => ({ ...t, fresh: false }));
  const every = fresh.length ? Math.max(2, Math.floor(out.length / fresh.length)) : 0;
  fresh.forEach((id, i) => {
    out.splice(Math.min(out.length, 1 + i * (every + 1)), 0, { id, skill: 'recognise', record: null, fresh: true });
  });
  return out;
}
