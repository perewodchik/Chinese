import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { dayKey } from '../../domain/activity';
import { chooseExercise, makeExercise, makeMatch, type ExerciseContext, type ExerciseKind } from '../../domain/exercises/generate';
import { itemInfo, type ItemInfo } from '../../domain/exercises/items';
import type { ItemId } from '../../domain/ids';
import { dueItemCount, lessonCounts, lessonRating, pickLesson, twinWord, type Practised, type Throttle } from '../../domain/lesson';
import type { Rating } from '../../domain/memory';
import { progressOf } from '../../domain/progress';
import { paths } from '../../navigation/paths';
import { finishLesson, gradeItems, startLesson } from '../../store/commands';
import { getState, useStore } from '../../store/store';
import { useTitle } from '../../ui/useTitle';
import { useExerciseContext } from '../exercises/context';
import { ExerciseCard } from '../exercises/ExerciseCard';
import type { ExerciseResult } from '../exercises/parts';
import { useCardQueue, type Card } from '../exercises/useCardQueue';
import { DrillFrame } from '../review/DrillFrame';
import { useLibrary } from '../shared/library';
import { MeetCard } from './MeetCard';
import './learn.css';

interface Setup {
  ids: ItemId[];
  /** finished today already, and not asked for more */
  finished: boolean;
  throttle: Throttle;
  due: number;
  /** the lesson was picked earlier today and is being picked up again */
  resumed: boolean;
}

/** Today's lesson, at /learn: meet a few new things, practise them, check them. */
export function LearnPage() {
  useTitle('Learn');
  const lib = useLibrary();
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const [round, setRound] = useState(0);
  // ?again=c好,w火车: items that keep slipping in review, met again from the
  // start. Graded as reviews, not as the day's lesson.
  const again = useMemo(
    () => (query.get('again') ?? '').split(',').filter((id) => id && itemInfo(lib, id)),
    [query, lib],
  );
  if (again.length) {
    const back = () => navigate(paths.today(), { replace: true });
    return <Run ids={again} relearn onExit={back} onMore={back} />;
  }
  return <Lesson key={round} more={round > 0} onMore={() => setRound((r) => r + 1)} />;
}

function plan(lib: ReturnType<typeof useLibrary>, more: boolean): Setup {
  const st = getState();
  const now = Date.now();
  const had = st.activity[dayKey(now)]?.lesson;
  const due = dueItemCount(st.recall, now);
  if (had && !had.done && had.ids.length) {
    // Only what is still new: an item graded elsewhere since is review's now.
    const ids = had.ids.filter((id) => itemInfo(lib, id) && !st.recall[id]);
    if (ids.length) return { ids, finished: false, throttle: 'none', due, resumed: true };
  }
  if (had?.done && !more) return { ids: [], finished: true, throttle: 'none', due, resumed: false };
  const band = progressOf(lib, st.recall, st.learned, st.sheets, now).current?.band ?? 1;
  const pick = pickLesson(lib, st.recall, st.collections, st.settings.newPerDay, due, band);
  return { ids: pick.ids.filter((id) => itemInfo(lib, id)), finished: false, throttle: pick.throttle, due, resumed: false };
}

type Phase = 'meet' | 'practise' | 'check' | 'done';

function Lesson({ more, onMore }: { more: boolean; onMore: () => void }) {
  const lib = useLibrary();
  const navigate = useNavigate();
  const [setup] = useState(() => plan(lib, more));
  const exit = () => navigate(paths.today(), { replace: true });

  useEffect(() => {
    if (setup.ids.length && !setup.resumed) startLesson(setup.ids);
  }, [setup]);

  if (setup.finished) return <Finished onMore={onMore} due={setup.due} />;
  if (!setup.ids.length) return <Empty throttle={setup.throttle} due={setup.due} />;
  return <Run ids={setup.ids} onExit={exit} onMore={onMore} />;
}

