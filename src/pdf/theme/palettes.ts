import { rgb, type RGB } from 'pdf-lib';
import type { PaletteId } from '../../domain/sheet';
import { clamp, RECIPES, type Recipe, type Triple } from './recipes';

export { PALETTES, type PaletteInfo } from './recipes';

/**
 * Print palettes.
 *
 * A palette is one accent and a grey ramp tinted towards it. That second half
 * is what makes these read as different papers rather than the same sheet with
 * the red swapped: the hairlines, the practice grid and the body copy all lean
 * the same way as the accent, by about a hundredth, which you never see as
 * colour and always see as temperature.
 *
 * The accent keeps its one job — pronunciation. Pinyin, and the newest stroke
 * in the stroke strip, are the only things allowed to carry it, so a glance
 * separates "how it sounds" from everything else without reading a word.
 *
 * Values are chosen to survive a cheap laser printer: nothing lighter than
 * about 12% grey for a line, nothing darker than 4% for a fill.
 */

export interface Colours {
  ink: RGB;
  /** body copy that is not the main statement */
  ink2: RGB;
  /** labels, captions, anything structural */
  ink3: RGB;
  accent: RGB;
  /** the accent at panel strength — a tint you can print text on */
  accentSoft: RGB;
  /** the accent at heading-band strength */
  accentBand: RGB;
  /** hairlines between sections */
  hair: RGB;
  /** the heavier rule under the page header */
  rule: RGB;
  /** practice square outline, and the frame around the writing area */
  grid: RGB;
  gridInner: RGB;
  /** the traceable ghost in the first squares, and the fainter one after it */
  trace: RGB;
  fade: RGB;
  /**
   * Two tints, and they are deliberately a step apart. `band` backs a block's
   * heading, `panel` backs a prose note a few points below it; drawn at the
   * same value the note reads as a second heading rather than as something
   * inside the block.
   */
  band: RGB;
  panel: RGB;
  white: RGB;
  /** strokes tinted by which component they belong to */
  components: RGB[];
}




/**
 * A grey at lightness `l`, leaning towards the palette's hue.
 *
 * The lean grows with lightness — a near-black wants almost none of it or it
 * stops looking like ink, a near-white wants all of it or the page looks like
 * two different papers.
 */
const shade = (l: number, tint: Triple): RGB =>
  rgb(
    clamp(l + tint[0] * (0.4 + l)),
    clamp(l + tint[1] * (0.4 + l)),
    clamp(l + tint[2] * (0.4 + l)),
  );

/** The accent mixed into paper white. `k` is how much accent survives. */
const wash = (accent: Triple, k: number): RGB =>
  rgb(
    clamp(1 - (1 - accent[0]) * k),
    clamp(1 - (1 - accent[1]) * k),
    clamp(1 - (1 - accent[2]) * k),
  );



function build(r: Recipe): Colours {
  return {
    ink: shade(0.1, r.tint),
    ink2: shade(0.38, r.tint),
    ink3: shade(0.6, r.tint),
    accent: rgb(...r.accent),
    accentSoft: wash(r.accent, 0.1),
    accentBand: wash(r.accent, 0.16),
    hair: shade(0.878, r.tint),
    rule: shade(0.72, r.tint),
    grid: shade(0.79, r.tint),
    gridInner: shade(0.87, r.tint),
    trace: shade(0.72, r.tint),
    fade: shade(0.885, r.tint),
    band: shade(0.94, r.tint),
    panel: shade(0.965, r.tint),
    white: rgb(1, 1, 1),
    components: r.components.map((c) => rgb(...c)),
  };
}

const cache = new Map<PaletteId, Colours>();

export function palette(id: PaletteId): Colours {
  let c = cache.get(id);
  if (!c) {
    const r = RECIPES.find((x) => x.id === id) ?? RECIPES[0];
    c = build(r);
    cache.set(id, c);
  }
  return c;
}

