/**
 * Which tone a stretch of voice was, from the shape of its pitch.
 *
 * Linguists write Mandarin tones on Chao's five-point scale, 1 the bottom of
 * a speaker's voice and 5 the top: the first tone is 55, high and level; the
 * second 35, rising; the third 214, a dip — or, with anything after it, just
 * 21, low; the fourth 51, a fall through the whole range. That scale is the
 * whole trick here. Hertz mean nothing across speakers — a man's high is a
 * woman's low — so pitch is first put on the speaker's own scale, and then a
 * tone is a shape on five lines that can be compared with four others.
 *
 * Deliberately simple: nearest template, by shape and by height. It does not
 * need to transcribe anything, only to say which of four shapes a syllable is
 * closest to — and to be honest when two are nearly as close.
 */

/** A speaker's range, in Hz, from calibration or from what they have said. */
export interface VoiceRange {
  floorHz: number;
  ceilHz: number;
}

/** Semitones between two frequencies. */
export const semitones = (hz: number, ref: number) => 12 * Math.log2(hz / ref);

/** Hz to the speaker's Chao scale, 1–5 (a little outside is allowed). */
export function toChao(hz: number, range: VoiceRange): number {
  const span = Math.max(semitones(range.ceilHz, range.floorHz), 4);
  const chao = 1 + (4 * semitones(hz, range.floorHz)) / span;
  return Math.min(5.6, Math.max(0.4, chao));
}

/**
 * A voice range taken from the utterance itself, when there is no calibration.
 *
 * Fine for a word whose tones differ — the high and the low are both in it —
 * and useless for one level syllable, where the "range" is a semitone wide.
 * So the span is never allowed below eight semitones, centred on what was
 * heard: a single first tone then lands in the middle rather than at the top,
 * which is the honest answer when nothing says where the top is.
 */
export function rangeOf(hz: number[]): VoiceRange {
  const sorted = hz.filter((f) => f > 0).sort((a, b) => a - b);
  if (!sorted.length) return { floorHz: 100, ceilHz: 200 };
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
  let floor = q(0.05);
  let ceil = q(0.95);
  const min = 8;
  const span = semitones(ceil, floor);
  if (span < min) {
    const mid = Math.sqrt(floor * ceil);
    floor = mid / 2 ** (min / 24);
    ceil = mid * 2 ** (min / 24);
  }
  return { floorHz: floor, ceilHz: ceil };
}

/* -------------------------------------------------------------- templates */

export type ToneShape = 1 | 2 | 3 | 4;

const POINTS = 9;

/** Less movement than this, in Chao steps, and a syllable counts as level. */
const LEVEL = 0.6;

/**
 * The four shapes, sampled at nine points on the Chao scale.
 *
 * Two thirds: the full dip a textbook draws, and the low half that is what
 * is actually said before another syllable. Either one counts as a third.
 */
export const TEMPLATES: Array<{ tone: ToneShape; half?: boolean; points: number[]; atLeast?: number }> = [
  // High and level — but "high" is a floor, not a target. The top of the
  // scale comes from the calibration, where má and mà are said with more
  // swing than anybody speaks with, and in a word the first tone sits well
  // under it. Mandarin has one level tone, so a level syllable anywhere from
  // the middle up is heard as the first; only a low one can be a third.
  { tone: 1, points: [5, 5, 5, 5, 5, 5, 5, 5, 5], atLeast: 3 },
  { tone: 2, points: [3, 2.9, 3.1, 3.4, 3.8, 4.2, 4.5, 4.8, 5] },
  { tone: 3, points: [2.2, 1.8, 1.4, 1.1, 1, 1.2, 1.8, 2.6, 3.4] },
  { tone: 3, half: true, points: [2.2, 1.9, 1.6, 1.3, 1.1, 1, 1, 1, 1] },
  { tone: 4, points: [5, 4.8, 4.4, 3.9, 3.3, 2.6, 2, 1.5, 1] },
];

/** Where the reference line is drawn for an expected tone. */
export function templateFor(tone: number, halfThird = false): number[] | null {
  if (tone === 3) return TEMPLATES.find((t) => t.tone === 3 && !!t.half === halfThird)!.points;
  return TEMPLATES.find((t) => t.tone === tone)?.points ?? null;
}

