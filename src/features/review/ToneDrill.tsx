import { useEffect, useMemo, useRef, useState } from 'react';
import { questionFor, TONE_LABEL, TONE_MARK, withoutTone } from '../../domain/drill';
import type { ItemId } from '../../domain/ids';
import { say } from '../../platform/audio/voiceOut';
import { Glyph } from '../../ui/Glyph';
import { useLibrary } from '../shared/library';
import { DrillDone, DrillFrame, PICK_WEIGHT, useDrillRun } from './DrillFrame';

interface Props {
  ids: ItemId[];
  onExit: () => void;
}

const TONES = [1, 2, 3, 4, 5];

/** Answered quickly enough that you knew it rather than worked it out. */
const FLUENT_MS = 3500;

/**
 * Tone, on its own, at speed.
 *
 * It is the part of a reading that gets dropped first and repaired last: you
 * can carry a thousand characters and still be guessing between the second and
 * the third, because nothing ever forced a choice. So the syllable is given —
 * the question is only ever which of five, which makes it fast enough to do
 * fifty of while the kettle boils.
 *
 * Graded from the answer rather than by asking, because there is nothing to be
 * honest about: it was right or it was not. How long it took separates "knew
 * it" from "worked it out", which are different states and deserve different
 * intervals.
 */
export function ToneDrill({ ids, onExit }: Props) {
  const lib = useLibrary();
  const run = useDrillRun(ids, 'sound', PICK_WEIGHT);
  const [picked, setPicked] = useState<number | null>(null);
  const asked = useRef(Date.now());
  const q = useMemo(() => (run.id ? questionFor(lib, run.id) : null), [lib, run.id]);

  useEffect(() => {
    setPicked(null);
    asked.current = Date.now();
  }, [run.id]);

  useEffect(() => {
    if (picked === null || !q) return;
    // Hearing it immediately after committing to an answer is the whole
    // feedback loop for tones; reading "no, third" teaches much less.
    void say(q.char);
    const right = picked === q.tone;
    const quick = Date.now() - asked.current < FLUENT_MS;
    const id = setTimeout(() => run.answer(right ? (quick ? 'good' : 'hard') : 'again'), right ? 450 : 1300);
    return () => clearTimeout(id);
  }, [picked, q, run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (picked !== null) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) setPicked(n);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picked]);

  if (!run.id || !q) {
    return (
      <DrillFrame title="Tones" hint="" at={run.total} total={run.total} onExit={onExit}>
        <DrillDone log={run.log} skill="sound" onExit={onExit} />
      </DrillFrame>
    );
  }

  return (
    <DrillFrame
      title="Tones"
      hint="The syllable is given. Which tone is it?"
      at={run.at}
      total={run.total}
      onExit={onExit}
    >
      <div className="prompt-card">
        <Glyph char={q.char} strokes={lib.strokes} size={132} />
        <div className="toneless">{withoutTone(q.py)}</div>
        <p className="tiny muted" style={{ margin: 0 }}>
          {picked !== null ? q.gloss : ' '}
        </p>
      </div>

      <div className="tone-row">
        {TONES.map((t) => {
          const state =
            picked === null ? undefined : t === q.tone ? 'right' : t === picked ? 'wrong' : undefined;
          return (
            <button
              key={t}
              className="tone"
              data-state={state}
              disabled={picked !== null}
              onClick={() => setPicked(t)}
            >
              <b>{TONE_MARK[t]}</b>
              <span>{t === 5 ? 'neutral' : `${t}${['st', 'nd', 'rd', 'th'][t - 1]}`}</span>
              <i>{TONE_LABEL[t]}</i>
            </button>
          );
        })}
      </div>

      <p className="tiny muted" style={{ minHeight: 18 }}>
        {picked === null ? '' : picked === q.tone ? `Yes — ${q.py}` : `No — ${q.py}, ${TONE_LABEL[q.tone]}`}
      </p>
    </DrillFrame>
  );
}
