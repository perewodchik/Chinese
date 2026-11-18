import { useMemo, useState } from 'react';
import { active, dayKey } from '../../domain/activity';
import { bandName, progressOf } from '../../domain/progress';
import {
  bucketed,
  days,
  daysToGo,
  goalMet,
  goalStreak,
  milestones,
  nearestMilestones,
  records,
  snapshotOf,
  SPAN,
  weekCompare,
  type Day,
  type Unit,
} from '../../domain/stats';
import { wordBands } from '../../domain/wordProgress';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { BarChart, Legend, LineChart } from './charts';
import { WhereYouAre } from './WhereYouAre';
import { Calendar, fmtDay, Held, pct, snapBefore, Tile, WeekTable } from './StatsCards';
import { WelcomeBack } from '../shared/WelcomeBack';
import { useUser } from '../auth/session';
import './stats.css';

const UNITS: Array<{ id: Unit; label: string }> = [
  { id: 'day', label: 'Days' },
  { id: 'week', label: 'Weeks' },
  { id: 'month', label: 'Months' },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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
  useTitle('Progress');
  const user = useUser();
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const activity = useStore((s) => s.activity);
  const learned = useStore((s) => s.learned);
  const sheets = useStore((s) => s.sheets);
  const settings = useStore((s) => s.settings);
  // Weeks by default: days are a fence of gaps for anyone who does not work every day (G2).
  const [unit, setUnit] = useState<Unit>('week');
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
  // The last reached and the two nearest, the rest a tap away (G4).
  const nearest = useMemo(() => nearestMilestones(marks), [marks]);
  const [allMarks, setAllMarks] = useState(false);

  const goals = useMemo(() => {
    const chars = (b: number) => lib.characters.filter((c) => c.hsk <= b).length;
    const wordsTo = (b: number) => lib.words.filter((w) => w.hsk <= b).length;
    return [1, 2, 3].flatMap((b) => [
      { value: chars(b), label: `HSK ${b}`, series: 'chars' },
      { value: wordsTo(b), label: `HSK ${b}`, series: 'words' },
    ]);
  }, [lib]);

  const today = history[history.length - 1]!;
  // Fewer than five days with any work: the charts would be zeros and flat lines, so a sentence stands in (G2).
  const practiceDays = Object.values(activity).filter((d) => active(d) || d.ms > 0).length;
  const charts = practiceDays >= 5;
  const before = history.slice(-8, -1);
  const usual = (f: (d: Day) => number) => before.reduce((n, d) => n + f(d), 0) / Math.max(1, before.length);
  const dashedTo = view.reduce((last, b, i) => (b.estimated ? i : last), -1);
  const week = weekCompare(history);
  const weekHasBoth = Object.values(week.now).some((v) => typeof v === 'number' && v > 0) && Object.values(week.before).some((v) => typeof v === 'number' && v > 0);
  const rec = records(history);

  return (
    <div className="stats-page">
      <div className="row">
        <div>
          <h1>Progress</h1>
          <div className="small muted">
            {plural(today.chars, 'character')} and {plural(today.words, 'word')} known.{' '}
            {streak.current > 0 ? `${plural(streak.current, 'day')} in a row.` : 'Start a run today.'}
          </div>
        </div>
      </div>

      <WelcomeBack />

      <WhereYouAre words={words} activity={activity} />

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
        {/* A streak from its second day; after a break the best run, never a zero (G2). */}
        {streak.current >= 2 ? (
          <Tile label="Streak" value={`${streak.current}`} sub={`best ${streak.best}${streak.today ? ' · today counts' : ''}`} accent={goalMet(activity[dayKey(now)], goal)} />
        ) : streak.best >= 2 ? (
          <Tile label="Best run" value={`${streak.best}`} sub={streak.today ? 'days · today counts' : 'days in a row'} accent={goalMet(activity[dayKey(now)], goal)} />
        ) : (
          <Tile label="Streak" value="—" sub="starts on the second day" accent={goalMet(activity[dayKey(now)], goal)} />
        )}
      </section>

      {charts ? (
        <>
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
              const d = (a: number, p?: number) => (p === undefined || a === p ? '' : ` (${a - p > 0 ? '+' : ''}${a - p})`);
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
                    <b>{b.label}</b>
                    {b.answers || b.ms ? (
                      <>
                        {' '}
                        · {plural(b.answers, 'answer')}
                        {b.answers ? `, ${pct(b.right / b.answers)} right` : ''} · {Math.round(b.ms / 60_000)} min
                      </>
                    ) : (
                      ' · nothing'
                    )}
                  </>
                );
              }}
            />
          </div>
        </div>
      </section>

        </>
      ) : (
        <section className="card st-card">
          <div className="body">
            <p className="small muted" style={{ margin: 0 }}>
              Charts appear after a few days of practice: {plural(practiceDays, 'day')} so far.
            </p>
          </div>
        </section>
      )}

      <div className="st-split">
        <section className="card st-card">
          <header className="st-head">
            <h2>Last 7 days</h2>
            <span className="tiny muted">against the 7 before</span>
          </header>
          <div className="body">
            {/* Nothing against nothing, or something against a break, compares nothing (G2). */}
            {weekHasBoth ? <WeekTable now={week.now} before={week.before} /> : <p className="small muted" style={{ margin: 0 }}>A week against the one before, once both have work in them.</p>}
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
            {snapBefore(activity, now, 28) && <Held label="4 weeks ago" snap={snapBefore(activity, now, 28)} />}
            <p className="tiny muted st-note">
              Solid: you would still know it in a month. Holding: in a week or two. Just met or shaky: it needs seeing
              again soon.
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
          <h2>{now - user.createdAt < 30 * 86_400_000 ? 'Since you started' : 'The last half-year'}</h2>
          <span className="tiny muted">
            {settings.dailyGoal === 'minutes' ? `a filled square is ${settings.goalMinutes} minutes or more` : 'a filled square is a day with work in it'}
            {settings.restDays ? ' · a ring is a rest day that kept the streak' : ''}
          </span>
        </header>
        <div className="body">
          <Calendar now={now} activity={activity} rested={streak.rested} since={user.createdAt} />
        </div>
      </section>

      <section className="card st-card">
        <header className="st-head">
          <h2>Milestones</h2>
        </header>
        <div className="body st-marks">
          {(allMarks ? marks : [...(nearest.last ? [nearest.last] : []), ...nearest.next]).map((m) => (
            <div key={m.id} className="st-mark" data-reached={m.reached !== null || undefined}>
              <span className="st-seal hanzi" aria-hidden>
                {m.mark}
              </span>
              <span>
                <b>{m.label}</b>
                <i className="tiny muted">
                  {m.reached === null
                    ? `${Math.min(m.have, m.need).toLocaleString('en')} of ${m.need.toLocaleString('en')}`
                    : m.reached
                      ? fmtDay(m.reached)
                      : 'reached'}
                </i>
                {m.reached === null && (
                  <span className="st-mark-bar" aria-hidden>
                    <i style={{ width: `${Math.min(1, m.have / Math.max(1, m.need)) * 100}%` }} />
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="body st-marks-more">
          <button className="btn quiet sm" aria-expanded={allMarks} onClick={() => setAllMarks((a) => !a)}>
            {allMarks ? 'The nearest only' : `All ${marks.length} milestones`}
          </button>
        </div>
      </section>
    </div>
  );
}
