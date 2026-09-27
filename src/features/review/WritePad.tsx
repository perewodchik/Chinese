import { useEffect, useRef, useState } from 'react';
import type { Rating } from '../../domain/memory';
import { bestMatch, matchStroke, medianPoints, type Pt } from '../../domain/stroke';
import { Glyph } from '../../ui/Glyph';
import { StrokeCanvas } from '../../ui/StrokeCanvas';
import { useLibrary } from '../shared/library';

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
const ordinal = (n: number) => ORDINAL[n] ?? `${n + 1}th`;

/**
 * Write it from memory, on an empty square, and be told stroke by stroke
 * whether you were right.
 *
 * There is nothing to copy from: the prompt is the meaning and the sound,
 * the square is empty, and what you produce is checked against the real
 * stroke medians. The grade is taken from what happened rather than asked
 * for — the strokes either came out in the right order or they did not.
 *
 * One character; give it a fresh `key` for the next. Used by the Write it
 * drill and by the daily session.
 */
export function WritePad({ char, py, gloss, onDone }: { char: string; py: string; gloss: string; onDone: (r: Rating) => void }) {
  const lib = useLibrary();
  const data = lib.strokes[char];
  const total = data?.s.length ?? 0;

  const [done, setDone] = useState(0);
  const [misses, setMisses] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(false);
  const [note, setNote] = useState('');
  const [flash, setFlash] = useState<'ok' | 'miss' | null>(null);
  const [over, setOver] = useState<null | 'finished' | 'gave-up'>(null);
  /**
   * Set the first time a stylus touches the glass. From then on a finger is a
   * palm resting on the screen, not an attempt to write — which is what makes
   * it possible to write the way you would on paper, with your hand down.
   */
  const [penOnly, setPenOnly] = useState(false);
  // The parent's callback changes with every render; the timer below must not.
  const finish = useRef(onDone);
  finish.current = onDone;

  // A finished character is worth a moment on screen before the next prompt.
  useEffect(() => {
    if (over !== 'finished') return;
    const rating: Rating = misses === 0 ? 'good' : misses <= 2 ? 'hard' : 'again';
    const id = setTimeout(() => finish.current(rating), 900);
    return () => clearTimeout(id);
  }, [over, misses]);

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

  if (!data?.m) {
    return (
      <div className="empty">
        <span className="big">…</span>
        Still loading the outlines for this one.
        <button className="btn sm" onClick={() => onDone('hard')} style={{ marginTop: 10 }}>
          Skip it
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="write-prompt">
        <div className="reading big-reading">{py}</div>
        <div className="gloss">{gloss}</div>
      </div>

      <StrokeCanvas
        char={char}
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
              ? `${char} — ${total} strokes`
              : `stroke ${done + 1} of ${total}`}
        </span>
        <span className="tiny" style={{ color: 'var(--accent)', minHeight: 16 }}>
          {note}
        </span>
      </div>

      {over === 'gave-up' ? (
        <div className="write-actions">
          <Glyph char={char} strokes={lib.strokes} size={54} />
          <button className="btn primary" onClick={() => onDone('again')}>
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
    </>
  );
}
