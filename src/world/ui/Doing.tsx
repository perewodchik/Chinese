import { useEffect, useRef, useState } from 'react';
import { matchStroke, medianPoints, type Pt } from '../../domain/stroke';
import { useLibrary } from '../../features/shared/library';
import { StrokeCanvas } from '../../ui/StrokeCanvas';
import type { Choose } from '../core/types';

/**
 * Doing what the line says (X8): one row of picture buttons. After the
 * second wrong pick the right one is marked — help is free.
 */
export function ChoiceRow({ choose, showRight, onPick }: { choose: Choose; showRight: boolean; onPick: (id: string) => void }) {
  return (
    <div className="w-choose" role="group" aria-label="Do what they say">
      {choose.options.map((o) => (
        <button key={o.id} type="button" className="w-choice" data-right={showRight && o.right ? '' : undefined} onClick={() => onPick(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 地书 (X8): write the characters with water on the pavement — one at a
 * time, stroke by stroke against the real strokes, the whole character faint
 * underneath. A finished character dries and fades, then the next one.
 */
export function DishuPad({ chars, onDone }: { chars: string; onDone: () => void }) {
  const lib = useLibrary();
  const list = [...chars].filter((c) => lib.strokes[c]);
  const [i, setI] = useState(0);
  const [done, setDone] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [flash, setFlash] = useState<'ok' | 'miss' | null>(null);
  const [drying, setDrying] = useState(false);
  const finish = useRef(onDone);
  finish.current = onDone;
  const char = list[i];
  const data = char ? lib.strokes[char] : undefined;

  // nothing to write on this device (no stroke data): the old man is pleased anyway
  useEffect(() => {
    if (!list.length) finish.current();
  }, [list.length]);

  const onStroke = (pts: Pt[]) => {
    if (!data?.m || drying) return;
    const m = matchStroke(pts, medianPoints(data.m[done]));
    if (!m.ok) {
      setWrong((w) => w + 1);
      setFlash('miss');
      window.setTimeout(() => setFlash(null), 300);
      return;
    }
    const next = done + 1;
    setDone(next);
    setWrong(0);
    setFlash('ok');
    window.setTimeout(() => setFlash(null), 150);
    if (next < data.s.length) return;
    // the water dries: the character fades, then the next
    setDrying(true);
    window.setTimeout(() => {
      setDrying(false);
      setDone(0);
      if (i + 1 < list.length) setI(i + 1);
      else finish.current();
    }, 1800);
  };

  if (!char) return null;
  return (
    <div className="w-dishu" data-drying={drying ? '' : undefined}>
      <StrokeCanvas char={char} strokes={lib.strokes} size={220} done={done} ghost hint={wrong >= 2} flash={flash} disabled={drying} onStroke={onStroke} />
      <span className="tiny muted">
        {i + 1} / {list.length} — trace it with your finger; after two slips the next stroke shows.
      </span>
    </div>
  );
}
