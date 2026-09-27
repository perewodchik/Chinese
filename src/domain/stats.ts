import type { Library } from '../data/types';
import { active, dayKey, dayStart, shift, type Activity, type DayLog, type DaySnap } from './activity';
import { charId, isCharId, isWordId, type ItemId } from './ids';
import { DAY, isLearned, masteryOf, skillHold, SKILLS, type MasteryBand, type RecallBook, type SkillBook } from './memory';

/**
 * The numbers behind the Stats page: how much was learned, day by day and
 * week by week, and how that adds up.
 *
 * Two sources, and the page is honest about which is which. The activity log
 * says what was done each day — answers, time, and, from format 10 on, a
 * snapshot of how much was known at the end of the day. The memory says what
 * is known now, and when each item first entered the picture (`since`). Days
 * before the first snapshot are reconstructed from the second: an item known
 * today is counted from the day it was first met. That misses what has been
 * forgotten since and counts some things a little early, so those days are
 * marked `estimated` and drawn as such.
 *
 * Pure: a function of the log, the memory and a clock.
 */

/* ------------------------------------------------------------ one item */

/** When an item first entered the picture, over every skill; null for none. */
export function firstMet(sk: SkillBook | undefined): number | null {
  if (!sk) return null;
  let first = Infinity;
  for (const s of SKILLS) {
    const r = sk[s];
    if (r) first = Math.min(first, r.since ?? r.last);
  }
  return first === Infinity ? null : first;
}

/**
 * How firmly one item is held, as a band. A character has four skills and
 * `masteryOf` averages them; a word has one, so its band is read off that one.
 */
export function bandOf(id: ItemId, sk: SkillBook | undefined, now: number): MasteryBand {
  if (isCharId(id)) return masteryOf(sk, now).band;
  const r = sk?.recognise;
  if (!r) return 'unseen';
  const score = skillHold(r, now);
  return r.lapses > 1 && score < 0.6 ? 'shaky' : score < 0.15 ? 'new' : score < 0.65 ? 'holding' : 'solid';
}

const isItem = (id: string) => isCharId(id) || isWordId(id);

/** Where things stand now — what a day's snapshot records. */
export function snapshotOf(book: RecallBook, now: number): DaySnap {
  const out: DaySnap = { chars: 0, words: 0, solid: 0, holding: 0, shaky: 0, fresh: 0 };
  for (const id in book) {
    if (!isItem(id)) continue;
    const sk = book[id];
    if (isLearned(sk)) {
      if (isCharId(id)) out.chars++;
      else out.words++;
    }
    const band = bandOf(id, sk, now);
    if (band === 'solid') out.solid++;
    else if (band === 'holding') out.holding++;
    else if (band === 'shaky') out.shaky++;
    else if (band === 'new') out.fresh++;
  }
  return out;
}

/* ------------------------------------------------------------ day by day */

export interface Day {
  key: string;
  /** midnight, local */
  start: number;
  /** characters and words known at the end of the day */
  chars: number;
  words: number;
  /** reconstructed from today's memory, not written down on the day */
  estimated: boolean;
  /** items that entered the picture that day */
  newChars: number;
  newWords: number;
  answers: number;
  right: number;
  ms: number;
  active: boolean;
}

/** Items first met on each day, by day key. */
export function startedByDay(book: RecallBook): Map<string, { chars: number; words: number }> {
  const out = new Map<string, { chars: number; words: number }>();
  for (const id in book) {
    if (!isItem(id)) continue;
    const t = firstMet(book[id]);
    if (t === null) continue;
    const k = dayKey(t);
    const d = out.get(k) ?? { chars: 0, words: 0 };
    if (isCharId(id)) d.chars++;
    else d.words++;
    out.set(k, d);
  }
  return out;
}

/**
 * The known count on each of the last `days` days, oldest first, with the
 * day's work beside it. Today is read live from the memory.
 */
