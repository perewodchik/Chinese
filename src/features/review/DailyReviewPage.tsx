import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { dayKey } from '../../domain/activity';
import { chooseExercise, makeMatch, type Exercise, type ExerciseContext, type ExerciseKind } from '../../domain/exercises/generate';
import { itemInfo } from '../../domain/exercises/items';
import { checkedRating } from '../../domain/grading';
import type { ItemId } from '../../domain/ids';
import { dueItemCount } from '../../domain/lesson';
import type { MasteryBand, Rating } from '../../domain/memory';
import { isLeech, planReview, type SessionPlan, type SessionTarget } from '../../domain/reviewSession';
import { bandOf } from '../../domain/stats';
import { paths } from '../../navigation/paths';
import { gradeItem, setSettings } from '../../store/commands';
import { getState, useStore } from '../../store/store';
import { useTitle } from '../../ui/useTitle';
import { useExerciseContext } from '../exercises/context';
import { ExerciseCard } from '../exercises/ExerciseCard';
import type { ExerciseResult } from '../exercises/parts';
import { MeetCard } from '../learn/MeetCard';
import { CollectionPicker, useCollect } from '../shared/collect';
import { useLibrary } from '../shared/library';
import { DrillFrame } from './DrillFrame';
import './session.css';

/**
 * The daily review, at /review/session?min=10: everything due, one question
 * per item, mixed, in the time given. See `planReview` for what is asked, and
 * `chooseExercise` for how.
 */
export function DailyReviewPage() {
  useTitle('Review');
  const [query] = useSearchParams();
  const fallback = useStore((s) => s.settings.reviewMinutes);
  const minutes = Number(query.get('min')) || fallback;
  const [round, setRound] = useState(0);
  return <Session key={`${minutes}-${round}`} minutes={minutes} onAgain={() => setRound((r) => r + 1)} />;
}

type Slot =
  | { key: string; kind: 'ask'; target: SessionTarget }
  | { key: string; kind: 'board'; targets: SessionTarget[] }
  /** a missed item, asked again later in the sitting: practice, not graded */
  | { key: string; kind: 'again'; target: SessionTarget }
  /** a leech: met again before it is asked */
  | { key: string; kind: 'teach'; target: SessionTarget };

const ORDER: MasteryBand[] = ['unseen', 'new', 'shaky', 'holding', 'solid'];

/** The plan as cards: young recognition items on match boards, a leech met again before its question. */
function slotsOf(plan: SessionPlan): Slot[] {
  const young = plan.targets.filter(
    (t) => t.skill === 'recognise' && t.record && !t.record.claim && t.record.s < 2 && !isLeech(t.record),
  );
  const boards: SessionTarget[][] = [];
  for (let i = 0; i + 4 <= young.length && boards.length < 2; i += 5) boards.push(young.slice(i, i + 5));
  const onBoard = new Set(boards.flat().map((t) => t.id));
  const out: Slot[] = [];
  let b = 0;
  for (const t of plan.targets) {
    if (onBoard.has(t.id)) {
      const board = boards[b];
      if (board && board[0]!.id === t.id) {
        out.push({ key: `board-${b}`, kind: 'board', targets: board });
        b++;
      }
      continue;
    }
    if (isLeech(t.record)) out.push({ key: `teach-${t.id}`, kind: 'teach', target: t });
    out.push({ key: `ask-${t.id}-${t.skill}`, kind: 'ask', target: t });
  }
  return out;
}

function Session({ minutes, onAgain }: { minutes: number; onAgain: () => void }) {
  const lib = useLibrary();
  const navigate = useNavigate();
  const hard = useStore((s) => s.settings.hardMode);
  const [start] = useState(() => {
    const { recall } = getState();
    const now = Date.now();
    const plan = planReview(lib, recall, now, minutes);
    const bands = new Map(plan.targets.map((t) => [t.id, bandOf(t.id, recall[t.id], now)]));
    return { plan, bands, slots: slotsOf(plan) };
  });
  const ctx = useExerciseContext(`review-${dayKey(Date.now())}-${minutes}`);
  const exit = () => navigate(paths.today(), { replace: true });

  if (!start.plan.targets.length) {
    return (
      <div className="empty">
        <span className="big">空</span>
        <p>Nothing is due. Everything you know is holding.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={() => navigate(paths.learn(), { replace: true })}>
            Learn something new
          </button>
          <button className="btn" onClick={exit}>
            Back to Today
          </button>
        </div>
      </div>
    );
  }
  if (!ctx) {
    return (
      <DrillFrame title="Review" hint="Getting the sounds ready…" at={0} total={start.slots.length} onExit={exit}>
        <div className="ex-card" style={{ minHeight: 320 }} />
      </DrillFrame>
    );
  }
  return <Run ctx={ctx} plan={start.plan} slots={start.slots} bands={start.bands} hard={hard} onExit={exit} onAgain={onAgain} />;
}