/** Linear resampling to `n` points, ignoring gaps (NaN). */
export function resample(values: number[], n = POINTS): number[] {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return [];
  if (v.length === 1) return Array(n).fill(v[0]);
  return Array.from({ length: n }, (_, i) => {
    const x = (i * (v.length - 1)) / (n - 1);
    const lo = Math.floor(x);
    const hi = Math.min(v.length - 1, lo + 1);
    return v[lo]! + (v[hi]! - v[lo]!) * (x - lo);
  });
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * How far a contour is from a template.
 *
 * Shape counts twice as much as height. People start a word wherever their
 * voice happens to be, and a rising tone that begins a little high is still a
 * rising tone; a level tone that is level is the first tone even if it sits at
 * 3 rather than 5 (see `atLeast`). Height still counts, because the one thing
 * that tells a low half-third from a first tone is that it is low.
 */
function distance(c: number[], t: number[], atLeast?: number): number {
  const mc = mean(c);
  const mt = mean(t);
  const shape = Math.sqrt(mean(c.map((x, i) => (x - mc - (t[i]! - mt)) ** 2)));
  const height = atLeast === undefined ? Math.abs(mc - mt) : Math.max(0, atLeast - mc);
  return shape + 0.5 * height;
}

export interface ToneGuess {
  tone: ToneShape;
  /** 0–1: how clearly this shape beat the next best */
  confidence: number;
  /** every candidate tone with its best distance, nearest first */
  ranked: Array<{ tone: ToneShape; distance: number }>;
  /** the contour as judged, nine points on the Chao scale */
  points: number[];
}

/**
 * The tone a syllable's contour is closest to.
 *
 * The first and last tenth are cut before judging: the onset carries the
 * consonant's push and the tail trails off as the voice stops, and both bend
 * the pitch in ways a listener does not hear as tone.
 */
export function classify(chao: number[]): ToneGuess | null {
  const voiced = chao.filter((x) => Number.isFinite(x));
  if (voiced.length < 4) return null;
  const cut = Math.floor(voiced.length * 0.1);
  const points = resample(voiced.slice(cut, voiced.length - cut || undefined));
  const best = new Map<ToneShape, number>();
  for (const t of TEMPLATES) {
    // Only a contour that really is level gets the first tone's floor: one
    // that moves is judged on its height as before, or a second tone that
    // rises gently from the middle would pass for a first.
    const level = Math.max(...points) - Math.min(...points) < LEVEL;
    const d = distance(points, t.points, level ? t.atLeast : undefined);
    if (d < (best.get(t.tone) ?? Infinity)) best.set(t.tone, d);
  }
  const ranked = [...best.entries()]
    .map(([tone, d]) => ({ tone, distance: d }))
    .sort((a, b) => a.distance - b.distance);
  settleSecondOrThird(ranked, points);
  const [first, second] = ranked;
  const confidence = second ? Math.min(1, (second.distance - first!.distance) / 0.8) : 1;
  return { tone: first!.tone, confidence, ranked, points };
}

/**
 * Second or third, decided the way a listener decides it.
 *
 * A real second tone is rarely the clean ramp of the textbook: it starts
 * with a small dip, and by overall shape that dip-then-rise is close to a
 * third. Measured over 1,600 native recordings, shape alone mistook one
 * second tone in four for a third. What separates them is where the dip is
 * and how deep: a third goes down to the bottom of the voice (its lowest
 * point is about 1 on the Chao scale) in the middle of the syllable; a
 * second's dip stays around 2½ and comes in the first third. So when the two
 * are the front-runners, that — not the overall distance — decides.
 */
function settleSecondOrThird(ranked: Array<{ tone: ToneShape; distance: number }>, points: number[]) {
  const top = new Set([ranked[0]?.tone, ranked[1]?.tone]);
  if (!top.has(2) || !top.has(3)) return;
  const low = Math.min(...points);
  const at = points.indexOf(low) / (points.length - 1);
  const third = low < 1.8 && at >= 0.35;
  if ((ranked[0]!.tone === 3) !== third) [ranked[0], ranked[1]] = [ranked[1]!, ranked[0]!];
}

/* ---------------------------------------------------------------- verdicts */

export type Verdict = 'right' | 'close' | 'wrong' | 'light' | 'unheard';

export interface Judged {
  verdict: Verdict;
  guess: ToneGuess | null;
  /** one sentence saying what to change, when something should change */
  tip?: string;
}

/**
 * Right, nearly, or wrong — against the tone that should have been said.
 *
 * "Nearly" is for when the expected tone came a close second: the shape was
 * ambiguous, and telling somebody they were wrong on a coin toss teaches them
 * to distrust the checker rather than their voice. Neutral tones are not
 * judged at all; their pitch is decided by the syllable before, and the only
 * thing to get right is that they are short and light.
 */
export function judge(chao: number[], expected: number): Judged {
  if (expected === 5) return { verdict: 'light', guess: classify(chao) };
  const guess = classify(chao);
  if (!guess) return { verdict: 'unheard', guess: null };
  if (guess.tone === expected) return { verdict: 'right', guess };
  const own = guess.ranked.find((r) => r.tone === expected);
  const gap = own ? own.distance - guess.ranked[0]!.distance : Infinity;
  const verdict = gap < 0.25 ? 'close' : 'wrong';
  return { verdict, guess, tip: tipFor(expected, guess.tone) };
}

/**
 * What to do differently, in terms a speaker of English can act on.
 *
 * English has all four shapes — it just uses them for attitude rather than
 * for meaning — so each tip points at a moment where an English speaker
 * already makes the right one.
 */
export function tipFor(expected: number, heard: number): string {
  const TIPS: Record<string, string> = {
    '1-2': 'It rose. Hold one note, high and flat — like singing "laaa" at the top of your voice.',
    '1-3': 'It went low. Start higher and stay there — a doctor\'s "aaah", not a sigh.',
    '1-4': 'It fell. Keep it level to the end, as if holding a note on a tuning fork.',
    '2-1': 'It stayed flat. Start in the middle and climb — the "What?" of not having heard.',
    '2-3': 'It dipped first. Go straight up from the middle, no dip — "Huh?", not "Hmm…"',
    '2-4': 'It fell. The second tone only goes up: think of asking "Really?"',
    '3-1': 'It was too high. Drop to the bottom of your voice — low and a little creaky, "uh-huh" said tired.',
    '3-2': 'It rose too early. Go down and stay low first — most thirds never come back up.',
    '3-4': 'It started high. A third starts low and goes lower; do not begin at the top.',
    '4-1': 'It did not fall. Start high and drop hard — a firm "No!" or "Stop!"',
    '4-2': 'It went up. A fourth only goes down, fast — "Yes!" when you are sure.',
    '4-3': 'It started too low. Begin at the top of your voice and fall the whole way.',
  };
  return TIPS[`${expected}-${heard}`] ?? '';
}

export const TONE_NAME: Record<number, string> = {
  1: 'first',
  2: 'second',
  3: 'third',
  4: 'fourth',
  5: 'neutral',
};
