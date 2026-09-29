/**
 * The palette (src/world/art/palette.ts — shared with the game, which draws
 * the hero's layers itself, W1) and the colour matching the importers use.
 */

import { PALETTE, type Rgba } from '../../../src/world/art/palette';

export { colourOf, PALETTE, PALETTE_SPEC, TRANSPARENT, type Rgba } from '../../../src/world/art/palette';

/** RGB → rough perceptual lightness/opponent space, for picking the nearest colour. */
function lab([r, g, b]: Rgba): [number, number, number] {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [f(r), f(g), f(b)];
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const t = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
}

/** the creator's extra skin tones (W1) stay out of the matching, so re-importing a pack gives the same letters as before */
const HERO_ONLY = new Set(['A', 'C', 'T', 'D', 'E']);

const OPAQUE = [...PALETTE.entries()].filter(([k, c]) => c[3] === 255 && !HERO_ONLY.has(k)).map(([k, c]) => ({ k, c, lab: lab(c) }));

/** The nearest opaque palette letter to a colour. */
export function nearest(c: Rgba): string {
  const q = lab(c);
  let best = OPAQUE[0]!;
  let d0 = Infinity;
  for (const p of OPAQUE) {
    const d = (p.lab[0] - q[0]) ** 2 + (p.lab[1] - q[1]) ** 2 + (p.lab[2] - q[2]) ** 2;
    if (d < d0) {
      d0 = d;
      best = p;
    }
  }
  return best.k;
}