export function days(activity: Activity, book: RecallBook, now: number, count: number): Day[] {
  const started = startedByDay(book);

  // For the estimate: learned-now items by the day they were first met.
  const knownFrom: Array<{ t: number; char: boolean }> = [];
  for (const id in book) {
    if (!isItem(id) || !isLearned(book[id])) continue;
    const t = firstMet(book[id]);
    if (t !== null) knownFrom.push({ t, char: isCharId(id) });
  }
  knownFrom.sort((a, b) => a.t - b.t);

  const snapKeys = Object.keys(activity)
    .filter((k) => activity[k]!.snap)
    .sort();
  const todayKey = dayKey(now);
  const live = snapshotOf(book, now);

  const out: Day[] = [];
  let si = -1;
  let ki = 0;
  let estChars = 0;
  let estWords = 0;
  const first = shift(now, count - 1);
  // Anything met before the window opens counts towards the first day.
  while (ki < knownFrom.length && dayKey(knownFrom[ki]!.t) < first) {
    if (knownFrom[ki]!.char) estChars++;
    else estWords++;
    ki++;
  }
  while (si + 1 < snapKeys.length && snapKeys[si + 1]! < first) si++;

  for (let n = count - 1; n >= 0; n--) {
    const key = shift(now, n);
    while (ki < knownFrom.length && dayKey(knownFrom[ki]!.t) <= key) {
      if (knownFrom[ki]!.char) estChars++;
      else estWords++;
      ki++;
    }
    while (si + 1 < snapKeys.length && snapKeys[si + 1]! <= key) si++;
    const log: DayLog | undefined = activity[key];
    const snap = key === todayKey ? live : si >= 0 ? activity[snapKeys[si]!]!.snap! : null;
    const s = started.get(key);
    out.push({
      key,
      start: dayStart(key),
      chars: snap ? snap.chars : estChars,
      words: snap ? snap.words : estWords,
      estimated: !snap,
      newChars: s?.chars ?? 0,
      newWords: s?.words ?? 0,
      answers: log?.answers ?? 0,
      right: log?.right ?? 0,
      ms: log?.ms ?? 0,
      active: active(log),
    });
  }
  return out;
}

/* ------------------------------------------------------------ buckets */

export type Unit = 'day' | 'week' | 'month';

export interface Bucket {
  key: string;
  start: number;
  /** "Mon 21", "21 Sep", "Sep" */
  label: string;
  /** known at the end of the bucket */
  chars: number;
  words: number;
  estimated: boolean;
  newChars: number;
  newWords: number;
  answers: number;
  right: number;
  ms: number;
  activeDays: number;
}

/** How many days back each view needs, so a caller can ask `days` for enough. */
export const SPAN: Record<Unit, { buckets: number; days: number }> = {
  day: { buckets: 30, days: 30 },
  week: { buckets: 26, days: 26 * 7 + 6 },
  month: { buckets: 12, days: 366 + 31 },
};

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Monday of the week a day falls in, as a day key. */
export function weekOf(key: string): string {
  const t = dayStart(key);
  const back = (new Date(t).getDay() + 6) % 7;
  return shift(t + DAY / 2, back);
}

const monthOf = (key: string) => key.slice(0, 7);

/** The days folded into days, weeks (Monday first) or months, oldest first. */
export function bucketed(list: Day[], unit: Unit): Bucket[] {
  const groups = new Map<string, Day[]>();
  for (const d of list) {
    const k = unit === 'day' ? d.key : unit === 'week' ? weekOf(d.key) : monthOf(d.key);
    const g = groups.get(k) ?? [];
    g.push(d);
    groups.set(k, g);
  }
  const out: Bucket[] = [];
  for (const [key, g] of groups) {
    const last = g[g.length - 1]!;
    const start = unit === 'month' ? dayStart(`${key}-01`) : dayStart(unit === 'week' ? key : g[0]!.key);
    const date = new Date(start);
    out.push({
      key,
      start,
      label:
        unit === 'day'
          ? `${WEEKDAY[date.getDay()]} ${date.getDate()}`
          : unit === 'week'
            ? `${date.getDate()} ${MONTH[date.getMonth()]}`
            : MONTH[date.getMonth()]!,
      chars: last.chars,
      words: last.words,
      estimated: last.estimated,
      newChars: sum(g, 'newChars'),
      newWords: sum(g, 'newWords'),
      answers: sum(g, 'answers'),
      right: sum(g, 'right'),
      ms: sum(g, 'ms'),
      activeDays: g.filter((d) => d.active).length,
    });
  }
  return out.slice(-SPAN[unit].buckets);
}

const sum = (g: Day[], f: 'newChars' | 'newWords' | 'answers' | 'right' | 'ms') => g.reduce((n, d) => n + d[f], 0);

