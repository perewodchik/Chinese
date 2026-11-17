import type { PaletteId } from '../../domain/sheet';

/**
 * The print palettes as recipes and as picker chips — no PDF code here, so the
 * colour picker on a settings screen does not bring pdf-lib with it (R5).
 */

export type Triple = readonly [number, number, number];

export interface Recipe {
  id: PaletteId;
  name: string;
  blurb: string;
  accent: Triple;
  /** how far the greys lean towards the accent's hue */
  tint: Triple;
  components: Triple[];
}

export const clamp = (n: number) => Math.max(0, Math.min(1, n));

export const MUTED: Triple[] = [
  [0.62, 0.28, 0.2],
  [0.2, 0.38, 0.43],
  [0.44, 0.36, 0.19],
  [0.36, 0.31, 0.46],
  [0.24, 0.4, 0.29],
];

export const RECIPES: Recipe[] = [
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
