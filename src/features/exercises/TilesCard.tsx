import { useRef, useState } from 'react';
import { checkOrder } from '../../domain/exercises/check';
import type { Exercise } from '../../domain/exercises/generate';
import { say } from '../../platform/audio/voiceOut';
import { FaceView, Settle, useClock, useKeys, type ExerciseResult } from './parts';

type TilesExercise = Extract<Exercise, { tiles: unknown }>;

/**
 * Tap tiles into a line — a word out of its characters, a sentence out of its
 * words, the English out of English words, or a character out of its parts.
 * A placed tile goes back with a tap. Check; one more try after a miss; then
 * the answer.
 *
 * The bank keeps an empty slot where a placed tile was, so the tiles left
 * never move under a finger.
 */
export function TilesCard({ ex, onDone }: { ex: TilesExercise; onDone: (r: ExerciseResult[]) => void }) {
  const [placed, setPlaced] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<'right' | 'also' | 'wrong' | 'retry' | null>(null);
  const [misses, setMisses] = useState(0);
  const clock = useClock();
  const result = useRef<ExerciseResult | null>(null);
  const settled = verdict === 'right' || verdict === 'also' || verdict === 'wrong';
  const english = ex.kind === 'tiles-reverse';
  const full = placed.length >= (ex.ordered ? ex.answer.length : ex.answer.length);

  function place(i: number) {
    if (settled) return;
    if (verdict === 'retry') setVerdict(null);
    setPlaced((p) => (p.includes(i) ? p.filter((x) => x !== i) : ex.ordered || p.length < ex.answer.length ? [...p, i] : p));
  }

  function check() {
    if (!placed.length || settled) return;
    const answer = placed.map((i) => ex.tiles[i]!);
    let v: 'right' | 'also' | 'wrong';
    if (!ex.ordered) {
      v = answer.length === ex.answer.length && ex.answer.every((a) => answer.includes(a)) ? 'right' : 'wrong';
    } else if (english) {
      const norm = (xs: string[]) => xs.join(' ').toLowerCase();
      v = norm(answer) === norm(ex.answer) ? 'right' : 'wrong';
    } else {
      v = checkOrder(answer, ex.answer);
    }
    if (v === 'wrong' && misses === 0) {
      setMisses(1);
      setVerdict('retry');
      return;
    }
    const m = misses + (v === 'wrong' ? 1 : 0);
    result.current = { id: ex.ids[0]!, skill: ex.skill, ok: v !== 'wrong', misses: m, ms: clock(), tier: ex.tier, weight: ex.weight };
    setVerdict(v);
    void say(ex.say);
  }

  useKeys((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      check();
    } else if (e.key === 'Backspace') {
      setPlaced((p) => p.slice(0, -1));
    } else {
      const n = Number(e.key);
      if (n >= 1 && n <= ex.tiles.length) place(n - 1);
    }
  }, !settled);

  return (
    <div className="ex-card" data-kind={ex.kind}>
      <p className="ex-ask">{ex.ask}</p>
      <div className="ex-prompt">
        <FaceView face={ex.prompt} size={ex.prompt.hanzi && [...ex.prompt.hanzi].length > 4 ? 'md' : 'lg'} />
      </div>

      <div className="ex-line" data-state={settled ? (verdict === 'wrong' ? 'wrong' : 'right') : undefined} data-english={english || undefined}>
        {placed.length === 0 && <span className="ex-line-hint tiny muted">Tap the tiles in order</span>}
        {placed.map((i) => (
          <button key={i} type="button" className="ex-tile" data-english={english || undefined} disabled={settled} onClick={() => place(i)}>
            {ex.tiles[i]}
          </button>
        ))}
      </div>

      <div className="ex-bank">
        {ex.tiles.map((t, i) =>
          placed.includes(i) ? (
            <span key={i} className="ex-tile ex-tile-gap" data-english={english || undefined} aria-hidden>
              {t}
            </span>
          ) : (
            <button key={i} type="button" className="ex-tile" data-english={english || undefined} disabled={settled} onClick={() => place(i)}>
              {t}
              <span className="key-hint ex-key">{i + 1}</span>
            </button>
          ),
        )}
      </div>

      {!settled && (
        <button type="button" className="btn primary ex-check" disabled={!placed.length || (!ex.ordered && !full)} onClick={check}>
          Check<span className="key-hint"> — enter</span>
        </button>
      )}
      <Settle
        verdict={verdict}
        reveal={ex.reveal}
        note={verdict === 'also' ? `The sentence had it as ${ex.answer.join('')}.` : undefined}
        onNext={settled ? () => result.current && onDone([result.current]) : undefined}
      />
    </div>
  );
}
