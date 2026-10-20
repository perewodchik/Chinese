import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { planCards, planShelf, SECONDS_PER_CARD, type CardPlan, type CardSkill } from '../../domain/cards';
import { checkPinyin, type PinyinCheck } from '../../domain/exercises/check';
import { itemInfo, senses, type ItemInfo } from '../../domain/exercises/items';
import { charId, idValue, isCharId } from '../../domain/ids';
import { firstSense } from '../../domain/library';
import { wordInfo } from '../../domain/words';
import { DAY, grade, type Rating } from '../../domain/memory';
import type { SessionTarget } from '../../domain/reviewSession';
import { answeredSince, startOfToday } from '../../domain/today';
import { paths } from '../../navigation/paths';
import { gradeItem, setSettings } from '../../store/commands';
import { getState, useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Say } from '../../ui/Say';
import { useTitle } from '../../ui/useTitle';
import { WritePad } from '../review/WritePad';
import { useLibrary } from '../shared/library';
import { ASKS } from './asks';
import './cards.css';

type Card = SessionTarget & { fresh: boolean };

/**
 * /cards/session — one sitting of cards. `?n=10` for fewer (or, once the day
 * is done, that many more); `?shelf=<id>` for one shelf's words only.
 *
 * Planned once, when it opens: grading a card moves it in the schedule, and a
 * plan that re-made itself after every answer would keep changing its mind
 * about what comes next.
 */
