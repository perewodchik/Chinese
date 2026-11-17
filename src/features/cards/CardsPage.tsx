import { useMemo } from 'react';
import { Link } from 'react-router';
import { CARD_SIZES, CARD_SKILLS, planStubborn } from '../../domain/cards';
import { idValue } from '../../domain/ids';
import { itemInfo } from '../../domain/exercises/items';
import { firstUnread } from '../../domain/text';
import { NEW_PER_DAY } from '../../domain/lesson';
import { paths } from '../../navigation/paths';
import { setSettings } from '../../store/commands';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { ASKS } from './asks';
import { useCardsToday } from '../shared/cardsToday';
import './cards.css';

/**
 * The Cards tab: today's cards, how many a day, and — folded away — the
 * other ways to practise that used to crowd the front page.
 */
export function CardsPage() {
  useTitle('Cards');
  const today = useCardsToday();
  const settings = useStore((s) => s.settings);
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  // With nothing to ask, the way to cards is a text: the first one not read yet.
  const unread = useMemo(() => (today.count ? null : firstUnread(texts, sets)), [today.count, texts, sets]);
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
                  : 'Cards come from words you pick while reading: tap a word in a text, then Learn this word.'}
              </p>
              <div className="deck-actions">
                {today.done ? (
                  <Link className="btn tonal" to={paths.cardSession({ n: 10 })}>
                    10 more
                  </Link>
                ) : unread ? (
                  <Link className="btn tonal deck-open" to={paths.reading(unread.set.id, { page: unread.page })}>
                    Open <span className="hanzi">{unread.text.titleZh || unread.text.title}</span>
                  </Link>
                ) : (
                  <Link className="btn tonal" to={paths.read()}>
                    Find something to read
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <KeepMissing />

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
          <Link className="deck-row deck-link" to={paths.sweep()}>
            <span className="grow">
              Tell it what you know already
              <small>The HSK words a screenful at a time: known, not sure, new. Known ones never become cards.</small>
            </span>
            <Icon name="chevron" className="muted" />
          </Link>
        </div>
      </section>

    </div>
  );
}

/**
 * What keeps being missed (G8), where something can be done about it: the
 * items missed four times or more, each a tap from its drawer, and a sitting
 * of just those. Nothing when there are none.
 */
function KeepMissing() {
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const skills = useStore((s) => s.settings.cardSkills);
  const openItem = useOpenItem();
  // Only what a card can still ask: one missed only in writing, with writing off, waits.
  const list = useMemo(() => planStubborn(recall, Date.now(), Infinity, skills).cards.map((c) => ({ id: c.id, lapses: c.record!.lapses })), [recall, skills]);
  if (!list.length) return null;
  return (
    <section className="block">
      <div className="row keep-missing-head">
        <h2 className="block-title grow">Keep missing · {list.length}</h2>
        <Link className="btn tonal sm" to={paths.cardSession({ missed: true })}>
          Practise them
        </Link>
      </div>
      <p className="small muted keep-missing-lede">Missed four times or more. A look at each in its drawer often does more than asking again.</p>
      <div className="keep-missing">
        {list.slice(0, 24).map((l) => {
          const info = itemInfo(lib, l.id);
          return (
            <button key={l.id} className="keep-missing-item" onClick={() => openItem(l.id)}>
              <b className="hanzi">{info?.text ?? l.id.slice(1)}</b>
              <i>{info?.py}</i>
              <span className="tiny muted">{l.lapses}×</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
