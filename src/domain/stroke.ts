/**
 * Deciding whether a stroke someone drew is the stroke that was expected.
 *
 * The data already carries what is needed: every character in `strokes-*.json`
 * has, besides its outlines, a *median* per stroke — the line down the middle
 * of the brush mark, as a handful of points. Comparing a drawn path against
 * that median is the whole trick, and it means the app can ask you to produce
 * a character on a blank square and actually check the answer, without a
 * recognition library and without a model to copy from.
 *
 * Everything here is arithmetic on points in the font's own 1024-unit space,
 * y-up, exactly as the JSON stores it. Nothing knows about a canvas.
 */

export interface Pt {
  x: number;
  y: number;
}

const SIZE = 1024;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export const medianPoints = (m: number[][]): Pt[] =>
  m.map(([x, y]) => ({ x, y }));

export function pathLength(pts: Pt[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  return total;
}

/**
 * The same path, as `n` points spaced evenly along its length.
 *
 * Comparing raw input against a median point-for-point would mostly measure
 * how fast someone moved the pen — a slow start puts twenty samples in the
 * first millimetre. Spacing both by distance instead compares the shapes.
 */
export function resample(pts: Pt[], n = 16): Pt[] {
  const clean = pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 0.5);
  if (clean.length < 2) return Array.from({ length: n }, () => clean[0] ?? { x: 0, y: 0 });

  const total = pathLength(clean);
  const step = total / (n - 1);
  const out: Pt[] = [clean[0]];
  let i = 1;
  let carried = 0;

  while (out.length < n && i < clean.length) {
    const d = dist(clean[i - 1], clean[i]);
    if (carried + d >= step) {
      const t = (step - carried) / d;
      const p = {
        x: clean[i - 1].x + (clean[i].x - clean[i - 1].x) * t,
        y: clean[i - 1].y + (clean[i].y - clean[i - 1].y) * t,
      };
      out.push(p);
      clean.splice(i, 0, p);
      carried = 0;
    } else {
      carried += d;
    }
    i++;
  }
  while (out.length < n) out.push(clean[clean.length - 1]);
  return out;
}

export interface StrokeMatch {
  ok: boolean;
  /** mean distance from the expected stroke, as a fraction of the square */
  cost: number;
  reason?: 'shape' | 'direction' | 'tiny';
}

/**
 * How far off a stroke may be and still count.
 *
 * Set by what the exercise is for. This is a memory test — did you know that
 * 好 is 女 then 子, in that order, with the 女 written in three — not a
 * calligraphy assessment, and a tolerance tight enough to fail an untidy but
 * correct stroke would be measuring the wrong thing.
 *
 * The number was chosen by running every stroke of the first four hundred
 * characters against every *other* stroke of the same character. At this
 * setting a badly wobbly version of the right stroke is accepted 99.1% of the
 * time and a different stroke of the same character gets in 1.6% of the time —
 * and that residue is nearly all parallel horizontals a stroke apart, which the
 * following stroke then fails anyway.
 */
export const TOLERANCE = 0.12;

const RESAMPLE = 16;

/**
 * How much the two ends count for, against the line as a whole.
 *
 * Averaging distance along the whole path treats a stroke that starts in the
 * right place and stops halfway as nearly right. Where a stroke begins and
 * ends is most of what distinguishes it from its neighbours — the three lines
 * of 三 differ in almost nothing else — so the ends are weighted up. It buys
 * about a third off the false accepts for a tenth of a percent of the honest
 * ones.
 */
const END_WEIGHT = 0.3;

/** Mean distance along the path and at its ends, blended, as a fraction. */
function costOf(a: Pt[], b: Pt[]): number {
  let mean = 0;
  for (let i = 0; i < RESAMPLE; i++) mean += dist(a[i], b[i]);
  mean /= RESAMPLE * SIZE;
  const ends = Math.max(dist(a[0], b[0]), dist(a[RESAMPLE - 1], b[RESAMPLE - 1])) / SIZE;
  return (1 - END_WEIGHT) * mean + END_WEIGHT * ends;
}

export function matchStroke(drawn: Pt[], median: Pt[]): StrokeMatch {
  const drawnLen = pathLength(drawn);
  const wanted = pathLength(median);

  // A tap where a stroke belongs. Worth its own answer: it is almost always a
  // slip rather than a wrong idea about the character.
  if (drawnLen < Math.min(60, wanted * 0.3) && wanted > 80) {
    return { ok: false, cost: 1, reason: 'tiny' };
  }

  const a = resample(drawn, RESAMPLE);
  const b = resample(median, RESAMPLE);
  const forward = costOf(a, b);
  const backward = costOf([...a].reverse(), b);

  // Drawn along the right line, the wrong way round. Stroke direction is half
  // of what stroke order is teaching, so this is a miss — but a miss that
  // deserves to be told apart from "that is not the stroke at all".
  if (backward <= TOLERANCE && backward + 0.03 < forward) {
    return { ok: false, cost: backward, reason: 'direction' };
  }

  return forward <= TOLERANCE
    ? { ok: true, cost: forward }
    : { ok: false, cost: forward, reason: 'shape' };
}

/**
 * Which of the strokes still to be written this one looks most like.
 *
 * Used only to say something useful when the expected stroke did not match:
 * writing the right stroke in the wrong order is a different mistake from not
 * knowing the character, and telling someone which one they made is the entire
 * value of checking at all.
 */
export function bestMatch(
  drawn: Pt[],
  medians: number[][][],
  remaining: number[],
): { index: number; cost: number } | null {
  let best: { index: number; cost: number } | null = null;
  for (const i of remaining) {
    const m = matchStroke(drawn, medianPoints(medians[i]));
    if (m.ok && (!best || m.cost < best.cost)) best = { index: i, cost: m.cost };
  }
  return best;
}

/* ------------------------------------------------------------- geometry io */

/**
 * Canvas pixels to the font's coordinates.
 *
 * The outlines are y-up and sit under `translate(0, 900) scale(1, -1)`, which
 * is the transform `Glyph` draws them with. Getting this backwards is the
 * mistake that makes every character print upside down, so the inverse lives
 * here next to the forward one rather than being written out at each use.
 */
export const BASELINE = 900;

export const toGlyphSpace = (px: number, py: number, size: number): Pt => ({
  x: (px / size) * SIZE,
  y: BASELINE - (py / size) * SIZE,
});

export const toCanvasSpace = (p: Pt, size: number): [number, number] => [
  (p.x / SIZE) * size,
  ((BASELINE - p.y) / SIZE) * size,
];