export function CardSessionPage() {
  useTitle('Cards');
  const lib = useLibrary();
  const [query] = useSearchParams();
  const [round, setRound] = useState(0);
  const plan = useMemo<CardPlan>(() => {
    const s = getState();
    const n = Number(query.get('n')) || 0;
    const shelf = s.sets.find((x) => x.id === query.get('shelf'));
    if (shelf) return planShelf(lib, s.recall, shelf, Date.now(), n || 20);
    // `n` is how many now, on top of whatever was answered today already: "only
    // ten" on a fresh day, "ten more" on a finished one.
    const answered = answeredSince(s.recall, startOfToday(Date.now()));
    const size = n ? answered + n : s.settings.cardsPerDay;
    return planCards(lib, s.recall, s.sets, Date.now(), { size, newPerDay: s.settings.newPerDay, skills: s.settings.cardSkills });
    // A new round is a new plan; nothing else should re-plan a sitting under way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, round]);
  return <Session key={round} plan={plan} shelf={query.get('shelf')} onMore={() => setRound((r) => r + 1)} />;
}

function Session({ plan, shelf, onMore }: { plan: CardPlan; shelf: string | null; onMore: () => void }) {
  const lib = useLibrary();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Card[]>(plan.cards);
  const [at, setAt] = useState(0);
  const [tally, setTally] = useState<Record<Rating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  /** cards already sent round again this sitting: once each, then they wait for the schedule */
  const again = useRef(new Set<string>());
  const card = queue[at] ?? null;
  const total = queue.length;
  const exit = shelf ? paths.shelf(shelf, 'words') : paths.today();

  function answer(rating: Rating) {
    if (!card) return;
    gradeItem(card.id, card.skill, rating);
    setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
    // Forgotten: once more before the sitting ends, the way a learning step does.
    const key = `${card.id}|${card.skill}`;
    if (rating === 'again' && !again.current.has(key)) {
      again.current.add(key);
      setQueue((q) => [...q, { ...card, fresh: false, record: getState().recall[card.id]?.[card.skill] ?? null }]);
    }
    setAt((i) => i + 1);
  }

  /**
   * This kind of card, turned off from the card itself: the setting changes,
   * and this card and the rest of its kind leave the sitting without a grade.
   */
  function turnOff(skill: CardSkill) {
    const kept = getState().settings.cardSkills.filter((k) => k !== skill);
    if (!kept.length) return;
    setSettings({ cardSkills: kept });
    setQueue((q) => q.filter((c, i) => i < at || c.fresh || c.skill !== skill));
  }
  const skills = useStore((s) => s.settings.cardSkills);

  if (!plan.cards.length) {
    return (
      <div className="cs">
        <SessionBar exit={exit} at={0} total={0} />
        <div className="cs-end">
          <span className="cs-seal hanzi">好</span>
          <h1>Nothing to ask right now</h1>
          <p className="muted">
            {shelf ? 'This shelf has no words on its list yet.' : 'Everything in rotation is holding. Read something, or add words from a text.'}
          </p>
          <Link className="btn primary lg" to={shelf ? paths.shelf(shelf) : paths.read()}>
            {shelf ? 'Back to the shelf' : 'Go to Read'}
          </Link>
        </div>
      </div>
    );
  }

  if (!card) {
    const answered = Object.values(tally).reduce((a, b) => a + b, 0);
    return (
      <div className="cs">
        <SessionBar exit={exit} at={total} total={total} />
        <div className="cs-end">
          <span className="cs-seal hanzi">好</span>
          <h1>{shelf ? 'Done' : 'Done for today'}</h1>
          <p className="muted">
            {answered} card{answered === 1 ? '' : 's'}: {tally.good + tally.easy} known, {tally.hard} hard, {tally.again} to see again.
          </p>
          <div className="cs-end-actions">
            <button className="btn primary lg" onClick={() => navigate(exit)}>
              {shelf ? 'Back to the shelf' : 'Back to Today'}
            </button>
            {!shelf && (
              <button
                className="btn quiet"
                onClick={() => {
                  navigate(paths.cardSession({ n: 10 }), { replace: true });
                  onMore();
                }}
              >
                10 more
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cs">
      <SessionBar exit={exit} at={at} total={total} />
      <OneCard
        key={`${at}-${card.id}-${card.skill}`}
        card={card}
        info={itemInfo(lib, card.id)}
        onAnswer={answer}
        onTurnOff={!card.fresh && card.skill !== 'use' && skills.length > 1 ? () => turnOff(card.skill as CardSkill) : undefined}
      />
    </div>
  );
}

function SessionBar({ exit, at, total }: { exit: string; at: number; total: number }) {
  return (
    <header className="cs-bar">
      <Link className="icon-btn" to={exit} aria-label="Stop">
        <Icon name="close" size={22} />
      </Link>
      <span className="cs-progress" aria-hidden>
        <i style={{ width: total ? `${(at / total) * 100}%` : '0%' }} />
      </span>
      <span className="small muted cs-count">{total ? `${Math.min(at + 1, total)} of ${total}` : ''}</span>
    </header>
  );
}

/** When a rating would bring the card back, said short: "8 min", "2 days". */
function after(card: Card, rating: Rating, now: number): string {
  const next = grade(card.record ?? undefined, rating, now, card.skill);
  const ms = Math.max(0, next.due - now);
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (ms < DAY) return `${Math.round(ms / 3_600_000)} h`;
  const days = Math.round(ms / DAY);
  return days < 31 ? `${days} day${days === 1 ? '' : 's'}` : `${Math.round(days / 30)} mo`;
}

/**
 * A sentence to see the item in: for a word, a line from your own texts, where
 * you met it; for a single character, the library's own example — a line of
 * yours with 二 in it is as likely to be about 二氧化碳 as about two.
 */
function useContext(text: string, info: ItemInfo | null): { zh: string; en: string; from: string } | null {
  const texts = useStore((s) => s.texts);
  return useMemo(() => {
    if ([...text].length > 1) {
      for (const t of texts) {
        const l = t.lines.find((x) => x.zh.includes(text));
        if (l) return { zh: l.zh, en: l.en, from: `From ${t.titleZh || t.title}` };
      }
    }
    const ex = info?.ex.find((x) => x.zh.includes(text));
    return ex ? { zh: ex.zh, en: ex.en, from: 'An example' } : null;
  }, [texts, text, info]);
}

function Marked({ zh, mark }: { zh: string; mark: string }) {
  const parts = zh.split(mark);
  return (
    <>
      {parts.flatMap((p, i) =>
        i ? [<mark key={i}>{mark}</mark>, <span key={`s${i}`}>{p}</span>] : [<span key="s0">{p}</span>],
      )}
    </>
  );
}

/**
 * One card. Most are turned over: you recall, then look, then say how it
 * went. Some make you produce the answer first — type the reading, or write
 * the character — because a card you only look at is easy to fool yourself
 * with; those grade themselves from what you did.
 */
function OneCard({
  card,
  info,
  onAnswer,
  onTurnOff,
}: {
  card: Card;
  info: ItemInfo | null;
  onAnswer: (r: Rating) => void;
  /** this kind of card off, where another kind is still on */
  onTurnOff?: () => void;
}) {
  const lib = useLibrary();
  const [open, setOpen] = useState(card.fresh);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState<PinyinCheck | null>(null);
  const now = useMemo(() => Date.now(), []);
  const text = idValue(card.id);
  // Reading a character inside a word: the word is the prompt.
  const inWord = card.skill === 'use' && isCharId(card.id) ? (lib.byChar.get(text)?.words.find((w) => [...w.w].length > 1) ?? null) : null;
  const shown = inWord?.w ?? text;
  const context = useContext(shown, inWord ? null : info);
  const mode: 'flip' | 'type' | 'write' = card.fresh
    ? 'flip'
    : card.skill === 'write' && isCharId(card.id)
      ? 'write'
      : card.skill === 'sound'
        ? 'type'
        : 'flip';

  useEffect(() => {
    if (mode !== 'flip') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!open && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setOpen(true);
      } else if (open && ['1', '2', '3', '4'].includes(e.key)) {
        onAnswer((['again', 'hard', 'good', 'easy'] as const)[Number(e.key) - 1]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, open, onAnswer]);

  if (!info) {
    // Something the library no longer has: let it pass without a grade.
    return (
      <div className="cs-card-wrap">
        <div className="cs-card">
          <span className="hanzi cs-han">{text}</span>
        </div>
        <div className="cs-actions">
          <button className="btn primary lg" onClick={() => onAnswer('good')}>
            Next
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'write') {
    return (
      <div className="cs-card-wrap">
        <div className="cs-card cs-write">
          <p className="small muted">Write it from memory</p>
          <WritePad char={text} py={info.py} gloss={info.gloss} onDone={onAnswer} />
          {onTurnOff && <TurnOff skill="write" onClick={onTurnOff} />}
        </div>
      </div>
    );
  }

  const prompt =
    mode === 'type'
      ? 'Type how it is said, tones included'
      : card.skill === 'use'
        ? `How is ${text} read in this word?`
        : 'What is it, and how is it said?';

  const back = (
    <div className="cs-back">
      <div className="cs-said">
        <span className="cs-py">{inWord ? (wordInfo(lib, inWord.w)?.py ?? info.py) : info.py}</span>
        <Say text={shown} size="lg" />
      </div>
      <p className="cs-meaning">{senses(inWord ? inWord.d : info.def)}</p>
      {[...shown].length > 1 && (
        <ul className="cs-chars">
          {[...shown].map((c, i) => {
            const e = lib.byChar.get(c);
            const learned = getState().learned.has(charId(c));
            return (
              <li key={i}>
                <span className="hanzi">{c}</span>
                <b>{e?.py[0] ?? ''}</b>
                <span className="muted">{e ? firstSense(e.def) : ''}</span>
                <span className="cs-char-state" data-known={learned || undefined}>
                  {learned ? 'Known' : 'New'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="cs-card-wrap">
      <div className="cs-card" data-open={open || undefined}>
        {card.fresh && <span className="cs-new">New word</span>}
        <span className="hanzi cs-han" data-len={Math.min(4, [...shown].length)}>
          {inWord ? <Marked zh={shown} mark={text} /> : shown}
        </span>
        {!open && mode === 'flip' && <p className="small muted cs-prompt">{prompt}</p>}

        {mode === 'type' && (
          <form
            className="cs-type"
            onSubmit={(e) => {
              e.preventDefault();
              if (!typed.trim() || checked) return;
              const c = checkPinyin(typed, info.py);
              setChecked(c);
              setOpen(true);
            }}
          >
            <label className="small muted" htmlFor="cs-typed">
              {prompt}
            </label>
            <div className="cs-type-row">
              <input
                id="cs-typed"
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={typed}
                readOnly={Boolean(checked)}
                placeholder="hao3 or hǎo"
                onChange={(e) => setTyped(e.target.value)}
                data-state={checked ? (checked.ok ? 'right' : checked.tonesOnly ? 'nearly' : 'wrong') : undefined}
              />
              {!checked && (
                <button className="btn primary" type="submit" disabled={!typed.trim()}>
                  Check
                </button>
              )}
            </div>
            {checked && (
              <p className="cs-verdict" data-state={checked.ok ? 'right' : checked.tonesOnly ? 'nearly' : 'wrong'}>
                {checked.ok ? 'Right' : checked.tonesOnly ? 'The sounds are right, a tone is not' : 'Not quite'}
              </p>
            )}
          </form>
        )}

        {open && back}

        {context && (
          <div className="cs-context">
            <p className="hanzi cs-context-zh">
              <Marked zh={context.zh} mark={shown} />
            </p>
            {/* The sentence's English goes with the sentence, and only once the card is turned. */}
            {open && context.en && <p className="cs-context-en">{context.en}</p>}
            <p className="tiny muted">{context.from}</p>
          </div>
        )}
        {mode === 'type' && onTurnOff && <TurnOff skill="sound" onClick={onTurnOff} />}
      </div>

      <div className="cs-actions">
        {mode === 'type' ? (
          checked ? (
            <button className="btn primary lg" autoFocus onClick={() => onAnswer(checked.ok ? 'good' : checked.tonesOnly ? 'hard' : 'again')}>
              Next
            </button>
          ) : (
            <button className="btn quiet" onClick={() => onAnswer('again')}>
              I don’t know it
            </button>
          )
        ) : !open ? (
          <button className="btn primary lg cs-show" onClick={() => setOpen(true)}>
            Show the answer
          </button>
        ) : card.fresh ? (
          <div className="cs-grades two">
            <button className="btn cs-grade" onClick={() => onAnswer('again')}>
              <b>Show it again</b>
              <span>{after(card, 'again', now)}</span>
            </button>
            <button className="btn cs-grade" data-good onClick={() => onAnswer('good')}>
              <b>Got it</b>
              <span>{after(card, 'good', now)}</span>
            </button>
          </div>
        ) : (
          <div className="cs-grades">
            {(['again', 'hard', 'good', 'easy'] as const).map((r) => (
              <button key={r} className="btn cs-grade" data-rating={r} onClick={() => onAnswer(r)}>
                <b>{r === 'again' ? 'Again' : r === 'hard' ? 'Hard' : r === 'good' ? 'Good' : 'Easy'}</b>
                <span>{after(card, r, now)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const minutesFor = (cards: number) => Math.max(1, Math.round((cards * SECONDS_PER_CARD) / 60));

/** A kind of card turned off from one of its cards; it comes back on the Cards tab. */
function TurnOff({ skill, onClick }: { skill: CardSkill; onClick: () => void }) {
  return (
    <button type="button" className="btn quiet sm cs-off" onClick={onClick}>
      {ASKS.find((a) => a.skill === skill)?.off}
    </button>
  );
}
