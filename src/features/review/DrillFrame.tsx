import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { paths } from '../../navigation/paths';
import { getState, useStore } from '../../store/store';
import { nextSitting, type NextSitting } from './drills';
import { MAX_REPEATS, requeueAt, selfRating } from '../../domain/grading';
import type { ItemId } from '../../domain/ids';
import { RATING_META, RATINGS, type Rating, type Skill } from '../../domain/memory';
import { gradeItem } from '../../store/commands';
import { Glyph } from '../../ui/Glyph';
import { CollectionPicker, useCollect } from '../shared/collect';
import { useLibrary } from '../shared/library';
import './session.css';

export interface DrillResult {
  id: ItemId;
  rating: Rating;
}

/**
 * One sitting, answer by answer.
 *
 * Each answer is written to the scheduler as it is given rather than at the
 * end, so walking away in the middle keeps everything up to that point. A
 * review you abandoned is still a review you did.
 *
 * A card that is missed comes back a few cards later, and keeps coming back
 * (up to a limit) until it is got right. That second and third meeting, while
 * the answer is still warm, is where most of a first day's learning happens —
 * but it is practice, not evidence: only the first answer to a card goes to
 * the scheduler, and only the first answers make up the log.
 */
export function useDrillRun(
  ids: ItemId[],
  skill: Skill,
  weight?: number,
  /** whether an answer sends the card round again; by default, only a miss */
  again: (id: ItemId, rating: Rating, first: boolean) => boolean = (_id, r) => r === 'again',
) {
  const [queue, setQueue] = useState<ItemId[]>(ids);
  const [at, setAt] = useState(0);
  const [log, setLog] = useState<DrillResult[]>([]);
  const answered = useRef(new Set<ItemId>());
  const repeats = useRef(new Map<ItemId, number>());
  const startedAt = useRef(Date.now());
  const revealedAt = useRef<number | null>(null);
  const id = queue[at] as ItemId | undefined;

  // The clock restarts with every card, including a card that comes straight back.
  useEffect(() => {
    startedAt.current = Date.now();
    revealedAt.current = null;
  }, [at]);

  const answer = useCallback(
    (rating: Rating) => {
      if (!id) return;
      const first = !answered.current.has(id);
      if (first) {
        answered.current.add(id);
        gradeItem(id, skill, rating, weight);
        setLog((l) => [...l, { id, rating }]);
      }
      const n = repeats.current.get(id) ?? 0;
      if (again(id, rating, first) && n < MAX_REPEATS) {
        repeats.current.set(id, n + 1);
        setQueue((q) => {
          const next = [...q];
          next.splice(requeueAt(at, q.length), 0, id);
          return next;
        });
      }
      setAt((a) => a + 1);
    },
    [id, at, skill, weight, again],
  );

  /** Past this one without a grade: nothing was asked, so nothing is recorded. */
  const skip = useCallback(() => {
    if (id) setAt((n) => n + 1);
  }, [id]);

  /** The answer was shown: the time spent before it is what the self-grade reads. */
  const reveal = useCallback(() => {
    revealedAt.current ??= Date.now();
  }, []);

  /** Forgot / Got it, turned into a rating by how long the thinking took. */
  const gotIt = useCallback(
    (got: boolean) => {
      if (!id) return;
      const think = (revealedAt.current ?? Date.now()) - startedAt.current;
      const had = getState().recall[id]?.[skill];
      answer(selfRating(got, think, !had || had.claim === true));
    },
    [id, skill, answer],
  );

  return {
    at,
    id,
    total: queue.length,
    log,
    answer,
    skip,
    reveal,
    gotIt,
    /** this card has been answered before in this sitting: it is back because it was missed */
    repeat: Boolean(id && answered.current.has(id)),
  };
}

export type DrillRun = ReturnType<typeof useDrillRun>;

/**
 * What a right pick is worth in the drills that show the answer among others.
 *
 * Choosing the tone out of five, or the character out of its look-alikes, is
 * recognition of an answer on screen — easier than producing it. Those drills
 * share a schedule with Say it and Recognise, so a full-weight pass there
 * would push the harder question back without having asked it.
 */
export const PICK_WEIGHT = 0.5;

/**
 * Space or Enter shows the answer; then 1 is Forgot and 2 (or Space) is Got it
 * — or, with four buttons, 1 to 4 grade it.
 */
export function useRevealKeys(active: boolean, shown: boolean, reveal: () => void, run: Pick<DrillRun, 'answer' | 'gotIt'>) {
  const four = useStore((s) => s.settings.fourButtons);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea')) return;
      if (!shown) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          reveal();
        }
        return;
      }
      if (four) {
        const rating = RATINGS[Number(e.key) - 1];
        if (rating) run.answer(rating);
        return;
      }
      if (e.key === '1') run.gotIt(false);
      else if (e.key === '2' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        run.gotIt(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, shown, reveal, run, four]);
}

