import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { isCharId, isWordId } from '../../domain/ids';
import { dueItemCount, REVIEW_SKILLS, throttleFor } from '../../domain/lesson';
import { isDue } from '../../domain/memory';
import { days as dayStats, goalStreak, weeklyNote } from '../../domain/stats';
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
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { useTitle } from '../../ui/useTitle';
import { calendar, dayKey, type CalendarDay } from '../../domain/activity';
import { latestChecks, nextPart, touchedAt } from '../../domain/video';
import { usePinyinMemory } from '../pinyin/voice';
import { spotPath, useWeakSpots, WeakSpotsCard } from '../pinyin/WeakSpots';
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
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const activity = useStore((s) => s.activity);
  const settings = useStore((s) => s.settings);
  const tallies = usePinyinMemory().tallies;
  const videos = useStore((s) => s.videos);
  const spots = useWeakSpots();

  // "Today" is fixed when the page opens, which is when a plan for the day is
  // made; the numbers follow the records as they change.
  const now = useMemo(() => Date.now(), []);
  const today = startOfToday(now);
  const weekStart = today - 6 * DAY_MS;

  const plan = useMemo(() => {
    // Items, not skills: the daily session asks one question per item.
    let charsDue = 0;
    let wordsDue = 0;
    for (const id in recall) {
      const sk = recall[id]!;
      const due = (isWordId(id) ? (['recognise'] as const) : REVIEW_SKILLS).some((s) => sk[s] && isDue(sk[s]!, now));
      if (!due) continue;
      if (isCharId(id) && lib.byChar.has(id.slice(1))) charsDue++;
      else if (isWordId(id)) wordsDue++;
    }
    return {
      charsDue,
      wordsDue,
      lesson: activity[dayKey(now)]?.lesson ?? null,
      answered: answeredSince(recall, today),
      started: startedSince(recall, today),
      read: readSince(texts, today),
      next: nextReading(texts, sets),
      videoToday: activity[dayKey(now)]?.videos ?? 0,
      // The video in hand: the one being worked on that was touched last.
      video: [...videos].filter((v) => v.status === 'working').sort((a, b) => touchedAt(b) - touchedAt(a))[0] ?? null,
      practised: Object.values(tallies).some((t) => (t.last ?? 0) >= today),
      progress: progressOf(lib, recall, learned, sheets, now),
      readWeek: readSince(texts, weekStart),
      checkedWeek: videos.reduce((n, v) => n + v.checks.filter((c) => c.at >= weekStart).length, 0),
    };
  }, [lib, recall, learned, sheets, now, today, weekStart, texts, sets, videos, activity, tallies]);

  const streak = useMemo(
    () => goalStreak(activity, now, { dailyGoal: settings.dailyGoal, goalMinutes: settings.goalMinutes, restDays: settings.restDays }),
    [activity, now, settings.dailyGoal, settings.goalMinutes, settings.restDays],
  );
  const note = useMemo(() => weeklyNote(dayStats(activity, recall, now, 21), now), [activity, recall, now]);
  const weeks = useMemo(() => calendar(activity, now, 5), [activity, now]);
  const coming = useMemo(() => forecast(recall, now, 7), [recall, now]);

  const due = plan.charsDue + plan.wordsDue;
  const throttle = throttleFor(dueItemCount(recall, now));
  const lessonSize = throttle === 'stop' ? 0 : throttle === 'half' ? Math.ceil(settings.newPerDay / 2) : settings.newPerDay;
  const learnedToday = plan.lesson?.done ? plan.lesson.ids.length : 0;
  // A session's worth of answers, or nothing left due, and the review is done for the day.
  const reviewDone = plan.answered > 0 && (!due || plan.answered >= settings.reviewMinutes * 5);
  const spot = spots.weak[0] ?? spots.untried[0] ?? null;
  const band = plan.progress.current;

  const video = plan.video;
  const videoPart = video ? nextPart(video) : 0;
  const videoChecked = video ? latestChecks(video).has(videoPart) : false;

  const steps: Step[] = [
    {
      id: 'review',
      mark: '复',
      title: due ? `Go over ${due} due` : 'Nothing due',
      detail: due
        ? [plan.charsDue && plural(plan.charsDue, 'character'), plan.wordsDue && plural(plan.wordsDue, 'word')].filter(Boolean).join(' and ') +
          ` — one mixed session, ${settings.reviewMinutes} minutes at most.`
        : plan.answered
          ? `${plural(plan.answered, 'answer')} given today. Everything is holding.`
          : 'Everything in rotation is holding.',
      done: reviewDone,
      minutes: due ? Math.min(settings.reviewMinutes, reviewMinutes(due)) : 0,
      to: due ? paths.reviewSession() : '#review',
      action: 'Review',
    },
    {
      id: 'new',
      mark: '新',
      title: learnedToday ? `Learned ${learnedToday} new` : lessonSize ? `Learn ${lessonSize} new` : 'Catch up first',
      detail: learnedToday
        ? 'They come back in review on their own schedule. More, if you like.'
        : throttle === 'stop'
          ? `${plural(due, 'item')} due — the lesson waits until the queue is shorter.`
          : throttle === 'half'
            ? `Fewer than usual: ${plural(due, 'item')} are due.`
            : band
              ? `Picture, sound, parts and a sentence each, then a few quick exercises. ${band.size - band.done} left in ${bandName(band.band)}.`
              : 'Picture, sound, parts and a sentence each, then a few quick exercises.',
      done: Boolean(plan.lesson?.done),
      minutes: lessonSize ? Math.ceil(lessonSize * 1.4) : 0,
      to: throttle === 'stop' && !learnedToday ? paths.reviewSession() : paths.learn(),
      action: learnedToday ? 'More' : 'Learn',
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
    // Only while a video is being worked on: a video is a sitting of its
    // own, a couple of times a week, not something every day asks for.
    ...(video
      ? [
          {
            id: 'video',
            mark: '视',
            title: `Your video: ${video.title}`,
            detail: plan.videoToday
              ? 'Worked on today.'
              : `${video.parts.length > 1 ? `Part ${videoPart + 1}: ` : ''}${videoChecked ? 'write it out again and check it' : 'write it out in your notebook and check it'}.`,
            done: plan.videoToday > 0,
            minutes: 20,
            to: paths.video(video.id, { part: videoPart }),
            action: 'Open',
          },
        ]
      : []),
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
            {' · '}
            <Link to={paths.stats()}>Your progress</Link>
          </p>
          {note && <p className="small today-note">{note}</p>}
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
            Rather talk? <Link to={paths.speakingNew()}>Have a conversation with Claude</Link>, or{' '}
            <Link to={paths.videos()}>work on a video</Link>.
          </p>

          <ReviewSection />
        </div>

        <aside className="today-side-col">
          <section className="today-card">
            <h2 className="today-label">Your days</h2>
            <Calendar weeks={weeks} />
            <p className="tiny muted" style={{ margin: '8px 0 0' }}>
              A day fills in when you review, read, practise out loud or work on a video. Darker is more.
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
              <dt>{plan.checkedWeek}</dt>
              <dd>{plan.checkedWeek === 1 ? 'video part' : 'video parts'} checked in the notebook</dd>
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
                    ? `${d.key}: ${d.log.answers} answers, ${d.log.spoken} said, ${d.log.read} read${d.log.videos ? `, ${d.log.videos} on videos` : ''}`
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