/* ------------------------------------------------------------ comparing */

export interface Totals {
  newChars: number;
  newWords: number;
  answers: number;
  /** 0–1, or null with no answers */
  accuracy: number | null;
  minutes: number;
  activeDays: number;
}

export function totals(list: Day[]): Totals {
  const answers = sum(list, 'answers');
  return {
    newChars: sum(list, 'newChars'),
    newWords: sum(list, 'newWords'),
    answers,
    accuracy: answers ? sum(list, 'right') / answers : null,
    minutes: Math.round(sum(list, 'ms') / 60_000),
    activeDays: list.filter((d) => d.active).length,
  };
}

/**
 * The last seven days against the seven before them. Rolling rather than
 * calendar weeks, so Monday morning does not compare one day with seven.
 */
export function weekCompare(list: Day[]): { now: Totals; before: Totals } {
  return { now: totals(list.slice(-7)), before: totals(list.slice(-14, -7)) };
}

export interface Records {
  bestDay: { key: string; items: number } | null;
  bestWeek: { key: string; items: number } | null;
  mostAnswers: { key: string; answers: number } | null;
}

export function records(list: Day[]): Records {
  let bestDay: Records['bestDay'] = null;
  let mostAnswers: Records['mostAnswers'] = null;
  for (const d of list) {
    const items = d.newChars + d.newWords;
    if (items && (!bestDay || items > bestDay.items)) bestDay = { key: d.key, items };
    if (d.answers && (!mostAnswers || d.answers > mostAnswers.answers)) mostAnswers = { key: d.key, answers: d.answers };
  }
  let bestWeek: Records['bestWeek'] = null;
  for (const w of bucketed(list, 'week')) {
    const items = w.newChars + w.newWords;
    if (items && (!bestWeek || items > bestWeek.items)) bestWeek = { key: w.key, items };
  }
  return { bestDay, bestWeek, mostAnswers };
}

/* ------------------------------------------------------------ the streak */

export interface GoalOptions {
  dailyGoal: 'plan' | 'minutes';
  goalMinutes: number;
  restDays: boolean;
}

/** Whether a day met the goal: any real work, or enough minutes of it. */
export const goalMet = (d: DayLog | undefined, o: Pick<GoalOptions, 'dailyGoal' | 'goalMinutes'>) =>
  o.dailyGoal === 'minutes' ? (d?.ms ?? 0) >= o.goalMinutes * 60_000 : active(d);

export interface GoalStreak {
  current: number;
  best: number;
  /** today already met the goal */
  today: boolean;
  /** days a rest was taken on without breaking the run */
  rested: Set<string>;
}

/**
 * Days in a row the goal was met, where — if rest days are on — one missed
 * day a calendar week is a rest rather than a break, as long as the day
 * after it met the goal (or is still to come). A rest keeps the run alive
 * but does not add to it.
 */
export function goalStreak(activity: Activity, now: number, o: GoalOptions): GoalStreak {
  const todayKey = dayKey(now);
  const keys = Object.keys(activity).sort();
  const rested = new Set<string>();
  if (!keys.length) return { current: 0, best: 0, today: false, rested };

  const met = (k: string) => goalMet(activity[k], o);
  let run = 0;
  let best = 0;
  let restWeek: string | null = null;
  let key = keys[0]!;
  let guard = 0;
  while (key <= todayKey && guard++ < 1000) {
    const next = shift(dayStart(key) + DAY / 2, -1);
    if (met(key)) {
      run++;
    } else if (key === todayKey) {
      // today is not over: it neither adds nor breaks
    } else if (
      o.restDays &&
      run > 0 &&
      weekOf(key) !== restWeek &&
      (next >= todayKey || met(next))
    ) {
      restWeek = weekOf(key);
      rested.add(key);
    } else {
      run = 0;
    }
    best = Math.max(best, run);
    key = next;
  }
  return { current: run, best, today: met(todayKey), rested };
}

/* ------------------------------------------------------------ milestones */

export interface Milestone {
  id: string;
  /** one character for the seal */
  mark: string;
  label: string;
  /** day key it was reached, or null for not yet; '' for reached on a day nobody knows */
  reached: string | null;
  have: number;
  need: number;
}

