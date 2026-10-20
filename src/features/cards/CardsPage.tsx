import { useMemo } from 'react';
import { Link } from 'react-router';
import { CARD_SIZES, CARD_SKILLS, planCards } from '../../domain/cards';
import { idValue } from '../../domain/ids';
import { NEW_PER_DAY } from '../../domain/lesson';
import { pendingSheets } from '../../domain/memory';
import { paths } from '../../navigation/paths';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { DRILLS } from '../review/drills';
import { useLibrary } from '../shared/library';
import { ASKS } from './asks';
import { minutesFor } from './CardSession';
import './cards.css';

/** The day's cards, as Today and the Cards tab both show them. */
export function useCardsToday() {
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const sets = useStore((s) => s.sets);
  const size = useStore((s) => s.settings.cardsPerDay);
  const newPerDay = useStore((s) => s.settings.newPerDay);
  const skills = useStore((s) => s.settings.cardSkills);
  return useMemo(() => {
    const plan = planCards(lib, recall, sets, Date.now(), { size, newPerDay, skills });
    return {
      plan,
      count: plan.cards.length,
      minutes: minutesFor(plan.cards.length),
      done: plan.answeredToday > 0 && plan.cards.length === 0,
      inRotation: Object.keys(recall).length,
    };
  }, [lib, recall, sets, size, newPerDay, skills]);
}

/**
 * The Cards tab: today's cards, how many a day, and — folded away — the
 * other ways to practise that used to crowd the front page.
 */
export function CardsPage() {
  useTitle('Cards');
  const today = useCardsToday();
  const settings = useStore((s) => s.settings);
  const sheets = useStore((s) => s.sheets);
  const waiting = pendingSheets(sheets);
  const next = today.plan.cards.slice(0, 3).map((c) => idValue(c.id));

  return (
    <div className="cards-page">
      <header className="page-head">
        <h1>Cards</h1>
      </header>

      <section className="deck">
        <div className="deck-stack" aria-hidden>
          {(next.length ? next : ['好', '学', '读']).slice(0, 3).map((t, i) => (
            <span key={i} className="hanzi" data-i={i}>
              {i === 0 ? t : ''}
            </span>
          ))}
        </div>
        <div className="deck-text">
          {today.count ? (
            <>
              <h2>{today.count} for today</h2>
              <p className="muted">
                About {today.minutes} minute{today.minutes === 1 ? '' : 's'}
                {today.plan.cards.some((c) => c.fresh) ? `, ${today.plan.cards.filter((c) => c.fresh).length} of them new` : ''}.
              </p>
              <div className="deck-actions">
                <Link className="btn primary lg" to={paths.cardSession()}>
                  Start
                </Link>
                {today.count > 10 && (
                  <Link className="btn quiet" to={paths.cardSession({ n: 10 })}>
                    Only 10
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <h2>{today.done ? 'Done for today' : 'Nothing to ask yet'}</h2>
              <p className="muted">
                {today.done
                  ? `${today.plan.answeredToday} answered. The rest wait for tomorrow.`
                  : 'Cards come from the words you choose to learn while reading.'}
              </p>
              <div className="deck-actions">
                {today.done ? (
                  <Link className="btn tonal" to={paths.cardSession({ n: 10 })}>
                    10 more
                  </Link>
                ) : (
                  <Link className="btn tonal" to={paths.read()}>
                    Go to Read
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="block">
        <h2 className="block-title">What the cards ask</h2>
        <div className="list">
          {ASKS.map((a) => {
            const on = settings.cardSkills.includes(a.skill);
            // A deck that asks nothing is not a choice: the last kind stays on.
            const last = on && settings.cardSkills.length === 1;
            return (
              <label key={a.skill} className="ask-row" title={last ? 'At least one kind of card stays on' : undefined}>
                <span className="hanzi way-mark" aria-hidden>
                  {a.mark}
                </span>
                <span className="grow">
                  <b>{a.name}</b>
                  <span className="small muted">{a.blurb}</span>
                </span>
                <input
                  type="checkbox"
                  className="ask-input"
                  checked={on}
                  disabled={last}
                  onChange={() =>
                    setSettings({
                      cardSkills: on ? settings.cardSkills.filter((k) => k !== a.skill) : CARD_SKILLS.filter((k) => k === a.skill || settings.cardSkills.includes(k)),
                    })
                  }
                />
                <span className="ask-box" aria-hidden>
                  <Icon name="check" size={18} />
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="block">
        <h2 className="block-title">Your deck</h2>
        <div className="list deck-settings">
          <div className="deck-row">
            <span className="grow">
              Cards a day
              <small>What is due beyond this waits for another day.</small>
            </span>
            <div className="seg sm" role="group" aria-label="Cards a day">
              {CARD_SIZES.map((n) => (
                <button key={n} aria-pressed={settings.cardsPerDay === n} onClick={() => setSettings({ cardsPerDay: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="deck-row">
            <span className="grow">
              New words a day
              <small>From the words you chose on your shelves.</small>
            </span>
            <div className="seg sm" role="group" aria-label="New words a day">
              {NEW_PER_DAY.slice(0, 4).map((n) => (
                <button key={n} aria-pressed={settings.newPerDay === n} onClick={() => setSettings({ newPerDay: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="deck-row">
            <span className="grow">
              In the deck
              <small>
                {today.inRotation} characters and words
                {today.plan.waiting.length ? `, and ${today.plan.waiting.length} chosen on your shelves waiting to be met` : ''}.
              </small>
            </span>
          </div>
        </div>
      </section>

      <details className="block other-ways">
        <summary>
          <h2 className="block-title">Other ways to practise</h2>
        </summary>
        <div className="list">
          {DRILLS.map((d) => (
            <Link key={d.id} className="way-row" to={paths.drill(d.id)}>
              <span className="hanzi way-mark">{d.mark}</span>
              <span className="grow">
                <b>{d.name}</b>
                <span className="small muted">{d.blurb}</span>
              </span>
            </Link>
          ))}
          <Link className="way-row" to={paths.sweep()}>
            <span className="hanzi way-mark">分</span>
            <span className="grow">
              <b>Sort the HSK words</b>
              <span className="small muted">Known, not sure, new: a screenful at a time.</span>
            </span>
          </Link>
          <Link className="way-row" to={paths.learn()}>
            <span className="hanzi way-mark">新</span>
            <span className="grow">
              <b>A lesson of new characters</b>
              <span className="small muted">Picture, sound, parts and a sentence each.</span>
            </span>
          </Link>
          {waiting.map((w) => (
            <Link key={w.id} className="way-row" to={paths.gradeSheet(w.id)}>
              <span className="hanzi way-mark">纸</span>
              <span className="grow">
                <b>Mark “{w.name}”</b>
                <span className="small muted">Printed {new Date(w.printedAt).toLocaleDateString()}, not marked yet.</span>
              </span>
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}
