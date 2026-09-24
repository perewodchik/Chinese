import { useEffect, useMemo, useRef, useState } from 'react';
import { confusionChoices, questionFor } from '../../domain/drill';
import type { ItemId } from '../../domain/ids';
import { Glyph } from '../../ui/Glyph';
import { useLibrary } from '../shared/library';
import { DrillDone, DrillFrame, PICK_WEIGHT, useDrillRun } from './DrillFrame';

interface Props {
  ids: ItemId[];
  onExit: () => void;
}

const CHOICES = 4;
const FLUENT_MS = 4000;

/**
 * Which of these four is it.
 *
 * Everywhere else in the app, multiple choice would be a way of making a hard
 * question easy. Here it is the whole exercise: the three wrong answers are
 * the character's own look-alikes, so the only way through is the difference
 * between them — the extra stroke, the closed corner, the radical on the left
 * instead of underneath.
 *
 * The app has always known these pairs and only ever warned you about them.
 * A warning is not a discrimination: you learn to tell 己 from 已 by having to
 * choose, and being told immediately whether you were right.
 */
export function ConfuseDrill({ ids, onExit }: Props) {
  const lib = useLibrary();
  const run = useDrillRun(ids, 'recognise', PICK_WEIGHT);
  const [picked, setPicked] = useState<string | null>(null);
  const asked = useRef(Date.now());
  const q = useMemo(() => (run.id ? questionFor(lib, run.id) : null), [lib, run.id]);

  const choices = useMemo(
    () => (q ? confusionChoices(lib, q.char, CHOICES, q.char.codePointAt(0) ?? 1) : []),
    [lib, q],
  );

  useEffect(() => {
    setPicked(null);
    asked.current = Date.now();
  }, [run.id]);

  useEffect(() => {
    if (picked === null || !q) return;
    const right = picked === q.char;
    const quick = Date.now() - asked.current < FLUENT_MS;
    const id = setTimeout(() => run.answer(right ? (quick ? 'good' : 'hard') : 'again'), right ? 550 : 1700);
    return () => clearTimeout(id);
  }, [picked, q, run]);

  if (!run.id || !q) {
    return (
      <DrillFrame title="Look-alikes" hint="" at={run.total} total={run.total} onExit={onExit}>
        <DrillDone log={run.log} skill="recognise" onExit={onExit} />
      </DrillFrame>
    );
  }

  return (
    <DrillFrame
      title="Look-alikes"
      hint="Three of these are the ones it gets mistaken for."
      at={run.at}
      total={run.total}
      onExit={onExit}
    >
      <div className="prompt-card">
        <div className="reading big-reading">{q.py}</div>
        <div className="gloss">{q.gloss}</div>
      </div>

      <div className="choice-row">
        {choices.map((c) => {
          const state =
            picked === null ? undefined : c === q.char ? 'right' : c === picked ? 'wrong' : undefined;
          return (
            <button
              key={c}
              className="choice"
              data-state={state}
              disabled={picked !== null}
              onClick={() => setPicked(c)}
            >
              <Glyph char={c} strokes={lib.strokes} size={64} />
              {picked !== null && <span className="tiny muted">{lib.byChar.get(c)?.py[0] ?? ''}</span>}
            </button>
          );
        })}
      </div>

      <p className="tiny muted" style={{ minHeight: 18 }}>
        {picked === null
          ? ' '
          : picked === q.char
            ? 'Yes.'
            : `That one is ${lib.byChar.get(picked)?.py[0]} — ${lib.byChar.get(picked)?.def}`}
      </p>
    </DrillFrame>
  );
}