function Run({ ids, relearn, onExit, onMore }: { ids: ItemId[]; relearn?: boolean; onExit: () => void; onMore: () => void }) {
  const lib = useLibrary();
  const hard = useStore((s) => s.settings.hardMode);
  const items = useMemo(() => ids.map((id) => itemInfo(lib, id)!).filter(Boolean), [lib, ids]);
  const chars = useMemo(() => items.flatMap((x) => x.chars), [items]);
  const ctx = useExerciseContext(`learn-${dayKey(Date.now())}-${ids.join('')}`, chars);

  const [phase, setPhase] = useState<Phase>('meet');
  const [meetAt, setMeetAt] = useState(0);
  const [knew, setKnew] = useState<Set<ItemId>>(new Set());
  const practised = useRef(new Map<ItemId, Practised>());
  const repeats = useRef(new Map<ItemId, number>());
  const recent = useRef<ExerciseKind[]>([]);
  const queue = useCardQueue([]);
  const [ratings, setRatings] = useState<Map<ItemId, Rating> | null>(null);

  const learning = items.filter((x) => !knew.has(x.id));
  const known = useMemo(() => ctx?.known ?? new Set<string>(), [ctx]);
  const p = (id: ItemId) => practised.current.get(id) ?? { misses: 0, knew: false, check: null };
  const setP = (id: ItemId, patch: Partial<Practised>) => practised.current.set(id, { ...p(id), ...patch });

  /* ---------------------------------------------------------------- meet */
  function meetNext(alreadyKnew = false) {
    const id = items[meetAt]!.id;
    const nextKnew = new Set(knew);
    if (alreadyKnew) {
      nextKnew.add(id);
      setKnew(nextKnew);
      setP(id, { knew: true });
    }
    if (meetAt + 1 < items.length) {
      setMeetAt(meetAt + 1);
      return;
    }
    startPractice(items.filter((x) => !nextKnew.has(x.id)));
  }

  function card(ex: ReturnType<typeof chooseExercise> | null, again = false): Card | null {
    if (!ex) return null;
    recent.current = [...recent.current.slice(-3), ex.kind];
    return { key: `${ex.kind}-${ex.ids.join('')}-${Math.random().toString(36).slice(2, 7)}`, ex, again };
  }

  function startPractice(list: ItemInfo[]) {
    if (!ctx || !list.length) {
      finish();
      return;
    }
    const shuffled = ctx.rng.shuffle(list);
    const cards: Array<Card | null> = [];
    if (list.length >= 3) cards.push(card(makeMatch(ctx, list, list.every((x) => x.picture) ? 'picture' : 'meaning')));
    for (const x of shuffled) cards.push(card(chooseExercise(ctx, x, 'recognise', { stage: 'easy', recent: recent.current })));
    for (const x of ctx.rng.shuffle(list)) {
      // A character's second card is about its sound: the tone is learned now or never.
      const skill = x.kind === 'char' ? 'sound' : 'recognise';
      cards.push(card(chooseExercise(ctx, x, skill, { stage: 'normal', recent: recent.current })));
    }
    if (hard) for (const x of ctx.rng.shuffle(list)) cards.push(card(chooseExercise(ctx, x, 'recognise', { stage: 'hard', recent: recent.current })));
    if (list.length >= 3) cards.push(card(makeMatch(ctx, list, list.every((x) => ctx.native.has(x.text)) ? 'listen' : 'pinyin')));
    queue.replace(cards.filter((c): c is Card => c !== null));
    setPhase('practise');
  }

  /* ---------------------------------------------------------- practise */
  function practised_(results: ExerciseResult[], c: Card, context: ExerciseContext) {
    for (const r of results) {
      const slip = r.misses + (r.ok ? 0 : 1);
      if (!slip) continue;
      setP(r.id, { misses: p(r.id).misses + slip });
      const n = repeats.current.get(r.id) ?? 0;
      if (n >= 2) continue;
      repeats.current.set(r.id, n + 1);
      const item = items.find((x) => x.id === r.id);
      if (!item) continue;
      // The same kind of card again, dealt afresh; a missed board sends a single pick.
      const ex =
        c.ex.kind === 'match'
          ? chooseExercise(context, item, 'recognise', { stage: 'easy', recent: recent.current })
          : (makeExercise(context, item, c.ex.skill, c.ex.kind) ?? chooseExercise(context, item, c.ex.skill, { stage: 'easy' }));
      const again = card(ex, true);
      if (again) queue.insert(again, 3);
    }
  }

  function startCheck() {
    if (!ctx) return;
    const cards = ctx.rng
      .shuffle(learning)
      .map((x) => card(hard ? (makeExercise(ctx, x, 'recognise', 'type-meaning') ?? null) : makeExercise(ctx, x, 'recognise', 'recall')))
      .filter((c): c is Card => c !== null);
    queue.replace(cards);
    setPhase('check');
  }

  function checked(results: ExerciseResult[], c: Card) {
    for (const r of results) {
      const right = r.rating ? r.rating !== 'again' : r.ok && r.misses === 0;
      // Only the first answer is the check; a repeat is practice.
      if (!c.again) setP(r.id, { check: right ? 'right' : 'wrong' });
      if (!right && !c.again && ctx) {
        const item = items.find((x) => x.id === r.id);
        const again = item && card(makeExercise(ctx, item, 'recognise', 'recall'), true);
        if (again) queue.insert(again, 99);
      }
    }
  }

  function finish() {
    const out = new Map<ItemId, Rating>();
    for (const x of items) {
      const pr = p(x.id);
      out.set(x.id, lessonRating(knew.has(x.id) ? { ...pr, knew: true } : pr));
    }
    const recall = getState().recall;
    if (relearn) {
      gradeItems(items.map((x) => ({ id: x.id, skill: 'recognise' as const, rating: out.get(x.id)! })));
      setRatings(out);
      setPhase('done');
      return;
    }
    finishLesson(
      items.flatMap((x) => {
        const rating = out.get(x.id)!;
        const twin = twinWord(lib, x.id, recall);
        return [{ id: x.id, skill: 'recognise' as const, rating }, ...(twin ? [{ id: twin, skill: 'recognise' as const, rating }] : [])];
      }),
    );
    setRatings(out);
    setPhase('done');
  }

  function onCard(results: ExerciseResult[]) {
    const c = queue.card;
    if (!c || !ctx) return;
    if (phase === 'practise') practised_(results, c, ctx);
    else checked(results, c);
    // Past the last card, the effect below moves on to the next phase. A card
    // put back by this answer lands inside the run, so it is still to come.
    queue.next();
  }

  // When the run of cards is through, move on.
  useEffect(() => {
    if (phase === 'practise' && queue.total > 0 && queue.at >= queue.total) startCheck();
    if (phase === 'check' && queue.total > 0 && queue.at >= queue.total) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, queue.at, queue.total]);

  /* ------------------------------------------------------------ drawing */
  if (phase === 'done' && ratings) return <Summary items={items} ratings={ratings} onExit={onExit} onMore={onMore} />;

  if (phase === 'meet') {
    const item = items[meetAt]!;
    return (
      <DrillFrame title="Learn · meet" hint="Look, listen, read the sentence. Nothing is asked yet." at={meetAt} total={items.length} onExit={onExit}>
        <MeetKeys onNext={() => meetNext(false)} />
        <MeetCard key={item.id} id={item.id} known={known} />
        <div className="meet-actions">
          <button type="button" className="btn ghost" onClick={() => meetNext(true)}>
            I know this already
          </button>
          <button type="button" className="btn primary meet-next" onClick={() => meetNext(false)} disabled={!ctx && meetAt + 1 >= items.length}>
            {meetAt + 1 < items.length ? 'Next' : ctx ? 'Practise these' : 'Getting the sounds…'}
            <span className="key-hint"> — enter</span>
          </button>
        </div>
      </DrillFrame>
    );
  }

  const c = queue.card;
  if (!c) return null;
  const again = c.again ? ' Once more — this one slipped a moment ago.' : '';
  return (
    <DrillFrame
      title={phase === 'practise' ? 'Learn · practise' : 'Learn · check'}
      hint={(phase === 'practise' ? 'A few ways of meeting each one.' : 'One plain question each — this answer is the first grade.') + again}
      at={queue.at}
      total={queue.total}
      onExit={onExit}
    >
      <ExerciseCard key={c.key} ex={c.ex} first onDone={onCard} />
    </DrillFrame>
  );
}