interface Logged {
  id: ItemId;
  rating: Rating;
}

function Run({
  ctx,
  plan,
  slots: initial,
  bands,
  hard,
  onExit,
  onAgain,
}: {
  ctx: ExerciseContext;
  plan: SessionPlan;
  slots: Slot[];
  bands: Map<ItemId, MasteryBand>;
  hard: boolean;
  onExit: () => void;
  onAgain: () => void;
}) {
  const lib = useLibrary();
  const [slots, setSlots] = useState(initial);
  const [at, setAt] = useState(0);
  const [log, setLog] = useState<Logged[]>([]);
  const [dots, setDots] = useState<Array<'right' | 'nearly' | 'wrong'>>([]);
  const [noSpeak, setNoSpeak] = useState(false);
  const recent = useRef<ExerciseKind[]>([]);
  const made = useRef(new Map<string, Exercise>());
  const graded = useRef(new Set<string>());
  const repeats = useRef(new Map<ItemId, number>());
  const slot = slots[at];

  // The card for a slot is dealt when it comes up — so it can avoid the kinds
  // just shown, and speaking once it has been declined — and kept, so a
  // re-render never deals it again.
  const ex = useMemo(() => {
    if (!slot || slot.kind === 'teach') return null;
    const had = made.current.get(slot.key);
    if (had) return had;
    let e: Exercise | null = null;
    if (slot.kind === 'board') {
      e = makeMatch(ctx, slot.targets.map((t) => itemInfo(lib, t.id)!).filter(Boolean));
    } else {
      const item = itemInfo(lib, slot.target.id);
      if (item) {
        const r = slot.target.record;
        e = chooseExercise(ctx, item, slot.target.skill, {
          stage: slot.kind === 'again' ? 'easy' : r ? 'review' : 'normal',
          stability: r?.s ?? 0,
          hard,
          recent: recent.current,
          avoid: noSpeak ? ['speak'] : [],
        });
      }
    }
    if (e) {
      made.current.set(slot.key, e);
      recent.current = [...recent.current.slice(-3), e.kind];
    }
    return e;
  }, [slot, ctx, lib, hard, noSpeak]);

  function onDone(results: ExerciseResult[]) {
    if (!slot) return;
    const practice = slot.kind === 'again';
    const targets = slot.kind === 'board' ? slot.targets : slot.kind === 'teach' ? [] : [slot.target];
    const entries: Logged[] = [];
    const add: Slot[] = [];
    for (const r of results) {
      const target = targets.find((t) => t.id === r.id);
      const record = target?.record ?? null;
      const first = !record || record.claim === true;
      const rating = r.rating ?? checkedRating({ ok: r.ok, misses: r.misses, ms: r.ms, tier: r.tier, first });
      const key = `${r.id}/${r.skill}`;
      if (!practice && !graded.current.has(key)) {
        graded.current.add(key);
        // A claim's first answer is the first real evidence: full weight, whatever the card.
        gradeItem(r.id, r.skill, rating, r.rating || first ? undefined : r.weight);
        entries.push({ id: r.id, rating });
        setDots((d) => [...d.slice(-9), rating === 'again' ? 'wrong' : rating === 'hard' ? 'nearly' : 'right']);
      }
      const n = repeats.current.get(r.id) ?? 0;
      if ((rating === 'again' || (practice && !r.ok)) && n < 2 && target) {
        repeats.current.set(r.id, n + 1);
        add.push({ key: `again-${r.id}-${n}`, kind: 'again', target });
      }
    }
    if (entries.length) setLog((l) => [...l, ...entries]);
    if (add.length) {
      setSlots((s) => {
        const out = [...s];
        out.splice(Math.min(out.length, at + 4), 0, ...add);
        return out;
      });
    }
    setAt((a) => a + 1);
  }

  if (!slot) return <Summary log={log} plan={plan} bands={bands} onExit={onExit} onAgain={onAgain} />;

  const hint = slot.kind === 'again'
    ? 'Once more — this one slipped a moment ago.'
    : slot.kind === 'teach'
      ? 'This one keeps slipping. Look at it properly first.'
      : plan.catchUp
        ? 'Catching up: the ones closest to being lost come first.'
        : 'One question per item. Only the first answer counts.';

  return (
    <DrillFrame title="Review" hint={hint} at={at} total={slots.length} onExit={onExit} dots={dots}>
      <div className="session-tools">
        <button type="button" className="chip" aria-pressed={hard} onClick={() => setSettings({ hardMode: !hard })} title="Typed answers wherever a card has them">
          Hard mode
        </button>
      </div>
      {slot.kind === 'teach' ? (
        <div className="session-teach">
          <MeetCard id={slot.target.id} known={ctx.known} compact />
          <button type="button" className="btn primary" onClick={() => setAt((a) => a + 1)} autoFocus>
            Now ask me
          </button>
        </div>
      ) : ex ? (
        <ExerciseCard
          key={slot.key}
          ex={ex}
          first={slot.kind === 'ask' && !slot.target.record}
          onDone={onDone}
          onSkip={() => {
            setNoSpeak(true);
            made.current.delete(slot.key);
          }}
        />
      ) : (
        <button className="btn" onClick={() => setAt((a) => a + 1)}>
          Skip
        </button>
      )}
    </DrillFrame>
  );
}