export function DrillFrame({
  title,
  hint,
  at,
  total,
  onExit,
  children,
  dots,
}: {
  title: string;
  hint: string;
  at: number;
  total: number;
  onExit: () => void;
  children: ReactNode;
  /** the last few answers, oldest first: a row of dots that fills as you go */
  dots?: Array<'right' | 'nearly' | 'wrong'>;
}) {
  return (
    <section className="drill">
      <div className="drill-head">
        <button className="btn ghost sm" onClick={onExit} title="Stop here — everything answered is kept">
          ← Stop
        </button>
        <div style={{ minWidth: 0 }}>
          <b>{title}</b>
          <div className="tiny muted">{hint}</div>
        </div>
        <div className="spacer" />
        {dots && (
          <span className="drill-dots" aria-label={`${dots.filter((d) => d === 'right').length} of the last ${dots.length} right`}>
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} data-state={dots[dots.length - 10 + i]} />
            ))}
          </span>
        )}
        <span className="tiny muted">
          {Math.min(at + 1, total)} of {total}
        </span>
        <div className="bar" style={{ width: 140 }}>
          <i className="learned" style={{ width: `${(at / Math.max(1, total)) * 100}%` }} />
        </div>
      </div>
      <div className="drill-stage">{children}</div>
    </section>
  );
}

/** The four buttons, and the keys 1 to 4, in the order they cost you time. */
export function RatingRow({ onRate, only }: { onRate: (r: Rating) => void; only?: Rating[] }) {
  return (
    <div className="rating-row">
      {(only ?? RATINGS).map((r, i) => (
        <button key={r} className={`rate ${r}`} onClick={() => onRate(r)}>
          <b>{RATING_META[r].label}</b>
          <span>{RATING_META[r].hint}</span>
          <i>{i + 1}</i>
        </button>
      ))}
    </div>
  );
}

/**
 * How a self-graded card is answered: Forgot / Got it, with the clock
 * deciding how well — or the four buttons, for whoever asked for them in
 * Settings.
 */
export function SelfGrade({ run }: { run: Pick<DrillRun, 'answer' | 'gotIt'> }) {
  const four = useStore((s) => s.settings.fourButtons);
  if (four) return <RatingRow onRate={run.answer} />;
  return (
    <div className="rating-row two">
      <button className="rate again" onClick={() => run.gotIt(false)}>
        <b>Forgot</b>
        <span>Ask me again soon</span>
        <i>1</i>
      </button>
      <button className="rate good" onClick={() => run.gotIt(true)}>
        <b>Got it</b>
        <span>How quickly decides when it comes back</span>
        <i>2</i>
      </button>
    </div>
  );
}

/**
 * What the sitting came to.
 *
 * The list of things you got wrong is the useful output, and it is offered as a
 * collection rather than as a score — the answer to "I could not write six of
 * those" is a sheet with those six on it, which is the app this is part of.
 */
/**
 * What to go on to once a sitting is over, worked out as it ends — so that
 * "go over what is due" is one run through every drill with something due,
 * not a trip back to the list between each.
 */
function useNextSitting(): NextSitting | null {
  const lib = useLibrary();
  const { pathname } = useLocation();
  const recall = useStore((s) => s.recall);
  const learned = useStore((s) => s.learned);
  const collections = useStore((s) => s.collections);
  const perDay = useStore((s) => s.settings.newWordsPerDay);
  const after = pathname.split('/')[2];
  return useMemo(
    () => nextSitting(lib, recall, learned, collections, perDay, Date.now(), after),
    [lib, recall, learned, collections, perDay, after],
  );
}

export function DrillDone({ log, skill, onExit }: { log: DrillResult[]; skill: Skill; onExit: () => void }) {
  const lib = useLibrary();
  const collect = useCollect();
  const next = useNextSitting();
  const navigate = useNavigate();
  const missed = log.filter((r) => r.rating === 'again').map((r) => r.id);
  const good = log.filter((r) => r.rating === 'good' || r.rating === 'easy').length;

  function putOnPaper(target: string) {
    collect(target, missed, { newName: `Missed — ${new Date().toLocaleDateString()}` });
    onExit();
  }

  return (
    <div className="drill-done">
      <span className="big hanzi">{missed.length ? '差不多' : '好'}</span>
      <h2 style={{ fontSize: 17, margin: '4px 0 2px' }}>
        {good} of {log.length} without hesitating
      </h2>
      <p className="small muted" style={{ margin: 0 }}>
        {missed.length
          ? `${missed.length} came back wrong, and will be asked again soon.`
          : 'Nothing missed. These will not come round for a while.'}
      </p>

      {missed.length > 0 && (
        <>
          <div className="missed-row">
            {missed.map((id) => (
              <span key={id} className="new-char">
                {[...id.slice(1)].length === 1 ? (
                  <Glyph char={id.slice(1)} strokes={lib.strokes} size={30} />
                ) : (
                  <span className="hanzi" style={{ fontSize: 24, lineHeight: '30px' }}>
                    {id.slice(1)}
                  </span>
                )}
                <span className="tiny muted">{lib.byChar.get(id.slice(1))?.py[0] ?? lib.byWord.get(id.slice(1))?.py}</span>
              </span>
            ))}
          </div>
          {skill !== 'sound' && (
            <CollectionPicker
              placeholder={missed.length === 1 ? 'Put this one on paper…' : `Put these ${missed.length} on paper…`}
              onPick={putOnPaper}
              style={{ maxWidth: 320 }}
            />
          )}
        </>
      )}

      <div className="row" style={{ marginTop: 6, justifyContent: 'center' }}>
        {next && (
          <button
            className="btn primary"
            onClick={() => navigate(next.id === 'words' ? paths.wordDrill() : paths.drill(next.id), { replace: true })}
          >
            Next: {next.name} · {next.due} due
          </button>
        )}
        <button className={`btn${next ? '' : ' primary'}`} onClick={onExit}>
          {next ? 'Back to Today' : 'Done'}
        </button>
      </div>
    </div>
  );
}
