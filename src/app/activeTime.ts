import { dispatch } from '../store/store';

/**
 * How long was spent working today, for the Stats page and the minutes goal.
 *
 * Time is counted between one sign of life — a tap, a key, a scroll — and the
 * next, while they come less than a minute apart. A tab left open over lunch
 * counts for nothing, a pause to think over a character counts in full, and
 * nothing has to be started or stopped. It is added to the day's log every
 * half-minute or so, and when the page is hidden.
 */

const IDLE_MS = 60_000;
const FLUSH_MS = 30_000;

let last = 0;
let pending = 0;
let started = false;

function touch() {
  const now = Date.now();
  const gap = now - last;
  if (last && gap > 0 && gap <= IDLE_MS) pending += gap;
  last = now;
}

function flush() {
  // Nothing is kept before an account is open, and signing in is not studying.
  if (pending < 1000 || /^\/(login|register)/.test(location.pathname)) return;
  const ms = Math.round(pending);
  pending = 0;
  dispatch({ type: 'activity/log', at: Date.now(), add: { ms } });
}

export function startActiveTime() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const opts = { capture: true, passive: true } as const;
  for (const e of ['pointerdown', 'keydown', 'wheel', 'scroll', 'input'] as const) window.addEventListener(e, touch, opts);
  window.setInterval(flush, FLUSH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush();
      last = 0;
    }
  });
}
