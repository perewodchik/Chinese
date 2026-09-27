import { useRef, useState } from 'react';
import type { Exercise } from '../../domain/exercises/generate';
import { understood, type HeardResult } from '../../domain/pinyin/heard';
import { canRecognise } from '../../platform/audio/recognition';
import { SayCheck } from '../pinyin/SayCheck';
import '../pinyin/pinyin.css';
import { Settle, useClock, type ExerciseResult } from './parts';

type SpeakExercise = Extract<Exercise, { kind: 'speak' }>;

/**
 * Say it; the browser's speech recognition writes down what it heard, and
 * the card compares it with what was meant, sound by sound. Where the browser
 * cannot listen, it records and plays you back beside the native speaker, and
 * you say whether it matched. "Can't speak now" takes speaking out of the
 * rest of the session — on a bus, say.
 */
export function SpeakCard({ ex, onDone, onSkip }: { ex: SpeakExercise; onDone: (r: ExerciseResult[]) => void; onSkip?: () => void }) {
  const [heard, setHeard] = useState<HeardResult | null>(null);
  const [self, setSelf] = useState<boolean | null>(null);
  const clock = useClock();
  const tries = useRef(0);
  const listens = canRecognise();
  const ok = heard ? understood(heard, ex.text) : self;
  const settled = ok !== null;

  const result = (): ExerciseResult => ({
    id: ex.ids[0]!,
    skill: ex.skill,
    ok: Boolean(ok),
    misses: ok ? Math.max(0, tries.current - 1) : tries.current,
    ms: clock(),
    tier: ex.tier,
    weight: ex.weight,
  });

  return (
    <div className="ex-card" data-kind="speak">
      <p className="ex-ask">{ex.ask}</p>
      <SayCheck
        word={{ word: ex.text, reading: ex.py }}
        onResult={(r) => {
          tries.current++;
          setHeard(r);
        }}
      />
      {!listens && self === null && (
        <div className="ex-yesno">
          <button type="button" className="btn" onClick={() => setSelf(false)}>
            Not quite
          </button>
          <button type="button" className="btn" onClick={() => setSelf(true)}>
            It matched
          </button>
        </div>
      )}
      <Settle
        verdict={settled ? (ok ? 'right' : 'wrong') : null}
        reveal={{ hanzi: ex.text, py: ex.py, en: ex.gloss }}
        onNext={settled ? () => onDone([result()]) : undefined}
      >
        {heard && !ok && (
          <button type="button" className="btn sm" onClick={() => setHeard(null)}>
            Try again
          </button>
        )}
      </Settle>
      {onSkip && !settled && (
        <button type="button" className="btn ghost sm" onClick={onSkip}>
          Can’t speak now
        </button>
      )}
    </div>
  );
}
