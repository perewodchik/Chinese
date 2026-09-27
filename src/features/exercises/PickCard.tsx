import { useRef, useState } from 'react';
import type { Exercise } from '../../domain/exercises/generate';
import { say } from '../../platform/audio/voiceOut';
import { FaceView, Settle, useAutoNext, useClock, useKeys, type ExerciseResult } from './parts';

type PickExercise = Extract<Exercise, { options: unknown }>;

/**
 * One of three or four. Two tries: a wrong pick stays marked and the second
 * pick is the last; then the answer is shown either way.
 */
export function PickCard({ ex, onDone }: { ex: PickExercise; onDone: (r: ExerciseResult[]) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<'right' | 'wrong' | 'retry' | null>(null);
  const clock = useClock();
  const result = useRef<ExerciseResult | null>(null);
  const settled = verdict === 'right' || verdict === 'wrong';

  function pick(id: string) {
    if (settled || picked.includes(id)) return;
    const next = [...picked, id];
    setPicked(next);
    const misses = next.filter((p) => p !== ex.answer).length;
    if (id === ex.answer || misses >= 2) {
      const ok = id === ex.answer;
      result.current = { id: ex.ids[0]!, skill: ex.skill, ok, misses, ms: clock(), tier: ex.tier, weight: ex.weight };
      setVerdict(ok ? 'right' : 'wrong');
      void say(ex.say);
    } else {
      setVerdict('retry');
    }
  }

  const next = () => result.current && onDone([result.current]);
  useAutoNext(verdict === 'right' && ex.kind !== 'pick-cloze', next);
  useKeys((e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= ex.options.length) pick(ex.options[n - 1]!.id);
  }, !settled);

  return (
    <div className="ex-card" data-kind={ex.kind}>
      <p className="ex-ask">{ex.ask}</p>
      <div className="ex-prompt">
        {ex.gap ? (
          <div className="ex-gap">
            <span className="hanzi" lang="zh-CN">
              {ex.gap.before}
              <span className="ex-blank" data-filled={settled || undefined}>
                {settled ? ex.answer : ' '}
              </span>
              {ex.gap.after}
            </span>
            <span className="ex-en">{ex.gap.en}</span>
          </div>
        ) : (
          <FaceView face={ex.prompt} />
        )}
      </div>
      <div className="ex-options" data-n={ex.options.length} data-text={ex.options.some((o) => o.face.en) || undefined}>
        {ex.options.map((o, i) => {
          const state =
            settled && o.id === ex.answer ? 'right' : picked.includes(o.id) && o.id !== ex.answer ? 'wrong' : undefined;
          return (
            <button
              key={o.id}
              type="button"
              className="ex-option"
              data-state={state}
              disabled={settled || picked.includes(o.id)}
              onClick={() => pick(o.id)}
            >
              <FaceView face={o.face} size="sm" autoPlay={false} />
              <span className="key-hint ex-key">{i + 1}</span>
            </button>
          );
        })}
      </div>
      <Settle verdict={verdict} reveal={ex.reveal} onNext={settled ? next : undefined} />
    </div>
  );
}

type SwipeExercise = Extract<Exercise, { kind: 'swipe' }>;

/**
 * Yes or no, as fast as a thumb: do the picture (or the English) and the word
 * go together? Swipe right for yes, left for no, or the arrow keys, or the
 * buttons. One try — it is a coin toss otherwise.
 */
export function SwipeCard({ ex, onDone }: { ex: SwipeExercise; onDone: (r: ExerciseResult[]) => void }) {
  const [said, setSaid] = useState<boolean | null>(null);
  const [dx, setDx] = useState(0);
  const from = useRef<number | null>(null);
  const clock = useClock();
  const result = useRef<ExerciseResult | null>(null);

  function answer(yes: boolean) {
    if (said !== null) return;
    setSaid(yes);
    setDx(0);
    const ok = yes === ex.truth;
    result.current = { id: ex.ids[0]!, skill: ex.skill, ok, misses: ok ? 0 : 1, ms: clock(), tier: ex.tier, weight: ex.weight };
    void say(ex.say);
  }

  const next = () => result.current && onDone([result.current]);
  const ok = said !== null && said === ex.truth;
  useAutoNext(ok, next, 900);
  useKeys((e) => {
    if (e.key === 'ArrowRight') answer(true);
    if (e.key === 'ArrowLeft') answer(false);
  }, said === null);

  return (
    <div className="ex-card" data-kind="swipe">
      <p className="ex-ask">{ex.ask}</p>
      <div
        className="ex-swipe"
        style={{ transform: `translateX(${dx}px) rotate(${dx / 30}deg)` }}
        data-lean={dx > 40 ? 'yes' : dx < -40 ? 'no' : undefined}
        onPointerDown={(e) => {
          if (said !== null) return;
          from.current = e.clientX;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => from.current !== null && setDx(e.clientX - from.current)}
        onPointerUp={() => {
          if (from.current === null) return;
          from.current = null;
          if (dx > 80) answer(true);
          else if (dx < -80) answer(false);
          else setDx(0);
        }}
        onPointerCancel={() => {
          from.current = null;
          setDx(0);
        }}
      >
        <FaceView face={ex.prompt} size="md" />
        <span className="ex-swipe-word hanzi" lang="zh-CN">
          {ex.shown.hanzi}
        </span>
      </div>
      <div className="ex-yesno">
        <button type="button" className="btn" data-state={said === false ? (ok ? 'right' : 'wrong') : undefined} disabled={said !== null} onClick={() => answer(false)}>
          ← No
        </button>
        <button type="button" className="btn" data-state={said === true ? (ok ? 'right' : 'wrong') : undefined} disabled={said !== null} onClick={() => answer(true)}>
          Yes →
        </button>
      </div>
      <Settle
        verdict={said === null ? null : ok ? 'right' : 'wrong'}
        reveal={ex.reveal}
        note={said !== null && !ex.truth ? `${ex.shown.hanzi} is something else.` : undefined}
        onNext={said !== null ? next : undefined}
      />
    </div>
  );
}
