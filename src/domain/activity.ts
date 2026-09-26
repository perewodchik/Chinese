/**
 * What was done on each day, kept so the days can be seen.
 *
 * The scheduler keeps only the latest answer per item and skill, which is all
 * it needs and says nothing about yesterday. A learner doing twenty minutes a
 * day wants two things it cannot give: to see the run of days they have kept
 * up, and to see that a day counted. So each day gets a small tally — answers
 * given, how many were right, texts read, things said out loud — added to as
 * it happens and kept with the account, so the iPad and the laptop show the
 * same run.
 *
 * Pure: the store folds entries in from its actions, and everything here is
 * a function of the log and a clock.
 */

export interface DayLog {
  /** review answers given, characters and words, on screen or marked on paper */
  answers: number;
  /** of those, not "again" */
  right: number;
  /** texts marked read */
  read: number;
  /** pronunciation tries: words and pairs said, sounds told apart, sentences said */
  spoken: number;
  /** video work: a part watched, a notebook check marked */
  videos: number;
}

/** By local calendar day, "2026-09-24". */
export type Activity = Record<string, DayLog>;

const FIELDS: Array<keyof DayLog> = ['answers', 'right', 'read', 'spoken', 'videos'];

/** How many days are kept: a year and a bit, enough for any calendar the app draws. */
const KEEP_DAYS = 400;

const empty = (): DayLog => ({ answers: 0, right: 0, read: 0, spoken: 0, videos: 0 });

/** The local calendar day a moment falls on. */
export function dayKey(t: number): string {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Midnight at the start of a day key, local time. */
const dayStart = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!).getTime();
};

/** The key `n` days before (or after, when negative) the day of `t`. */
function shift(t: number, n: number): string {
  const d = new Date(t);
  d.setHours(12, 0, 0, 0); // noon, so a daylight-saving change never skips or repeats a day
  d.setDate(d.getDate() - n);
  return dayKey(d.getTime());
}

/** One more thing done at `at`, added to its day. */
export function logDay(a: Activity, at: number, add: Partial<DayLog>): Activity {
  const key = dayKey(at);
  const had = a[key] ?? empty();
  const next = { ...had };
  for (const f of FIELDS) next[f] += Math.max(0, add[f] ?? 0);
  return { ...a, [key]: next };
}

/** Whether anything at all was done that day. */
export const active = (d: DayLog | undefined) => Boolean(d && (d.answers || d.read || d.spoken || d.videos));

/** A rough size of the day, for shading a calendar square. */
export const dayWeight = (d: DayLog | undefined) => (d ? d.answers + d.spoken + (d.read + d.videos) * 10 : 0);

/** What was stored, read field by field, keeping the most recent days. */
export function activityFrom(v: unknown): Activity {
  if (!v || typeof v !== 'object') return {};
  const out: Activity = {};
  const keys = Object.keys(v as object)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort()
    .slice(-KEEP_DAYS);
  for (const k of keys) {
    const raw = (v as Record<string, Record<string, unknown>>)[k];
    if (!raw || typeof raw !== 'object') continue;
    const d = empty();
    for (const f of FIELDS) {
      const n = raw[f];
      d[f] = typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    }
    if (active(d)) out[k] = d;
  }
  return out;
}

/**
 * Two logs of the same days made into one.
 *
 * Each side is a copy of the same account's days, so the larger count is the
 * one that has seen more of the day — adding them would count twice what
 * both had.
 */
export function mergeActivity(a: Activity, b: Activity): Activity {
  const out: Activity = { ...a };
  for (const k in b) {
    const x = out[k];
    const y = b[k]!;
    if (!x) {
      out[k] = y;
      continue;
    }
    const d = empty();
    for (const f of FIELDS) d[f] = Math.max(x[f], y[f]);
    out[k] = d;
  }
  return out;
}

export interface Streak {
  /** days in a row, ending today or — if today is not done yet — yesterday */
  current: number;
  /** the longest run in the log */
  best: number;
  /** whether today already counts */
  today: boolean;
}

export function streakOf(a: Activity, now: number): Streak {
  const today = active(a[dayKey(now)]);
  let current = 0;
  for (let n = today ? 0 : 1; active(a[shift(now, n)]); n++) current++;

  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of Object.keys(a).sort()) {
    if (!active(a[k])) continue;
    const t = dayStart(k);
    // Consecutive when the gap is about a day; 20–28 hours covers the clock changes.
    run = prev !== null && t - prev < 28 * 3_600_000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return { current, best: Math.max(best, current), today };
}

export interface CalendarDay {
  key: string;
  /** 1–31, for a label */
  date: number;
  /** 0 nothing, 1–4 how much, relative to the busiest day shown */
  level: number;
  log: DayLog | undefined;
  today: boolean;
  /** after today: drawn empty, never shaded */
  future: boolean;
}

/**
 * The last few weeks as a grid, Monday first, a row per week, ending with
 * the week that holds today.
 */
export function calendar(a: Activity, now: number, weeks = 5): CalendarDay[][] {
  const todayKey = dayKey(now);
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  const sinceMonday = (d.getDay() + 6) % 7;
  const firstBack = sinceMonday + 7 * (weeks - 1);

  const days: CalendarDay[] = [];
  for (let n = firstBack; n > -(7 - sinceMonday); n--) {
    const key = shift(now, n);
    days.push({
      key,
      date: Number(key.slice(8)),
      level: 0,
      log: a[key],
      today: key === todayKey,
      future: n < 0,
    });
  }
  const busiest = Math.max(1, ...days.map((x) => dayWeight(x.log)));
  for (const x of days) {
    const w = dayWeight(x.log);
    x.level = !active(x.log) ? 0 : Math.min(4, 1 + Math.floor((3 * w) / busiest));
  }
  const rows: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}