const CHAR_STEPS = [10, 50, 100, 250, 500, 1000];
const WORD_STEPS = [50, 100, 250, 500];
const STREAK_STEPS = [7, 30, 100];
const ANSWER_STEPS = [100, 1000, 5000];

/** The day a running series first reached `n`, or null. */
function firstAt<T>(list: T[], value: (x: T) => number, key: (x: T) => string, n: number): string | null {
  for (const x of list) if (value(x) >= n) return key(x);
  return null;
}

export function milestones(
  lib: Library,
  activity: Activity,
  book: RecallBook,
  now: number,
  history: Day[],
  streak: GoalStreak,
): Milestone[] {
  const out: Milestone[] = [];
  const snap = snapshotOf(book, now);

  for (const n of CHAR_STEPS) {
    const reached = snap.chars >= n ? (firstAt(history, (d) => d.chars, (d) => d.key, n) ?? '') : null;
    out.push({ id: `chars-${n}`, mark: '字', label: `${n} characters`, reached, have: snap.chars, need: n });
  }
  for (const n of WORD_STEPS) {
    const reached = snap.words >= n ? (firstAt(history, (d) => d.words, (d) => d.key, n) ?? '') : null;
    out.push({ id: `words-${n}`, mark: '词', label: `${n} words`, reached, have: snap.words, need: n });
  }

  // HSK 1 characters, all of them: reached the day the last of them was first met.
  const hsk1 = lib.characters.filter((c) => c.hsk === 1);
  const have1 = hsk1.filter((c) => isLearned(book[charId(c.c)])).length;
  const last1 = have1 === hsk1.length ? Math.max(...hsk1.map((c) => firstMet(book[charId(c.c)]) ?? 0)) : null;
  out.push({
    id: 'hsk1-chars',
    mark: '一',
    label: 'Every HSK 1 character',
    reached: last1 === null ? null : dayKey(last1),
    have: have1,
    need: hsk1.length,
  });

  for (const n of STREAK_STEPS) {
    out.push({
      id: `streak-${n}`,
      mark: '恒',
      label: `${n}-day streak`,
      reached: streak.best >= n ? '' : null,
      have: streak.current,
      need: n,
    });
  }

  const keys = Object.keys(activity).sort();
  let running = 0;
  const cumulative = keys.map((k) => ({ k, n: (running += activity[k]!.answers) }));
  for (const n of ANSWER_STEPS) {
    out.push({
      id: `answers-${n}`,
      mark: '复',
      label: `${n.toLocaleString('en')} answers`,
      reached: running >= n ? firstAt(cumulative, (x) => x.n, (x) => x.k, n) : null,
      have: running,
      need: n,
    });
  }
  return out;
}

/* ------------------------------------------------------------ pace */

/**
 * Days until `remaining` more are learned at the pace of the last two weeks,
 * or null with no pace to go on.
 */
export function daysToGo(list: Day[], remaining: number, field: 'newChars' | 'newWords' = 'newChars'): number | null {
  if (remaining <= 0) return 0;
  const recent = list.slice(-14);
  const perDay = recent.reduce((n, d) => n + d[field], 0) / Math.max(1, recent.length);
  if (perDay <= 0) return null;
  return Math.ceil(remaining / perDay);
}

/* ------------------------------------------------------------ the note */

/**
 * One line about last week, for Monday: what came of it, and whether it was
 * the best week yet. Null on other days, and after a week with nothing in it.
 */
export function weeklyNote(history: Day[], now: number): string | null {
  if (new Date(now).getDay() !== 1) return null;
  const weeks = bucketed(history, 'week');
  const last = weeks[weeks.length - 2];
  if (!last || (!last.answers && !last.newChars && !last.newWords)) return null;
  const earlier = weeks.slice(0, -2);
  const items = last.newChars + last.newWords;
  const best = items > 0 && earlier.every((w) => w.newChars + w.newWords < items);
  const parts = [
    `${last.newChars} new character${last.newChars === 1 ? '' : 's'}`,
    `${last.newWords} word${last.newWords === 1 ? '' : 's'}`,
  ];
  if (last.answers) parts.push(`${Math.round((100 * last.right) / last.answers)}% right`);
  return `Last week: ${parts.join(', ')}${best && earlier.length ? ' — your best week yet.' : '.'}`;
}
