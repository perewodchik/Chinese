import { useEffect, useRef } from 'react';

/**
 * A game controller — a Nintendo Switch Pro controller or Joy-Con, or any
 * other — through the browser's Gamepad API, for going on and back while the
 * hands are on paper.
 *
 * Buttons are read by their place on the standard layout, and a Nintendo
 * controller's A is not in one place for every system: Nintendo puts A on the
 * right of the four, the standard layout (and iOS by default) puts its first
 * button at the bottom, where the Switch has B. So both of those go on, and
 * A is "next" whichever way the iPad reports it. The shoulder buttons and the
 * d-pad go on (R, right) and back (L, left).
 */
export type PadAction = 'next' | 'back';

/** Standard-layout button numbers for each action. */
const ACTIONS: Record<PadAction, readonly number[]> = {
  // 0 bottom (Switch: B), 1 right (Switch: A), 5 R, 15 d-pad right
  next: [0, 1, 5, 15],
  // 4 L, 14 d-pad left
  back: [4, 14],
};

/** The actions whose buttons went down between two readings of one controller. */
export function pressed(before: readonly boolean[], now: readonly boolean[]): PadAction[] {
  const down = (i: number) => Boolean(now[i]) && !before[i];
  return (Object.keys(ACTIONS) as PadAction[]).filter((a) => ACTIONS[a].some(down));
}

/**
 * Calls `on` once for each press, while `enabled`. The browser lists a
 * controller only after one of its buttons has been pressed with the page
 * open, so the first press wakes it and the next one counts. It is read every
 * frame while one is connected, and not at all otherwise.
 */
export function useGamepad(on: (action: PadAction) => void, enabled = true) {
  const handler = useRef(on);
  handler.current = on;
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('getGamepads' in navigator)) return;
    const last = new Map<number, boolean[]>();
    let frame = 0;
    const read = () => {
      frame = 0;
      let any = false;
      for (const pad of navigator.getGamepads()) {
        if (!pad) continue;
        any = true;
        const now = pad.buttons.map((b) => b.pressed);
        // A controller seen for the first time starts from what it holds now, so a held button does not fire.
        const before = last.get(pad.index) ?? now;
        last.set(pad.index, now);
        for (const action of pressed(before, now)) handler.current(action);
      }
      if (any) frame = requestAnimationFrame(read);
    };
    const start = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    start();
    window.addEventListener('gamepadconnected', start);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('gamepadconnected', start);
    };
  }, [enabled]);
}
