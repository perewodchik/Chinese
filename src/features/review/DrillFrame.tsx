import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { nextSitting, type NextSitting } from './drills';
import type { ItemId } from '../../domain/ids';
import { RATING_META, RATINGS, type Rating, type Skill } from '../../domain/memory';
import { gradeItem } from '../../store/commands';
import { Glyph } from '../../ui/Glyph';
import { CollectionPicker, useCollect } from '../shared/collect';
import { useLibrary } from '../shared/library';

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
 */
export function useDrillRun(ids: ItemId[], skill: Skill, weight?: number) {
  const [at, setAt] = useState(0);
  const [log, setLog] = useState<DrillResult[]>([]);

  const answer = useCallback(
    (rating: Rating) => {
      const id = ids[at];
      if (!id) return;
      gradeItem(id, skill, rating, weight);
      setLog((l) => [...l, { id, rating }]);
      setAt((n) => n + 1);
    },
    [ids, at, skill, weight],
  );

  /** Past this one without a grade: nothing was asked, so nothing is recorded. */
  const skip = useCallback(() => {
    if (ids[at]) setAt((n) => n + 1);
  }, [ids, at]);

  return { at, id: ids[at] as ItemId | undefined, total: ids.length, log, answer, skip };
}

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
 * Space or Enter shows the answer, and 1 to 4 grade it: the keyboard way through
 * a drill that shows the answer and asks how it went.
 */
export function useRevealKeys(
  active: boolean,
  shown: boolean,
  reveal: () => void,
  rate: (rating: Rating) => void,
) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!shown && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        reveal();
        return;
      }
      const rating = shown ? RATINGS[Number(e.key) - 1] : undefined;
      if (rating) rate(rating);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, shown, reveal, rate]);
}

export function DrillFrame({
  title,
  hint,
  at,
  total,
  onExit,
  children,
}: {
  title: string;
  hint: string;
  at: number;
  total: number;
  onExit: () => void;
  children: ReactNode;
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
                <Glyph char={id.slice(1)} strokes={lib.strokes} size={30} />
                <span className="tiny muted">{lib.byChar.get(id.slice(1))?.py[0]}</span>
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