function Summary({
  log,
  plan,
  bands,
  onExit,
  onAgain,
}: {
  log: Logged[];
  plan: SessionPlan;
  bands: Map<ItemId, MasteryBand>;
  onExit: () => void;
  onAgain: () => void;
}) {
  const lib = useLibrary();
  const navigate = useNavigate();
  const collect = useCollect();
  const recall = useStore((s) => s.recall);
  const lessonDone = useStore((s) => s.activity[dayKey(Date.now())]?.lesson?.done ?? false);
  const now = Date.now();
  const still = dueItemCount(recall, now);

  const clean = log.filter((l) => l.rating === 'good' || l.rating === 'easy').length;
  const missed = [...new Set(log.filter((l) => l.rating === 'again').map((l) => l.id))];
  const up = [...new Set(log.map((l) => l.id))].filter((id) => {
    const before = bands.get(id) ?? 'unseen';
    return ORDER.indexOf(bandOf(id, recall[id], now)) > ORDER.indexOf(before);
  });
  const stubborn = [...new Set(log.map((l) => l.id))].filter((id) => Object.values(recall[id] ?? {}).some((r) => isLeech(r)));
  const label = (id: ItemId) => {
    const info = itemInfo(lib, id);
    return (
      <span key={id} className="session-chip">
        <b className="hanzi">{info?.text ?? id.slice(1)}</b>
        <i>{info?.py}</i>
      </span>
    );
  };

  return (
    <DrillFrame title="Review" hint="" at={1} total={1} onExit={onExit}>
      <div className="drill-done">
        <span className="big hanzi">{missed.length ? '差不多' : '好'}</span>
        <h2 style={{ fontSize: 17, margin: '4px 0 2px' }}>
          {clean} of {log.length} without a slip
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          {plan.left > 0 || still > 0
            ? `${still} still due — they keep until the next session.`
            : 'Everything due today is done.'}
        </p>

        {up.length > 0 && (
          <div className="session-group">
            <span className="session-label">Moved up · {up.length}</span>
            <div className="session-chips">{up.map(label)}</div>
          </div>
        )}
        {missed.length > 0 && (
          <div className="session-group">
            <span className="session-label">Missed · back soon</span>
            <div className="session-chips">{missed.map(label)}</div>
            <CollectionPicker
              placeholder={missed.length === 1 ? 'Put this one on paper…' : `Put these ${missed.length} on paper…`}
              onPick={(target) => collect(target, missed, { newName: `Missed — ${new Date().toLocaleDateString()}` })}
              style={{ maxWidth: 320 }}
            />
          </div>
        )}
        {stubborn.length > 0 && (
          <div className="session-group">
            <span className="session-label">Stubborn · missed four times or more</span>
            <div className="session-chips">{stubborn.map(label)}</div>
            <button className="btn sm" onClick={() => navigate(`${paths.learn()}?again=${encodeURIComponent(stubborn.join(','))}`, { replace: true })}>
              Meet these again
            </button>
          </div>
        )}

        <div className="row" style={{ marginTop: 6, justifyContent: 'center' }}>
          {!lessonDone && (
            <button className="btn primary" onClick={() => navigate(paths.learn(), { replace: true })}>
              Next: learn something new
            </button>
          )}
          {still > 0 && (
            <button className={`btn${lessonDone ? ' primary' : ''}`} onClick={onAgain}>
              Another session
            </button>
          )}
          <button className="btn ghost" onClick={onExit}>
            Back to Today
          </button>
        </div>
      </div>
    </DrillFrame>
  );
}
