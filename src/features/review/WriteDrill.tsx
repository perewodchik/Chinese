import { useEffect, useMemo, useState } from 'react';
import { questionFor } from '../../domain/drill';
import type { ItemId } from '../../domain/ids';
import type { Rating } from '../../domain/memory';
import { bestMatch, matchStroke, medianPoints, type Pt } from '../../domain/stroke';
import { Glyph } from '../../ui/Glyph';
import { StrokeCanvas } from '../../ui/StrokeCanvas';
import { useLibrary } from '../shared/library';
import { DrillDone, DrillFrame, useDrillRun } from './DrillFrame';

interface Props {
  ids: ItemId[];
  onExit: () => void;
}

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
const ordinal = (n: number) => ORDINAL[n] ?? `${n + 1}th`;

/**
 * Write it from memory, on an empty square, and be told stroke by stroke
 * whether you were right.
 *
 * This is the exercise the app was missing. Every practice sheet it prints has
 * the character standing at the top of the block, which makes writing it out
 * an act of copying — pleasant, useful for the hand, and almost worthless as
 * memory. Here there is nothing to copy from: the prompt is the meaning and
 * the sound, the square is empty, and what you produce is checked against the
 * real stroke medians.
 *
 * The grade is taken from what happened rather than asked for, because unlike
 * the recall drill there is nothing to be honest about — the strokes either
 * came out in the right order or they did not.
 */
export function WriteDrill({ ids, onExit }: Props) {
  const lib = useLibrary();
  const run = useDrillRun(ids, 'write');
  const q = useMemo(() => (run.id ? questionFor(lib, run.id) : null), [lib, run.id]);
  const data = q ? lib.strokes[q.char] : undefined;
  const total = data?.s.length ?? 0;

  const [done, setDone] = useState(0);
  const [misses, setMisses] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(false);
  const [note, setNote] = useState('');
  const [flash, setFlash] = useState<'ok' | 'miss' | null>(null);
  const [over, setOver] = useState<null | 'finished' | 'gave-up'>(null);
  /**
   * Set the first time a stylus touches the glass, and kept for the rest of
   * the sitting. From then on a finger is a palm resting on the screen, not an
   * attempt to write — which is what makes it possible to write the way you
   * would on paper, with your hand down.
   */
  const [penOnly, setPenOnly] = useState(false);

  useEffect(() => {
    setDone(0);
    setMisses(0);
    setWrong(0);
    setHint(false);
    setNote('');
    setFlash(null);
    setOver(null);
  }, [run.id]);

  // A finished character is worth a moment on screen before the next prompt.
  useEffect(() => {
    if (over !== 'finished') return;
    const rating: Rating = misses === 0 ? 'good' : misses <= 2 ? 'hard' : 'again';
    const id = setTimeout(() => run.answer(rating), 900);
    return () => clearTimeout(id);
  }, [over, misses, run]);

  function onStroke(pts: Pt[]) {
    if (!data?.m || over) return;
    const expected = medianPoints(data.m[done]);
    const m = matchStroke(pts, expected);

    if (m.ok) {
      const next = done + 1;
      setDone(next);
      setWrong(0);
      setHint(false);
      setNote('');
      setFlash('ok');
      setTimeout(() => setFlash(null), 200);
      if (next >= total) setOver('finished');
      return;
    }

    const tries = wrong + 1;
    setWrong(tries);
    setMisses((n) => n + 1);
    setFlash('miss');
    setTimeout(() => setFlash(null), 350);

    if (m.reason === 'direction') {
      setNote('Right line, wrong way round — start at the dot.');
    } else if (m.reason === 'tiny') {
      setNote('That was a tap. Draw the whole stroke.');
    } else {
      const later = bestMatch(
        pts,
        data.m,
        Array.from({ length: total - done - 1 }, (_, i) => done + 1 + i),
      );
      setNote(
        later
          ? `That is the ${ordinal(later.index)} stroke — the ${ordinal(done)} comes first.`
          : `Not the ${ordinal(done)} stroke.`,
      );
    }

    // Two goes is enough to establish that it is not coming. Showing the line
    // is worth more than a third guess, and it is counted against the grade.
    if (tries >= 2) setHint(true);
  }

  if (!run.id || !q) {
    return (
      <DrillFrame title="Write it" hint="" at={run.total} total={run.total} onExit={onExit}>
        <DrillDone log={run.log} skill="write" onExit={onExit} />
      </DrillFrame>
    );
  }

  if (!data?.m) {
    return (
      <DrillFrame title="Write it" hint="" at={run.at} total={run.total} onExit={onExit}>
        <div className="empty">
          <span className="big">…</span>
          Still loading the outlines for this one.
          <button className="btn sm" onClick={() => run.answer('hard')} style={{ marginTop: 10 }}>
            Skip it
          </button>
        </div>
      </DrillFrame>
    );
  }

  return (
    <DrillFrame
      title="Write it"
      hint="From the meaning and the sound. Nothing to copy."
      at={run.at}
      total={run.total}
      onExit={onExit}
    >
      <div className="write-prompt">
        <div className="reading big-reading">{q.py}</div>
        <div className="gloss">{q.gloss}</div>
      </div>

      <StrokeCanvas
        char={q.char}
        strokes={lib.strokes}
        done={done}
        hint={hint}
        ghost={over === 'gave-up'}
        flash={flash}
        disabled={Boolean(over)}
        penOnly={penOnly}
        onPenDetected={() => setPenOnly(true)}
        onStroke={onStroke}
      />

      {penOnly && (
        <button
          className="chip pen-note"
          aria-pressed
          onClick={() => setPenOnly(false)}
          title="Turn this off to write with a finger again"
        >
          ✎ Pencil only — rest your hand
        </button>
      )}

      <div className="write-status">
        <span className="tiny muted">
          {over === 'finished'
            ? misses === 0
              ? 'All of it, first time.'
              : `Done — ${misses} ${misses === 1 ? 'miss' : 'misses'}.`
            : over === 'gave-up'
              ? `${q.char} — ${total} strokes`
              : `stroke ${done + 1} of ${total}`}
        </span>
        <span className="tiny" style={{ color: 'var(--accent)', minHeight: 16 }}>
          {note}
        </span>
      </div>

      {over === 'gave-up' ? (
        <div className="write-actions">
          <Glyph char={q.char} strokes={lib.strokes} size={54} />
          <button className="btn primary" onClick={() => run.answer('again')}>
            Next
          </button>
        </div>
      ) : (
        !over && (
          <div className="write-actions">
            <button className="btn ghost sm" onClick={() => setHint(true)} disabled={hint}>
              Show the stroke
            </button>
            <button
              className="btn ghost sm"
              onClick={() => {
                setDone(total);
                setOver('gave-up');
                setNote('');
              }}
            >
              I can't write it
            </button>
          </div>
        )
      )}
    </DrillFrame>
  );
}
