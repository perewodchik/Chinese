import { rgb, type RGB } from 'pdf-lib';
import type { PaletteId } from '../../domain/sheet';

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

type Triple = readonly [number, number, number];

interface Recipe {
  id: PaletteId;
  name: string;
  blurb: string;
  accent: Triple;
  /** how far the greys lean towards the accent's hue */
  tint: Triple;
  components: Triple[];
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

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

const MUTED: Triple[] = [
  [0.62, 0.28, 0.2],
  [0.2, 0.38, 0.43],
  [0.44, 0.36, 0.19],
  [0.36, 0.31, 0.46],
  [0.24, 0.4, 0.29],
];

const RECIPES: Recipe[] = [
  {
    id: 'cinnabar',
    name: 'Cinnabar',
    blurb: '朱砂 — warm paper and a brush-red accent. The house style.',
    accent: [0.69, 0.25, 0.16],
    tint: [0, -0.024, -0.044],
    components: MUTED,
  },
  {
    id: 'indigo',
    name: 'Indigo',
    blurb: '靛青 — cool greys, ink-blue accent. Calmest under a desk lamp.',
    accent: [0.16, 0.3, 0.55],
    tint: [-0.03, -0.014, 0.014],
    components: [
      [0.18, 0.32, 0.56],
      [0.5, 0.3, 0.24],
      [0.24, 0.42, 0.36],
      [0.4, 0.32, 0.5],
      [0.42, 0.38, 0.2],
    ],
  },
  {
    id: 'pine',
    name: 'Pine',
    blurb: '松绿 — green-grey, easy on the eyes for a long sitting.',
    accent: [0.11, 0.38, 0.3],
    tint: [-0.026, 0.002, -0.016],
    components: [
      [0.13, 0.4, 0.31],
      [0.5, 0.3, 0.2],
      [0.22, 0.34, 0.5],
      [0.44, 0.36, 0.19],
      [0.4, 0.28, 0.44],
    ],
  },
  {
    id: 'plum',
    name: 'Plum',
    blurb: '紫檀 — mulberry accent on faintly violet paper.',
    accent: [0.44, 0.22, 0.46],
    tint: [-0.008, -0.03, 0.008],
    components: [
      [0.46, 0.24, 0.48],
      [0.2, 0.4, 0.42],
      [0.55, 0.3, 0.24],
      [0.3, 0.34, 0.52],
      [0.4, 0.38, 0.2],
    ],
  },
  {
    id: 'graphite',
    name: 'Graphite',
    blurb: '墨 — no colour at all. What a mono laser printer actually prints.',
    accent: [0.2, 0.2, 0.21],
    tint: [0, 0, 0],
    // Values, not hues: on a mono printer four greys still tell four
    // components apart, where four colours all come out the same slate.
    components: [
      [0.16, 0.16, 0.17],
      [0.46, 0.46, 0.47],
      [0.3, 0.3, 0.31],
      [0.6, 0.6, 0.61],
      [0.38, 0.38, 0.39],
    ],
  },
];

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

export interface PaletteInfo {
  id: PaletteId;
  name: string;
  blurb: string;
  /** CSS colours for the picker chip: accent, then paper, then ink */
  swatch: [string, string, string];
}

const hex = (c: Triple) =>
  '#' +
  c
    .map((n) =>
      Math.round(clamp(n) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

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

export const PALETTES: PaletteInfo[] = RECIPES.map((r) => ({
  id: r.id,
  name: r.name,
  blurb: r.blurb,
  swatch: [
    hex(r.accent),
    hex([
      clamp(0.965 + r.tint[0] * 1.365),
      clamp(0.965 + r.tint[1] * 1.365),
      clamp(0.965 + r.tint[2] * 1.365),
    ]),
    hex([
      clamp(0.1 + r.tint[0] * 0.5),
      clamp(0.1 + r.tint[1] * 0.5),
      clamp(0.1 + r.tint[2] * 0.5),
    ]),
  ],
}));
