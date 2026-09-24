import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { calendar, streakOf, type CalendarDay } from '../../domain/activity';
import { reviewPool, summarise } from '../../domain/drill';
import { SKILLS } from '../../domain/memory';
import { bandName, progressOf } from '../../domain/progress';
import {
  answeredSince,
  forecast,
  nextReading,
  readSince,
  reviewMinutes,
  startedSince,
  startOfToday,
  type ForecastDay,
} from '../../domain/today';
import { summariseWords } from '../../domain/wordReview';
import { paths } from '../../navigation/paths';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { useTitle } from '../../ui/useTitle';
import { useSaidLog } from '../pinyin/progress';
import { usePinyinMemory } from '../pinyin/voice';
import { spotPath, useWeakSpots, WeakSpotsCard } from '../pinyin/WeakSpots';
import { nextSitting } from '../review/drills';
import { ReviewSection } from '../review/ReviewPage';
import { useLibrary } from '../shared/library';
import './today.css';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const DAY_MS = 86_400_000;

interface Step {
  id: string;
  mark: string;
  title: string;
  detail: ReactNode;
  done: boolean;
  /** what doing it would take, in minutes; 0 when there is nothing to estimate */
  minutes: number;
  to: string;
  action: string;
  onGo?: () => void;
}

/**
 * The front door: the day's plan, and everything Review can ask, on one page.
 *
 * Everywhere else the learner decides what to do. Here the app does, from
 * what it already knows — what is due, where pronunciation keeps going wrong,
 * which text is next — in the order that serves a short daily sitting best:
 * recall first while it is due, something new while the head is fresh, the
 * weakest sound while the mouth is warm, then reading, then whole sentences
 * out loud. One button carries on from wherever the day has got to. Each
 * step ticks itself off once it has happened today, read off records the
 * app already keeps; the days themselves are kept too, so a run of them can
 * be seen and kept going.
 */
