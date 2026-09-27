import { useMemo, useRef, useState } from 'react';
import type { Exercise } from '../../domain/exercises/generate';
import { makeRng } from '../../domain/exercises/rng';
import type { ItemId } from '../../domain/ids';
import { say } from '../../platform/audio/voiceOut';
import { FaceView, Settle, useAutoNext, useClock, type ExerciseResult } from './parts';

type MatchExercise = Extract<Exercise, { kind: 'match' }>;

/**
 * The board: characters down the left, their partners down the right, in a
 * different order. Tap one on either side, then its partner. A pair that
 * belongs together settles (and says itself); one that does not flashes and
 * lets go. Each wrong pairing counts against the item on the left.
 *
 * Settled cards keep their place, so the board never reflows mid-game.
 */
export function MatchCard({ ex, onDone }: { ex: MatchExercise; onDone: (r: ExerciseResult[]) => void }) {
  const right = useMemo(() => makeRng(ex.ids.join('')).shuffle(ex.pairs), [ex]);
  const [sel, setSel] = useState<{ side: 'l' | 'r'; id: ItemId } | null>(null);
  const [done, setDone] = useState<Set<ItemId>>(new Set());
  const [flash, setFlash] = useState<{ l: ItemId; r: ItemId } | null>(null);
  const misses = useRef(new Map<ItemId, number>());
  const clock = useClock();
  const [results, setResults] = useState<ExerciseResult[] | null>(null);

  function tap(side: 'l' | 'r', id: ItemId) {
    if (done.has(id) || results) return;
    if (side === 'r' && ex.mode === 'listen') void say(ex.pairs.find((p) => p.id === id)!.say);
    if (!sel || sel.side === side) {
      setSel({ side, id });
      return;
    }
    const l = side === 'l' ? id : sel.id;
    const r = side === 'r' ? id : sel.id;
    setSel(null);
    if (l === r) {
      const next = new Set(done).add(l);
      setDone(next);
      if (ex.mode !== 'listen') void say(ex.pairs.find((p) => p.id === l)!.say);
      if (next.size === ex.pairs.length) {
        const ms = clock() / ex.pairs.length;
        setResults(
          ex.pairs.map((p) => {
            const m = misses.current.get(p.id) ?? 0;
            return { id: p.id, skill: ex.skill, ok: m < 2, misses: m, ms, tier: ex.tier, weight: ex.weight };
          }),
        );
      }
    } else {
      misses.current.set(l, (misses.current.get(l) ?? 0) + 1);
      setFlash({ l, r });
      window.setTimeout(() => setFlash(null), 450);
    }
  }

  const clean = results?.every((r) => r.misses === 0) ?? false;
  const finish = () => results && onDone(results);
  useAutoNext(Boolean(results) && clean, finish, 900);

  const state = (side: 'l' | 'r', id: ItemId) =>
    done.has(id) ? 'done' : flash && flash[side] === id ? 'wrong' : sel?.side === side && sel.id === id ? 'selected' : undefined;

  return (
    <div className="ex-card" data-kind="match">
      <p className="ex-ask">{ex.ask}</p>
      <div className="ex-match" data-mode={ex.mode}>
        <div className="ex-match-col">
          {ex.pairs.map((p) => (
            <button key={p.id} type="button" className="ex-match-card" data-state={state('l', p.id)} onClick={() => tap('l', p.id)}>
              <span className="hanzi" lang="zh-CN">
                {p.left.hanzi}
              </span>
            </button>
          ))}
        </div>
        <div className="ex-match-col">
          {right.map((p) => (
            <button key={p.id} type="button" className="ex-match-card" data-state={state('r', p.id)} onClick={() => tap('r', p.id)}>
              {ex.mode === 'listen' ? (
                <span className="ex-match-sound" aria-label="a sound">
                  🔊
                </span>
              ) : (
                <FaceView face={p.right} size="sm" autoPlay={false} />
              )}
            </button>
          ))}
        </div>
      </div>
      <Settle
        verdict={results ? (clean ? 'right' : 'also') : null}
        note={results && !clean ? `${results.filter((r) => r.misses).length} took more than one go; they will come round again.` : undefined}
        onNext={results ? finish : undefined}
      />
    </div>
  );
}
