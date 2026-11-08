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

/** A stick's lean below this is the stick at rest: worn sticks never sit at exactly 0. */
const DEAD = 0.18;

/**
 * How fast a stick scrolls, in pixels a second, from its lean (-1 to 1): none
 * inside the dead zone, then growing with the square of the lean past it, so a
 * small push creeps and a full one runs.
 */
export function stickSpeed(lean: number, fastest = 1400): number {
  const past = Math.max(0, Math.abs(lean) - DEAD) / (1 - DEAD);
  return past ? Math.sign(lean) * past * past * fastest : 0;
}

/** The two sticks' sideways lean, left and right: axes 0 and 2 on the standard layout. */
export interface Sticks {
  left: number;
  right: number;
}

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
export function useGamepad(on: (action: PadAction) => void, onSticks?: (sticks: Sticks, ms: number) => void, enabled = true) {
  const handler = useRef(on);
  handler.current = on;
  const sticks = useRef(onSticks);
  sticks.current = onSticks;
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('getGamepads' in navigator)) return;
    const last = new Map<number, boolean[]>();
    let frame = 0;
    let then = 0;
    const read = (time: number) => {
      frame = 0;
      const ms = then ? Math.min(100, time - then) : 0;
      then = time;
      let any = false;
      for (const pad of navigator.getGamepads()) {
        if (!pad) continue;
        any = true;
        const now = pad.buttons.map((b) => b.pressed);
        // A controller seen for the first time starts from what it holds now, so a held button does not fire.
        const before = last.get(pad.index) ?? now;
        last.set(pad.index, now);
        for (const action of pressed(before, now)) handler.current(action);
        const [lx = 0, , rx = 0] = pad.axes;
        if (ms && sticks.current && (Math.abs(lx) > DEAD || Math.abs(rx) > DEAD)) sticks.current({ left: lx, right: rx }, ms);
      }
      if (any) frame = requestAnimationFrame(read);
      else then = 0;
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