function MeetKeys({ onNext }: { onNext: () => void }) {
  const ref = useRef(onNext);
  ref.current = onNext;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}

const RATING_NOTE: Record<Rating, string> = {
  again: 'back in half an hour',
  hard: 'back later today',
  good: 'back in a day or two',
  easy: 'back in a few days',
};

function Summary({ items, ratings, onExit, onMore }: { items: ItemInfo[]; ratings: Map<ItemId, Rating>; onExit: () => void; onMore: () => void }) {
  const counts = lessonCounts(items.map((x) => x.id));
  const due = useStore((s) => dueItemCount(s.recall, Date.now()));
  const navigate = useNavigate();
  return (
    <DrillFrame title="Learn" hint="" at={1} total={1} onExit={onExit}>
      <div className="drill-done learn-done">
        <span className="big hanzi">新</span>
        <h2 style={{ fontSize: 17, margin: '4px 0 2px' }}>
          {[counts.chars && `${counts.chars} new character${counts.chars === 1 ? '' : 's'}`, counts.words && `${counts.words} new word${counts.words === 1 ? '' : 's'}`]
            .filter(Boolean)
            .join(' and ')}
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          Each has its first grade now, and comes back on its own schedule.
        </p>
        <ul className="learn-list">
          {items.map((x) => (
            <li key={x.id} data-rating={ratings.get(x.id)}>
              <b className="hanzi">{x.text}</b>
              <span className="learn-list-py">{x.py}</span>
              <span className="small muted">{x.gloss}</span>
              <i className="tiny">{RATING_NOTE[ratings.get(x.id) ?? 'good']}</i>
            </li>
          ))}
        </ul>
        <div className="row" style={{ justifyContent: 'center', marginTop: 6 }}>
          {due > 0 && (
            <button className="btn primary" onClick={() => navigate(paths.reviewSession(), { replace: true })}>
              Next: review · {due} due
            </button>
          )}
          <button className="btn" onClick={onMore}>
            Learn a few more
          </button>
          <button className={`btn${due ? ' ghost' : ' primary'}`} onClick={onExit}>
            Back to Today
          </button>
        </div>
      </div>
    </DrillFrame>
  );
}

