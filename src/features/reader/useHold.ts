import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

/** How long a finger rests on a sentence before it counts as held rather than tapped. */
const HOLD_MS = 450;
/** A finger that moves this far is scrolling, not holding. */
const SLOP = 10;

/**
 * A press held on a sentence, for its English: a tap on a word still opens
 * the word, and a finger that moves is scrolling. Once a hold has fired, the
 * tap that ends it is swallowed, so the word under the finger does not open
 * as well, and on iOS the callout does not come up.
 */
export function useHold(onHold: (i: number) => void) {
  const timer = useRef(0);
  const fired = useRef(false);
  const from = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const stop = () => {
    window.clearTimeout(timer.current);
    from.current = null;
  };
  return (i: number) => ({
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      from.current = { x: e.clientX, y: e.clientY };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        fired.current = true;
        from.current = null;
        onHold(i);
      }, HOLD_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      if (from.current && Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y) > SLOP) stop();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onClickCapture: (e: MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
    onContextMenu: (e: MouseEvent) => {
      if (fired.current || from.current) e.preventDefault();
    },
  });
}
