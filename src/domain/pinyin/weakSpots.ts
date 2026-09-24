import type { Library } from '../../data/types';
import { idValue, isCharId } from '../ids';
import type { RecallBook } from '../memory';
import { TONE_NAME } from './contour';
import { SOUND_LESSONS } from './sounds';

/**
 * Where pronunciation is going wrong, worst first.
 *
 * Every exercise in the Speaking section keeps a tally of its recent tries —
 * each tone pair, each tone on its own, telling a sound lesson's pairs apart
 * by ear and saying its words. Review keeps its own evidence: characters whose
 * reading or tone keeps being missed. Separately each is a percentage on a
 * card somewhere; together they answer the question a learner with twenty
 * minutes actually has, which is *what should I practise*.
 *
 * Pure: the tallies are passed in, so this knows nothing about where they are
 * stored, and the answer is a place to go rather than an address — the
 * screens turn it into one.
 */

/** What a tally has to offer; the Speaking section's own type has the same fields. */
export interface TallyLike {
  tries: number;
  recent: number[];
  last?: number;
}

export type SpotTarget =
  | { kind: 'practice'; set: string }
  | { kind: 'sound'; lesson: string; step: 'hear' | 'say' }
  | { kind: 'drill'; drill: 'tone' }
  | { kind: 'shadow' };

export interface WeakSpot {
  /** stable across renders: "pair:3-3", "hear:jqx", "chars" */
  id: string;
  title: string;
  /** what is being measured, in a few words */
  detail: string;
  /** share right lately, 0 to 1; null for the review-based spot, which counts misses instead */
  score: number | null;
  tries: number;
  /** a few characters, for the review-based spot */
  chars?: string[];
  target: SpotTarget;
}

export interface WeakSpotReport {
  /** worst first; only what is actually going wrong */
  weak: WeakSpot[];
  /** exercises never tried, in the order worth trying them */
  untried: WeakSpot[];
  /** at least one exercise has enough tries to judge */
  judged: boolean;
}

/** Below this share of recent tries right, a spot counts as weak. */
export const WEAK_BELOW = 0.75;
/** Fewer recent tries than this and a score says nothing yet. */
const MIN_RECENT = 3;

const score = (t: TallyLike | undefined): number | null =>
  t && t.recent.length >= MIN_RECENT ? t.recent.reduce((a, b) => a + b, 0) / t.recent.length : null;

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
const MARK: Record<number, string> = { 1: 'ā', 2: 'á', 3: 'ǎ', 4: 'à', 5: 'a' };

/** Every exercise that keeps a tally, in the order a beginner is best served trying them. */
function exercises(): WeakSpot[] {
  const out: WeakSpot[] = [];
  for (const t of [1, 2, 3, 4]) {
    out.push({
      id: `tone:${t}`,
      title: `The ${TONE_NAME[t]} tone`,
      detail: `${MARK[t]} on its own`,
      score: null,
      tries: 0,
      target: { kind: 'practice', set: `tone-${t}` },
    });
  }
  // Pairs before sounds: tones in words are where a beginner is hardest to follow.
  for (const a of [1, 2, 3, 4]) {
    for (const b of [1, 2, 3, 4, 5]) {
      out.push({
        id: `pair:${a}-${b}`,
        title: cap(`${TONE_NAME[a]} + ${TONE_NAME[b]}`),
        detail: `${MARK[a]} ${MARK[b]} in two-syllable words`,
        score: null,
        tries: 0,
        target: { kind: 'practice', set: `pair-${a}-${b}` },
      });
    }
  }
  for (const l of SOUND_LESSONS) {
    out.push({
      id: `hear:${l.id}`,
      title: `${l.mark}: telling them apart`,
      detail: l.title,
      score: null,
      tries: 0,
      target: { kind: 'sound', lesson: l.id, step: 'hear' },
    });
    out.push({
      id: `say:${l.id}`,
      title: `${l.mark}: saying them`,
      detail: l.title,
      score: null,
      tries: 0,
      target: { kind: 'sound', lesson: l.id, step: 'say' },
    });
  }
  return out;
}

/** How many of a character's missed readings make it one worth practising. */
const MISSED_READINGS = 2;

export function weakSpots(
  tallies: Record<string, TallyLike>,
  book: RecallBook,
  lib: Library,
): WeakSpotReport {
  const weak: WeakSpot[] = [];
  const untried: WeakSpot[] = [];
  let judged = false;

  for (const spot of exercises()) {
    const t = tallies[spot.id];
    const s = score(t);
    if (!t?.tries) {
      untried.push(spot);
      continue;
    }
    if (s === null) continue;
    judged = true;
    if (s < WEAK_BELOW) weak.push({ ...spot, score: s, tries: t.tries });
  }

  // Worst first; between equals, the one tried more, since that score is surer.
  weak.sort((a, b) => a.score! - b.score! || b.tries - a.tries);

  // From Review: characters whose reading has been missed again and again.
  const missed = Object.keys(book)
    .filter((id) => isCharId(id) && lib.byChar.has(idValue(id)))
    .map((id) => ({ char: idValue(id), lapses: book[id].sound?.lapses ?? 0 }))
    .filter((x) => x.lapses >= MISSED_READINGS)
    .sort((a, b) => b.lapses - a.lapses);
  if (missed.length) {
    weak.push({
      id: 'chars',
      title: `Readings you keep missing`,
      detail: `${missed.length} character${missed.length === 1 ? '' : 's'} missed ${MISSED_READINGS} or more times in review`,
      score: null,
      tries: missed.reduce((n, x) => n + x.lapses, 0),
      chars: missed.slice(0, 8).map((x) => x.char),
      target: { kind: 'drill', drill: 'tone' },
    });
  }

  return { weak, untried, judged };
}
