import { dayKey, dayWeight, shift, type Activity, type DaySnap } from '../../domain/activity';
import type { Totals } from '../../domain/stats';

/** Progress's smaller pieces: a number tile, this week beside the last, what is held, and the calendar of days. */

/** A day's key as a short date: 18 Nov. */
export const fmtDay = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

export function Tile({ label, value, sub, delta, accent }: { label: string; value: string; sub: string; delta?: number; accent?: boolean }) {
  const d = delta === undefined ? null : Math.round(delta);
  return (
    <div className="st-tile" data-accent={accent || undefined}>
      <span className="st-tile-label">{label}</span>
      <b className="st-tile-value">{value}</b>
      <span className="tiny muted">{sub}</span>
      <span className="tiny st-delta" data-dir={d === null || d === 0 ? undefined : d > 0 ? 'up' : 'down'}>
        {d === null ? ' ' : d === 0 ? 'as usual' : `${d > 0 ? '+' : '−'}${Math.abs(d)} vs usual`}
      </span>
    </div>
  );
}

export function WeekTable({ now, before }: { now: Totals; before: Totals }) {
  const rows: Array<[string, number | null, number | null, (x: number | null) => string]> = [
    ['New characters', now.newChars, before.newChars, String],
    ['New words', now.newWords, before.newWords, String],
    ['Reviews', now.answers, before.answers, String],
    ['Right', now.accuracy, before.accuracy, pct],
    ['Minutes', now.minutes, before.minutes, String],
    ['Days worked', now.activeDays, before.activeDays, String],
  ];
  return (
    <table className="st-week">
      <thead>
        <tr>
          <th />
          <th>Last 7</th>
          <th>7 before</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, a, b, f]) => {
          const diff = a !== null && b !== null ? a - b : null;
          return (
            <tr key={name}>
              <th>{name}</th>
              <td>{f(a)}</td>
              <td className="muted">{f(b)}</td>
              <td className="st-delta" data-dir={!diff ? undefined : diff > 0 ? 'up' : 'down'}>
                {!diff ? '' : diff > 0 ? '▲' : '▼'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const HELD: Array<{ id: keyof DaySnap; name: string }> = [
  { id: 'fresh', name: 'Just met' },
  { id: 'shaky', name: 'Shaky' },
  { id: 'holding', name: 'Holding' },
  { id: 'solid', name: 'Solid' },
];

export function Held({ label, snap }: { label: string; snap: DaySnap | null }) {
  const total = snap ? HELD.reduce((n, h) => n + snap[h.id], 0) : 0;
  return (
    <div className="st-held">
      <span className="tiny muted">{label}</span>
      {snap && total ? (
        <>
          <span className="st-held-bar" role="img" aria-label={HELD.map((h) => `${h.name} ${snap[h.id]}`).join(', ')}>
            {HELD.map((h) => (snap[h.id] ? <i key={h.id} data-band={h.id} style={{ flexGrow: snap[h.id] }} /> : null))}
          </span>
          <span className="st-held-key tiny">
            {HELD.map((h) => (
              <span key={h.id} data-band={h.id}>
                <i />
                {h.name} {snap[h.id]}
              </span>
            ))}
          </span>
        </>
      ) : (
        <span className="tiny muted st-held-none">Nothing in rotation yet.</span>
      )}
    </div>
  );
}

/** The snapshot as it stood `back` days ago: the latest one written on or before that day. */
export function snapBefore(activity: Activity, now: number, back: number): DaySnap | null {
  const limit = shift(now, back);
  const key = Object.keys(activity)
    .filter((k) => k <= limit && activity[k]!.snap)
    .sort()
    .pop();
  return key ? activity[key]!.snap! : null;
}

const WEEKS = 26;

export function Calendar({
  now,
  activity,
  rested,
  since,
}: {
  now: number;
  activity: Activity;
  rested: Set<string>;
  /** when the account was made: one younger than thirty days sees only its own weeks (G6) */
  since: number;
}) {
  const todayKey = dayKey(now);
  const d = new Date(now);
  const sinceMonday = (d.getDay() + 6) % 7;
  const ageDays = Math.floor((now - since) / 86_400_000);
  const weeks = ageDays < 30 ? Math.min(WEEKS, Math.ceil((ageDays - sinceMonday) / 7) + 1) : WEEKS;
  const WEEKS_SHOWN = Math.max(1, weeks);
  const firstBack = sinceMonday + 7 * (WEEKS_SHOWN - 1);
  const cols: Array<Array<{ key: string; future: boolean }>> = [];
  for (let n = firstBack; n > firstBack - WEEKS_SHOWN * 7; n--) {
    const i = firstBack - n;
    (cols[Math.floor(i / 7)] ??= []).push({ key: shift(now, n), future: n < 0 });
  }
  const busiest = Math.max(1, ...cols.flat().map((c) => dayWeight(activity[c.key])));
  return (
    <div className="st-cal" role="img" aria-label="Days worked over the last 26 weeks">
      {cols.map((col, ci) => (
        <div key={ci} className="st-cal-col">
          {col.map((c) => {
            const w = dayWeight(activity[c.key]);
            const level = w ? Math.min(4, 1 + Math.floor((3 * w) / busiest)) : 0;
            return (
              <i
                key={c.key}
                title={`${fmtDay(c.key)}${w ? `: ${activity[c.key]!.answers} answers` : ''}`}
                data-level={level || undefined}
                data-rest={rested.has(c.key) || undefined}
                data-today={c.key === todayKey || undefined}
                data-future={c.future || undefined}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
