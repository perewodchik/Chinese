import { isCharId, isWordId } from './ids';
import { DAY, isClaimOnly, SKILLS, type RecallBook } from './memory';
import { shelve, type GeneratedText, type TextSet } from './text';

/**
 * The pieces of a day's plan that are worth being sure of.
 *
 * The Today page puts twenty-odd minutes in order — go over what is due,
 * practise the weakest sound, read something, say sentences out loud — and
 * ticks each off once it has happened today. What counts as "happened" is
 * read off records the app already keeps, so nothing new is stored and it
 * holds on every device the account is open on (the pronunciation tallies
 * excepted: those still live on the device).
 */

/** Midnight this morning, where the device is. */
export function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * How many answers were given since `from`, over every item and skill.
 * A claim (ticking "learned") is not an answer.
 */
export function answeredSince(book: RecallBook, from: number): number {
  let n = 0;
  for (const id in book) {
    for (const s of SKILLS) {
      const r = book[id][s];
      if (r && r.last >= from && !(s === 'recognise' && isClaimOnly(r))) n++;
    }
  }
  return n;
}

/** Characters that entered the picture since `from`: ticked or first asked about. */
export function startedSince(book: RecallBook, from: number): number {
  let n = 0;
  for (const id in book) {
    if (!isCharId(id)) continue;
    let first = Infinity;
    for (const s of SKILLS) {
      const r = book[id][s];
      if (r) first = Math.min(first, r.since ?? r.last);
    }
    if (first >= from && first !== Infinity) n++;
  }
  return n;
}

/** Texts read since `from`. */
export const readSince = (texts: GeneratedText[], from: number) =>
  texts.filter((t) => (t.lastReadAt ?? 0) >= from).length;

/**
 * The text to read next: the first unread one, in reading order, of the
 * newest session that still has one; then the newest loose text not yet read.
 */
export function nextReading(texts: GeneratedText[], sets: TextSet[]): GeneratedText | null {
  const shelf = shelve(texts, sets);
  const newestFirst = [...sets].sort((a, b) => b.createdAt - a.createdAt);
  for (const set of newestFirst) {
    const unread = shelf.bySet.get(set.id)?.find((t) => !t.read);
    if (unread) return unread;
  }
  return [...shelf.loose].sort((a, b) => b.createdAt - a.createdAt).find((t) => !t.read) ?? null;
}

/** About how long a review of `n` questions takes: eight seconds a question, rounded to whole minutes. */
export const reviewMinutes = (n: number) => (n ? Math.max(1, Math.round((n * 8) / 60)) : 0);

export interface ForecastDay {
  /** midnight that day */
  start: number;
  /** questions falling due that day; the first day also holds everything already overdue */
  due: number;
}

/**
 * What is coming up, day by day: how many questions fall due on each of the
 * next few days, today first with everything already overdue in it. Characters
 * count one per skill, words one each — the same units as the Review count.
 */
export function forecast(book: RecallBook, now: number, days = 7): ForecastDay[] {
  const today = startOfToday(now);
  const out: ForecastDay[] = Array.from({ length: days }, (_, i) => ({
    start: startOfToday(today + i * DAY + DAY / 2),
    due: 0,
  }));
  const end = startOfToday(today + days * DAY + DAY / 2);
  for (const id in book) {
    if (!isCharId(id) && !isWordId(id)) continue;
    for (const s of SKILLS) {
      const r = book[id][s];
      if (!r || r.due >= end) continue;
      let i = out.length - 1;
      while (i > 0 && r.due < out[i]!.start) i--;
      out[i]!.due++;
    }
  }
  return out;
}
