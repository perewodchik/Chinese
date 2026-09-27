import { useRef, useState } from 'react';
import { TONE_MARK } from '../../domain/drill';
import type { Exercise } from '../../domain/exercises/generate';
import { withTone } from '../../domain/pinyin/syllable';
import { say } from '../../platform/audio/voiceOut';
import { Settle, useAutoNext, useClock, useKeys, type ExerciseResult } from './parts';

type TonesExercise = Extract<Exercise, { kind: 'tones' }>;

const TONES = [1, 2, 3, 4, 5];

/**
 * The syllables without their tones; mark each. The tone pattern of a whole
 * word — 3 then 1, 2 then 4 — is what goes first in speech, so it is asked
 * as a pattern, syllable by syllable, and told apart by the mark's shape,
 * never by colour. Keys: 1–5 for the syllable in hand.
 */
export function TonesCard({ ex, onDone }: { ex: TonesExercise; onDone: (r: ExerciseResult[]) => void }) {
  const [chosen, setChosen] = useState<Array<number | null>>(() => ex.syllables.map(() => null));
  const [verdict, setVerdict] = useState<'right' | 'wrong' | 'retry' | null>(null);
  const [misses, setMisses] = useState(0);
  const clock = useClock();
  const result = useRef<ExerciseResult | null>(null);
  const settled = verdict === 'right' || verdict === 'wrong';
  const chars = [...ex.text];
  // A single syllable needs no Check: the pick is the answer.
  const single = ex.syllables.length === 1;

  function choose(i: number, t: number) {
    if (settled) return;
    if (verdict === 'retry') setVerdict(null);
    setChosen((c) => c.map((x, k) => (k === i ? t : x)));
  }

  function check(picks = chosen) {
    if (settled || picks.some((c) => c === null)) return;
    const ok = picks.every((t, i) => t === ex.syllables[i]!.tone);
    if (!ok && misses === 0) {
      setMisses(1);
      setVerdict('retry');
      return;
    }
    const m = misses + (ok ? 0 : 1);
    result.current = { id: ex.ids[0]!, skill: ex.skill, ok, misses: m, ms: clock(), tier: ex.tier, weight: ex.weight };
    setVerdict(ok ? 'right' : 'wrong');
    void say(ex.say);
  }

  // A single tone got right needs no Continue.
  useAutoNext(single && verdict === 'right', () => result.current && onDone([result.current]), 900);

  useKeys((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      check();
      return;
    }
    const n = Number(e.key);
    const at = chosen.findIndex((c) => c === null);
    if (n >= 1 && n <= 5) {
      choose(at < 0 ? chosen.length - 1 : at, n);
      if (single) check([n]);
    }
  }, !settled);

  return (
    <div className="ex-card" data-kind="tones">
      <p className="ex-ask">{ex.ask}</p>
      <div className="ex-prompt">
        <span className="ex-hanzi hanzi" lang="zh-CN" data-len={chars.length}>
          {ex.text}
        </span>
        <span className="ex-en">{ex.gloss}</span>
      </div>
      <div className="ex-tones">
        {ex.syllables.map((s, i) => {
          const pick = chosen[i];
          const right = settled && pick === s.tone;
          return (
            <div key={i} className="ex-tone-row" data-state={settled ? (right ? 'right' : 'wrong') : undefined}>
              <span className="ex-syl">
                <b className="hanzi">{chars[i] ?? ''}</b>
                <i>{settled ? s.py : pick ? withTone(s.bare, pick) : s.bare}</i>
              </span>
              <span className="ex-tone-buttons">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="ex-tone"
                    aria-pressed={pick === t}
                    data-state={settled && t === s.tone ? 'right' : settled && pick === t ? 'wrong' : undefined}
                    disabled={settled}
                    onClick={() => {
                      choose(i, t);
                      if (single) check([t]);
                    }}
                    title={t === 5 ? 'neutral' : `tone ${t}`}
                  >
                    <b>{TONE_MARK[t]}</b>
                    <i>{t === 5 ? 'light' : t}</i>
                  </button>
                ))}
              </span>
            </div>
          );
        })}
      </div>
      {!settled && !single && (
        <button type="button" className="btn primary ex-check" disabled={chosen.some((c) => c === null)} onClick={() => check()}>
          Check<span className="key-hint"> — enter</span>
        </button>
      )}
      <Settle
        verdict={verdict}
        reveal={{ hanzi: ex.text, py: ex.syllables.map((s) => s.py).join(' '), en: ex.gloss }}
        onNext={settled ? () => result.current && onDone([result.current]) : undefined}
      />
    </div>
  );
}