function Finished({ onMore, due }: { onMore: () => void; due: number }) {
  const count = useStore((s) => s.activity[dayKey(Date.now())]?.lesson?.count ?? 1);
  return (
    <div className="empty">
      <span className="big">好</span>
      <p>
        Today’s lesson is done{count > 1 ? ` — ${count} of them` : ''}. What you met comes back in review on its own
        schedule.
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        {due > 0 && (
          <Link className="btn primary" to={paths.reviewSession()} replace>
            Review · {due} due
          </Link>
        )}
        <button className="btn" onClick={onMore}>
          Learn a few more
        </button>
        <Link className="btn ghost" to={paths.today()} replace>
          Back to Today
        </Link>
      </div>
    </div>
  );
}

function Empty({ throttle, due }: { throttle: Throttle; due: number }) {
  if (throttle === 'stop') {
    return (
      <div className="empty">
        <span className="big">满</span>
        <p>
          {due} things are due for review. New ones would only add to the pile, so today is for catching up — the
          lesson comes back when the queue is shorter.
        </p>
        <Link className="btn primary" to={paths.reviewSession()} replace>
          Start reviewing
        </Link>
      </div>
    );
  }
  return (
    <div className="empty">
      <span className="big">空</span>
      <p>Nothing new is waiting. Sort a band’s words into known and new, or pick characters in the library.</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link className="btn primary" to={paths.sweep()}>
          Which words do you know?
        </Link>
        <Link className="btn" to={paths.library()}>
          Library
        </Link>
      </div>
    </div>
  );
}