export function TodayPage() {
  useTitle('Today');
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const learned = useStore((s) => s.learned);
  const sheets = useStore((s) => s.sheets);
  const collections = useStore((s) => s.collections);
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const activity = useStore((s) => s.activity);
  const perDay = useStore((s) => s.settings.newWordsPerDay);
  const tallies = usePinyinMemory().tallies;
  const said = useSaidLog();
  const spots = useWeakSpots();

  // "Today" is fixed when the page opens, which is when a plan for the day is
  // made; the numbers follow the records as they change.
  const now = useMemo(() => Date.now(), []);
  const today = startOfToday(now);
  const weekStart = today - 6 * DAY_MS;

  const plan = useMemo(() => {
    const pool = reviewPool(lib, recall);
    const counts = summarise(recall, pool, SKILLS, now);
    return {
      charsDue: SKILLS.reduce((n, s) => n + counts[s].due, 0),
      first: nextSitting(lib, recall, learned, collections, perDay, now),
      words: summariseWords(recall, collections, perDay, now),
      answered: answeredSince(recall, today),
      started: startedSince(recall, today),
      read: readSince(texts, today),
      next: nextReading(texts, sets),
      spoken: said.filter((s) => s.at >= today).length,
      practised: Object.values(tallies).some((t) => (t.last ?? 0) >= today),
      progress: progressOf(lib, recall, learned, sheets, now),
      readWeek: readSince(texts, weekStart),
      saidWeek: said.filter((s) => s.at >= weekStart).length,
    };
  }, [lib, recall, learned, sheets, collections, perDay, now, today, weekStart, texts, sets, said, tallies]);

  const streak = useMemo(() => streakOf(activity, now), [activity, now]);
  const weeks = useMemo(() => calendar(activity, now, 5), [activity, now]);
  const coming = useMemo(() => forecast(recall, now, 7), [recall, now]);

  const due = plan.charsDue + plan.words.due;
  const spot = spots.weak[0] ?? spots.untried[0] ?? null;
  const band = plan.progress.current;

  const steps: Step[] = [
    {
      id: 'review',
      mark: '复',
      title: due ? `Go over ${due} due` : 'Nothing due',
      detail: due
        ? [plan.charsDue && plural(plan.charsDue, 'character'), plan.words.due && plural(plan.words.due, 'word')]
            .filter(Boolean)
            .join(' and ') + (plan.words.fresh ? `, and ${plural(plan.words.fresh, 'new word')}` : '')
        : plan.answered
          ? `${plural(plan.answered, 'answer')} given today. Everything is holding.`
          : plan.words.fresh
            ? `${plural(plan.words.fresh, 'new word')} waiting for today.`
            : 'Everything in rotation is holding.',
      done: !due && plan.answered > 0,
      minutes: reviewMinutes(due + plan.words.fresh),
      // Straight into the first sitting with something due; each sitting
      // ends by offering the next, so this is one run through all of them.
      to: plan.first
        ? plan.first.id === 'words'
          ? paths.wordDrill()
          : paths.drill(plan.first.id)
        : plan.words.fresh
          ? paths.wordDrill()
          : '#review',
      action: 'Review',
    },
    {
      id: 'new',
      mark: '新',
      title: 'Meet new characters',
      detail: plan.started
        ? `${plural(plan.started, 'character')} started today.`
        : band
          ? `${band.size - band.done} left in ${bandName(band.band)}. Pick three or four whose parts you know.`
          : 'Every band is learned.',
      done: plan.started > 0,
      minutes: 4,
      to: `${paths.library()}?show=ready`,
      onGo: band ? () => setSettings({ hskBand: band.band }) : undefined,
      action: 'Choose',
    },
    {
      id: 'spot',
      mark: '声',
      title: spot ? `${spots.weak[0] ? 'Practise' : 'Try'} ${spot.title.toLowerCase()}` : 'Practise a sound',
      detail: spot
        ? spots.weak[0]
          ? spot.score === null
            ? `Your weakest spot: ${spot.detail}.`
            : `Your weakest spot: ${Math.round(spot.score * 100)}% right lately.`
          : 'Not tried yet on this device.'
        : 'Pick anything on the Speaking page.',
      done: plan.practised,
      minutes: 5,
      to: spot ? spotPath(spot.target) : paths.speaking(),
      action: 'Practise',
    },
    plan.next
      ? {
          id: 'read',
          mark: '读',
          title: `Read ${plan.next.titleZh || plan.next.title}`,
          detail: plan.read
            ? `${plural(plan.read, 'text')} read today.`
            : plan.next.titleZh
              ? plan.next.title
              : 'The next text on your shelf.',
          done: plan.read > 0,
          minutes: 5,
          to: paths.text(plan.next.id),
          action: 'Read',
        }
      : {
          id: 'read',
          mark: '读',
          title: texts.length ? 'Everything is read' : 'Nothing to read yet',
          detail: plan.read
            ? `${plural(plan.read, 'text')} read today.`
            : 'Write a few texts out of the characters you know.',
          done: plan.read > 0,
          minutes: 0,
          to: paths.session(),
          action: 'Write texts',
        },
    {
      id: 'say',
      mark: '说',
      title: 'Say sentences out loud',
      detail: plan.spoken
        ? `${plural(plan.spoken, 'sentence')} said today.`
        : 'Shadow a native speaker, or talk with Claude.',
      done: plan.spoken > 0,
      minutes: 5,
      to: paths.speakingShadow(),
      action: 'Shadow',
    },
  ];

  const left = steps.filter((s) => !s.done);
  const next = left[0] ?? null;
  const minutes = left.reduce((n, s) => n + s.minutes, 0);
  const finished = steps.length - left.length;
  const date = new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="today">
      <header className="today-hero" data-done={!next || undefined}>
        <Ring done={finished} total={steps.length} />
        <div className="today-hero-text">
          <h1>{next ? (finished ? 'Keep going' : 'Today') : 'Done for today'}</h1>
          <p className="small muted">
            {date}
            {next && minutes > 0 && <> · about {minutes} minutes left</>}
          </p>
          <p className="today-streak small">
            {streak.current ? (
              <>
                <b>{plural(streak.current, 'day')}</b> in a row
                {!streak.today && ' — today keeps it going'}
              </>
            ) : (
              'Start a run of days today'
            )}
            {streak.best > streak.current && <span className="muted"> · best {streak.best}</span>}
          </p>
        </div>
        {next ? (
          <Link className="btn primary today-go" to={next.to} onClick={next.onGo}>
            <span className="today-go-what">
              {`${finished ? 'Continue' : 'Start'}: ${next.title.replace(/^./, (c) => c.toLowerCase())}`}
            </span>
          </Link>
        ) : (
          <span className="today-seal hanzi" aria-label="All done">
            好
          </span>
        )}
      </header>

      <div className="today-grid">
        <div className="today-main-col">
          <h2 className="today-label">The plan</h2>
          <ol className="today-steps">
            {steps.map((s) => (
              <li key={s.id} data-done={s.done || undefined} data-next={s === next || undefined}>
                <Link className="today-step" to={s.to} onClick={s.onGo}>
                  <span className="today-mark hanzi" aria-hidden>
                    {s.done ? '✓' : s.mark}
                  </span>
                  <span className="today-main">
                    <b>{s.title}</b>
                    <span className="small muted">{s.detail}</span>
                  </span>
                  <span className="today-side">
                    {!s.done && s.minutes > 0 && <span className="tiny muted">{s.minutes} min</span>}
                    <span className="btn sm">{s.done ? 'Again' : s.action}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="tiny muted today-aside">
            Rather talk? <Link to={paths.speakingNew()}>Have a conversation with Claude</Link> instead of shadowing.
          </p>

          <ReviewSection />
        </div>

        <aside className="today-side-col">
          <section className="today-card">
            <h2 className="today-label">Your days</h2>
            <Calendar weeks={weeks} />
            <p className="tiny muted" style={{ margin: '8px 0 0' }}>
              A day fills in when you review, read or practise out loud. Darker is more.
            </p>
          </section>

          <section className="today-card">
            <h2 className="today-label">Coming up</h2>
            <Forecast days={coming} />
          </section>

          {spots.weak.length > 1 && <WeakSpotsCard />}

          <section className="today-card">
            <h2 className="today-label">This week</h2>
            <dl className="today-week">
              <dt>{plan.progress.week.answered}</dt>
              <dd>characters answered in review</dd>
              <dt>{plan.progress.week.started}</dt>
              <dd>new characters started</dd>
              <dt>{plan.readWeek}</dt>
              <dd>{plan.readWeek === 1 ? 'text' : 'texts'} read</dd>
              <dt>{plan.saidWeek}</dt>
              <dd>{plan.saidWeek === 1 ? 'sentence' : 'sentences'} said out loud</dd>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** How much of the day's plan is done, as a ring. */
function Ring({ done, total }: { done: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg className="today-ring" viewBox="0 0 64 64" role="img" aria-label={`${done} of ${total} steps done`}>
      <circle cx="32" cy="32" r={r} className="track" />
      {done > 0 && (
        <circle
          cx="32"
          cy="32"
          r={r}
          className="fill"
          strokeDasharray={`${(c * done) / total} ${c}`}
          transform="rotate(-90 32 32)"
        />
      )}
      <text x="32" y="37" textAnchor="middle">
        {done}/{total}
      </text>
    </svg>
  );
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The last five weeks, a square a day, shaded by how much was done. */
function Calendar({ weeks }: { weeks: CalendarDay[][] }) {
  return (
    <div className="cal" role="table" aria-label="Days practised over the last five weeks">
      <div className="cal-row cal-head" role="row">
        {WEEKDAYS.map((d, i) => (
          <span key={i} role="columnheader">
            {d}
          </span>
        ))}
      </div>
      {weeks.map((row) => (
        <div key={row[0]!.key} className="cal-row" role="row">
          {row.map((d) => (
            <span
              key={d.key}
              role="cell"
              className="cal-day"
              data-level={d.level}
              data-today={d.today || undefined}
              data-future={d.future || undefined}
              title={
                d.future
                  ? undefined
                  : d.log
                    ? `${d.key}: ${d.log.answers} answers, ${d.log.spoken} said, ${d.log.read} read`
                    : `${d.key}: nothing`
              }
            >
              {d.date}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Questions falling due over the next seven days, as bars. */
function Forecast({ days }: { days: ForecastDay[] }) {
  const most = Math.max(1, ...days.map((d) => d.due));
  const total = days.reduce((n, d) => n + d.due, 0);
  return (
    <>
      <div className="forecast" role="img" aria-label={`Due each day this week: ${days.map((d) => d.due).join(', ')}`}>
        {days.map((d, i) => (
          <div key={d.start} className="forecast-day" data-today={i === 0 || undefined}>
            <span className="forecast-n tiny">{d.due || ''}</span>
            <span className="forecast-bar">
              <i style={{ height: `${(d.due / most) * 100}%` }} />
            </span>
            <span className="tiny muted">
              {i === 0 ? 'today' : new Date(d.start).toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
          </div>
        ))}
      </div>
      <p className="tiny muted" style={{ margin: '8px 0 0' }}>
        {total
          ? `${total} questions this week, before anything new is added. Today's bar counts everything due by midnight, not only what is due now.`
          : 'Nothing falls due this week.'}
      </p>
    </>
  );
}
