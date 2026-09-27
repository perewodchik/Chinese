import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { dayKey, dayWeight, shift, type Activity, type DaySnap } from '../../domain/activity';
import { bandName, progressOf } from '../../domain/progress';
import {
  bucketed,
  days,
  daysToGo,
  goalMet,
  goalStreak,
  milestones,
  records,
  snapshotOf,
  SPAN,
  weekCompare,
  type Day,
  type Totals,
  type Unit,
} from '../../domain/stats';
import { itemInfo } from '../../domain/exercises/items';
import { leeches } from '../../domain/reviewSession';
import { wordBands } from '../../domain/wordProgress';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { BarChart, Legend, LineChart } from './charts';
import './stats.css';

const UNITS: Array<{ id: Unit; label: string }> = [
  { id: 'day', label: 'Days' },
  { id: 'week', label: 'Weeks' },
  { id: 'month', label: 'Months' },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmtDay = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

/**
 * How much has been learned, and how it is adding up — the page to open when
 * it feels like nothing is moving.
 *
 * Top to bottom: today against a usual day, the known count over time, what
 * each day added, this week against last, how firmly things are held, the
 * bands and the pace through them, the calendar, and the milestones. Every
 * number comes from `src/domain/stats.ts`; days reconstructed rather than
 * recorded are drawn dashed and said to be.
 */
export function StatsPage() {
  useTitle('Stats');
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const activity = useStore((s) => s.activity);
  const learned = useStore((s) => s.learned);
  const sheets = useStore((s) => s.sheets);
  const settings = useStore((s) => s.settings);
  const [unit, setUnit] = useState<Unit>('day');
  const now = useMemo(() => Date.now(), []);

  const history = useMemo(() => days(activity, recall, now, SPAN.month.days), [activity, recall, now]);
  const view = useMemo(() => bucketed(history.slice(-SPAN[unit].days), unit), [history, unit]);
  const goal = { dailyGoal: settings.dailyGoal, goalMinutes: settings.goalMinutes, restDays: settings.restDays };
  const streak = useMemo(
    () => goalStreak(activity, now, goal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activity, now, settings.dailyGoal, settings.goalMinutes, settings.restDays],
  );
  const progress = useMemo(() => progressOf(lib, recall, learned, sheets, now), [lib, recall, learned, sheets, now]);
  const words = useMemo(() => wordBands(lib, recall), [lib, recall]);
  const marks = useMemo(() => milestones(lib, activity, recall, now, history, streak), [lib, activity, recall, now, history, streak]);

  const goals = useMemo(() => {
    const chars = (b: number) => lib.characters.filter((c) => c.hsk <= b).length;
    const wordsTo = (b: number) => lib.words.filter((w) => w.hsk <= b).length;
    return [1, 2, 3].flatMap((b) => [
      { value: chars(b), label: `HSK ${b}`, series: 'chars' },
      { value: wordsTo(b), label: `HSK ${b}`, series: 'words' },
    ]);
  }, [lib]);

  const today = history[history.length - 1]!;
  const before = history.slice(-8, -1);
  const usual = (f: (d: Day) => number) => before.reduce((n, d) => n + f(d), 0) / Math.max(1, before.length);
  const dashedTo = view.reduce((last, b, i) => (b.estimated ? i : last), -1);
  const week = weekCompare(history);
  const rec = records(history);

  return (
    <div className="stats-page">
      <div className="row">
        <div>
          <h1>Your progress</h1>
          <div className="small muted">
            {plural(today.chars, 'character')} and {plural(today.words, 'word')} known.{' '}
            {streak.current > 0 ? `${plural(streak.current, 'day')} in a row.` : 'Start a run today.'}
          </div>
        </div>
        <div className="spacer" />
        <Link className="btn sm" to={paths.today()}>
          Today’s plan
        </Link>
      </div>

      <section className="st-tiles" aria-label="Today">
        <Tile
          label="New today"
          value={`${today.newChars + today.newWords}`}
          sub={`${plural(today.newChars, 'character')} · ${plural(today.newWords, 'word')}`}
          delta={today.newChars + today.newWords - usual((d) => d.newChars + d.newWords)}
        />
        <Tile
          label="Reviews"
          value={`${today.answers}`}
          sub={today.answers ? `${pct(today.right / today.answers)} right` : 'none yet'}
          delta={today.answers - usual((d) => d.answers)}
        />
        <Tile
          label="Minutes"
          value={`${Math.round(today.ms / 60_000)}`}
          sub={settings.dailyGoal === 'minutes' ? `goal ${settings.goalMinutes}` : 'working, today'}
          delta={(today.ms - usual((d) => d.ms)) / 60_000}
        />
        <Tile
          label="Streak"
          value={`${streak.current}`}
          sub={`best ${streak.best}${streak.today ? ' · today counts' : ''}`}
          accent={goalMet(activity[dayKey(now)], goal)}
        />
      </section>

      <section className="card st-card">
        <header className="st-head">
          <h2>Known over time</h2>
          <div className="spacer" />
          <Seg value={unit} options={UNITS} onChange={setUnit} size="sm" label="Show by" />
        </header>
        <div className="body">
          <Legend
            items={[
              { id: 'chars', name: 'Characters' },
              { id: 'words', name: 'Words' },
              ...(dashedTo >= 0 ? [{ id: 'est', name: 'Estimated', dashed: true }] : []),
            ]}
          />
          <LineChart
            label="Characters and words known over time"
            labels={view.map((b) => b.label)}
            series={[
              { id: 'chars', name: 'Characters', values: view.map((b) => b.chars) },
              { id: 'words', name: 'Words', values: view.map((b) => b.words) },
            ]}
            goals={goals}
            dashedTo={dashedTo}
            tip={(i) => {
              const b = view[i]!;
              const prev = view[i - 1];
              const d = (a: number, p?: number) => (p === undefined ? '' : ` (${a - p >= 0 ? '+' : ''}${a - p})`);
              return (
                <>
                  <b>{b.label}</b> · {b.chars} characters{d(b.chars, prev?.chars)}, {b.words} words
                  {d(b.words, prev?.words)}
                  {b.estimated && <span className="muted"> · estimated</span>}
                </>
              );
            }}
          />
          {dashedTo >= 0 && (
            <p className="tiny muted st-note">
              The dashed stretch is worked out from when each thing you know now was first met. From today the count
              is written down every evening.
            </p>
          )}
        </div>
      </section>

      <section className="card st-card">
        <header className="st-head">
          <h2>What each {unit} added</h2>
        </header>
        <div className="body st-pair">
          <div>
            <Legend
              items={[
                { id: 'chars', name: 'New characters' },
                { id: 'words', name: 'New words' },
              ]}
            />
            <BarChart
              label="New characters and words"
              labels={view.map((b) => b.label)}
              series={[
                { id: 'chars', name: 'New characters', values: view.map((b) => b.newChars) },
                { id: 'words', name: 'New words', values: view.map((b) => b.newWords) },
              ]}
              tip={(i) => (
                <>
                  <b>{view[i]!.label}</b> · {plural(view[i]!.newChars, 'character')}, {plural(view[i]!.newWords, 'word')}
                </>
              )}
            />
          </div>
          <div>
            <div className="st-legend">
              <span className="muted">Reviews answered</span>
            </div>
            <BarChart
              label="Reviews answered"
              labels={view.map((b) => b.label)}
              series={[{ id: 'reviews', name: 'Reviews', values: view.map((b) => b.answers) }]}
              tip={(i) => {
                const b = view[i]!;
                return (
                  <>
                    <b>{b.label}</b> · {plural(b.answers, 'answer')}
                    {b.answers ? `, ${pct(b.right / b.answers)} right` : ''} · {Math.round(b.ms / 60_000)} min
                  </>
                );
              }}
            />
          </div>
        </div>
      </section>

      <div className="st-split">
        <section className="card st-card">
          <header className="st-head">
            <h2>Last 7 days</h2>
            <span className="tiny muted">against the 7 before</span>
          </header>
          <div className="body">
            <WeekTable now={week.now} before={week.before} />
            <ul className="st-records">
              {rec.bestDay && (
                <li>
                  Best day: <b>{plural(rec.bestDay.items, 'new item')}</b>, {fmtDay(rec.bestDay.key)}
                </li>
              )}
              {rec.bestWeek && (
                <li>
                  Best week: <b>{plural(rec.bestWeek.items, 'new item')}</b>, from {fmtDay(rec.bestWeek.key)}
                </li>
              )}
              {rec.mostAnswers && (
                <li>
                  Most reviews in a day: <b>{rec.mostAnswers.answers}</b>, {fmtDay(rec.mostAnswers.key)}
                </li>
              )}
            </ul>
          </div>
        </section>

        <section className="card st-card">
          <header className="st-head">
            <h2>How firmly</h2>
            <span className="tiny muted">everything in rotation</span>
          </header>
          <div className="body">
            <Held label="Now" snap={snapshotOf(recall, now)} />
            <Held label="4 weeks ago" snap={snapBefore(activity, now, 28)} />
            <p className="tiny muted st-note">
              Just met → holding → solid is the scheduler’s own reading of how long each would last. Things move
              right as reviews space out.
            </p>
          </div>
        </section>
      </div>

      <section className="card st-card">
        <header className="st-head">
          <h2>Through the bands</h2>
        </header>
        <div className="body st-bands">
          {progress.bands.slice(0, 4).map((b) => {
            const w = words.find((x) => x.band === b.band);
            const left = b.size - b.done;
            const eta = daysToGo(history, left);
            return (
              <div key={b.band} className="st-band">
                <b>{bandName(b.band)}</b>
                <span className="st-band-bar" aria-hidden>
                  <i style={{ width: `${(b.done / Math.max(1, b.size)) * 100}%` }} />
                </span>
                <span className="small">
                  {b.done} / {b.size} characters
                  {w ? ` · ${w.done} / ${w.size} words` : ''}
                </span>
                <span className="tiny muted">
                  {left === 0 ? 'done' : eta === null ? 'no pace yet' : `at this pace, ~${eta < 14 ? plural(eta, 'day') : plural(Math.round(eta / 7), 'week')}`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card st-card">
        <header className="st-head">
          <h2>The last half-year</h2>
          <span className="tiny muted">
            {settings.dailyGoal === 'minutes' ? `a filled square is ${settings.goalMinutes} minutes or more` : 'a filled square is a day with work in it'}
            {settings.restDays ? ' · a ring is a rest day that kept the streak' : ''}
          </span>
        </header>
        <div className="body">
          <Calendar now={now} activity={activity} rested={streak.rested} />
        </div>
      </section>

      <Stubborn />

      <section className="card st-card">
        <header className="st-head">
          <h2>Milestones</h2>
        </header>
        <div className="body st-marks">
          {marks.map((m) => (
            <div key={m.id} className="st-mark" data-reached={m.reached !== null || undefined}>
              <span className="st-seal hanzi" aria-hidden>
                {m.mark}
              </span>
              <span>
                <b>{m.label}</b>
                <i className="tiny muted">
                  {m.reached === null
                    ? `${Math.max(0, m.need - m.have)} to go`
                    : m.reached
                      ? fmtDay(m.reached)
                      : 'reached'}
                </i>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Items missed four times or more: the ones asking the same way again is not fixing. */
function Stubborn() {
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const list = useMemo(() => leeches(recall).slice(0, 24), [recall]);
  if (!list.length) return null;
  return (
    <section className="card st-card">
      <header className="st-head">
        <h2>Stubborn</h2>
        <span className="tiny muted">missed four times or more</span>
        <div className="spacer" />
        <Link className="btn sm" to={`${paths.learn()}?again=${encodeURIComponent(list.slice(0, 8).map((l) => l.id).join(','))}`}>
          Meet {list.length > 8 ? 'eight of them' : list.length === 1 ? 'it' : 'them'} again
        </Link>
      </header>
      <div className="body st-stubborn">
        {list.map((l) => {
          const info = itemInfo(lib, l.id);
          return (
            <span key={l.id} className="st-stub">
              <b className="hanzi">{info?.text ?? l.id.slice(1)}</b>
              <i>{info?.py}</i>
              <span className="tiny muted">{l.lapses}×</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}

function Tile({ label, value, sub, delta, accent }: { label: string; value: string; sub: string; delta?: number; accent?: boolean }) {
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

function WeekTable({ now, before }: { now: Totals; before: Totals }) {
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

function Held({ label, snap }: { label: string; snap: DaySnap | null }) {
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
        <span className="tiny muted st-held-none">Not recorded yet — the app starts writing this down today.</span>
      )}
    </div>
  );
}

/** The snapshot as it stood `back` days ago: the latest one written on or before that day. */
function snapBefore(activity: Activity, now: number, back: number): DaySnap | null {
  const limit = shift(now, back);
  const key = Object.keys(activity)
    .filter((k) => k <= limit && activity[k]!.snap)
    .sort()
    .pop();
  return key ? activity[key]!.snap! : null;
}

const WEEKS = 26;

function Calendar({
  now,
  activity,
  rested,
}: {
  now: number;
  activity: Activity;
  rested: Set<string>;
}) {
  const todayKey = dayKey(now);
  const d = new Date(now);
  const sinceMonday = (d.getDay() + 6) % 7;
  const firstBack = sinceMonday + 7 * (WEEKS - 1);
  const cols: Array<Array<{ key: string; future: boolean }>> = [];
  for (let n = firstBack; n > firstBack - WEEKS * 7; n--) {
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
