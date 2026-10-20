import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { dayKey } from '../../domain/activity';
import { DAY } from '../../domain/memory';
import { touchedAt } from '../../domain/video';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { AccountMenu } from '../auth/AccountMenu';
import { useCardsToday } from '../cards/CardsPage';
import { useContinue } from '../reader/ReadPage';
import { useStanding } from '../reader/Passage';
import { partFill, PARTS } from '../reader/TextParts';
import type { ItemId } from '../../domain/ids';
import './today.css';

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The front door, kept light on purpose: one thing to carry on with — the
 * text you were reading — and one small thing — today's cards — and nothing
 * that counts what was missed.
 *
 * It used to be a plan of four or five steps, a ring of how many were done,
 * the review's every drill, a forecast and a calendar. All of it was true,
 * and together it said "you are behind" every time the app opened, which is
 * the one thing that keeps somebody from opening it. The rest is still there,
 * a tap away: Cards for the drills, Your progress for the calendar.
 */
export function TodayPage() {
  useTitle('Today');
  const now = useMemo(() => Date.now(), []);
  const go = useContinue();
  const cards = useCardsToday();
  const activity = useStore((s) => s.activity);
  const videos = useStore((s) => s.videos);
  const sets = useStore((s) => s.sets);
  const study = useMemo(() => new Set<ItemId>(sets.find((s) => s.id === go?.set?.id)?.study ?? []), [sets, go?.set?.id]);
  const standing = useStanding(study);
  const video = useMemo(
    () => [...videos].filter((v) => v.status === 'working').sort((a, b) => touchedAt(b) - touchedAt(a))[0] ?? null,
    [videos],
  );
  const date = new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, k) => {
        const at = now - (6 - k) * DAY;
        const log = activity[dayKey(at)];
        const worked = Boolean(log && (log.answers || log.read || log.spoken || log.videos || log.ms > 60_000));
        return { key: dayKey(at), label: WEEKDAY[new Date(at).getDay()]!, worked, today: k === 6 };
      }),
    [activity, now],
  );
  const worked = days.filter((d) => d.worked).length;

  const fill = go ? partFill(go.text, standing) : null;
  const firstLine = go?.text.lines.slice(0, 2).map((l) => l.zh).join('') ?? '';

  return (
    <div className="today2">
      <header className="today2-head">
        <div className="grow">
          <p className="small muted">{date}</p>
          <h1>Today</h1>
        </div>
        <div className="today2-account">
          <AccountMenu />
        </div>
      </header>

      {go ? (
        <section className="today2-read">
          <p className="small muted">Continue reading{go.set ? ` in ${go.set.name}` : ''}</p>
          <h2 className="hanzi">{go.text.titleZh || go.text.title}</h2>
          <p className="hanzi today2-excerpt">{firstLine}</p>
          {fill && (
            <div className="today2-parts" aria-label="Parts of this text">
              {PARTS.map((p) => (
                <span key={p.id} style={{ '--fill': `${Math.round(fill[p.id] * 100)}%` } as CSSProperties} data-started={fill[p.id] > 0 || undefined}>
                  <span className="hanzi">{p.han}</span>
                  <i />
                </span>
              ))}
            </div>
          )}
          <Link className="btn primary lg today2-go" to={go.to}>
            Continue reading
          </Link>
        </section>
      ) : (
        <section className="today2-read">
          <h2>Something to read</h2>
          <p className="muted">Claude can write a few short texts out of the characters you know.</p>
          <Link className="btn primary lg today2-go" to={paths.read()}>
            Go to Read
          </Link>
        </section>
      )}

      <section className="today2-cards">
        <div className="deck-stack small" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="hanzi" data-i={i}>
              {i === 0 ? (cards.plan.cards[0] ? cards.plan.cards[0].id.slice(1, 2) : '好') : ''}
            </span>
          ))}
        </div>
        <div className="grow">
          <h2>Cards</h2>
          {cards.count ? (
            <>
              <p className="small">
                {cards.count} for today, about {cards.minutes} minute{cards.minutes === 1 ? '' : 's'}
              </p>
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                <Link className="btn tonal sm" to={paths.cardSession()}>
                  Start
                </Link>
                {cards.count > 10 && (
                  <Link className="btn quiet sm" to={paths.cardSession({ n: 10 })}>
                    Only 10 today
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="small">{cards.done ? 'Done for today.' : 'Nothing to ask yet.'}</p>
              {cards.done && (
                <div className="row" style={{ marginTop: 10 }}>
                  <Link className="btn quiet sm" to={paths.cardSession({ n: 10 })}>
                    10 more
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="today2-week">
        <div className="row">
          <h2>Last 7 days</h2>
          <span className="spacer" />
          <span className="small muted">
            {worked} day{worked === 1 ? '' : 's'} with practice
          </span>
        </div>
        <ol className="week-strip">
          {days.map((d) => (
            <li key={d.key} data-worked={d.worked || undefined} data-today={d.today || undefined}>
              <i />
              <span className="tiny muted">{d.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <nav className="list today2-more" aria-label="When there is more time">
        <Link className="way-row" to={paths.speakingNew()}>
          <span className="hanzi way-mark">说</span>
          <span className="grow">Talk with Claude</span>
          <Icon name="chevron" className="muted" />
        </Link>
        {video && (
          <Link className="way-row" to={paths.video(video.id)}>
            <span className="hanzi way-mark">视</span>
            <span className="grow">Your video: {video.title}</span>
            <Icon name="chevron" className="muted" />
          </Link>
        )}
        <Link className="way-row" to={paths.stats()}>
          <span className="hanzi way-mark">进</span>
          <span className="grow">Your progress</span>
          <Icon name="chevron" className="muted" />
        </Link>
      </nav>
    </div>
  );
}
