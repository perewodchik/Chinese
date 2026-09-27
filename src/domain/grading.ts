import type { Rating } from './memory';

/**
 * Turning what happened into a grade, so the learner is asked to judge as
 * little as possible.
 *
 * Four buttons ask a question nobody answers the same way twice: was that
 * "hard" or "good"? On an iPad, mid-sitting, the honest answer is usually
 * "I got it" or "I didn't", and the difference between hard, good and easy
 * is better read off the clock than off a moment's self-assessment. So a
 * self-graded card asks only Forgot / Got it, and the time spent before the
 * answer was revealed decides the rest. A card the app can check itself —
 * a pick, tiles, something typed — asks nothing at all.
 *
 * Pure: the drills measure, this decides.
 */

/** How long "thinking before looking" may take and still count as knowing it outright. */
export const QUICK_MS = 2500;
/** Past this, the answer was dug out rather than known: a pass, but a hard one. */
export const SLOW_MS = 10_000;

/**
 * A self-graded answer. `first` is true for the first answer an item has
 * ever had for this skill: a first answer is never "easy", however quick —
 * the first success is the least reliable evidence there will ever be.
 */
export function selfRating(gotIt: boolean, thinkMs: number, first = false): Rating {
  if (!gotIt) return 'again';
  if (thinkMs > SLOW_MS) return 'hard';
  if (thinkMs <= QUICK_MS && !first) return 'easy';
  return 'good';
}

/** How much work an exercise asks for — and so how much a right answer proves. */
export type Tier = 'pick' | 'build' | 'type';

/** What a right answer at each tier is worth to the scheduler, 0 to 1. */
export const TIER_WEIGHT: Record<Tier, number> = { pick: 0.5, build: 0.7, type: 1 };

/**
 * A checked answer. Right first time is good (easy, if it was typed and
 * quick: producing it at speed is as strong as evidence gets); right after a
 * slip is hard; not right at all is again.
 */
export function checkedRating(opts: { ok: boolean; misses: number; ms: number; tier: Tier; first?: boolean }): Rating {
  if (!opts.ok) return 'again';
  if (opts.misses > 0) return 'hard';
  if (opts.tier === 'type' && !opts.first && opts.ms <= QUICK_MS * 2) return 'easy';
  return 'good';
}

/**
 * Where a missed card goes back into a sitting: a few cards on, so it is
 * asked again while the answer is fresh but not straight away, when it would
 * only be read off short-term memory. With fewer cards than that left, at
 * the end.
 */
export function requeueAt(at: number, length: number, gap = 3): number {
  return Math.min(length, at + 1 + gap);
}

/** How many times one card may come back in a sitting before it is left for another day. */
export const MAX_REPEATS = 3;
