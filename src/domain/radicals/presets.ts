import type { RadicalLibrary } from '../../data/radicals';

/**
 * Starting points for a radical set. A preset is a query over the radical
 * data, not a stored thing: taking one copies the radicals it names into a set
 * you then own.
 */
export interface RadicalPreset {
  id: string;
  name: string;
  blurb: string;
  /** Kangxi numbers, in the order they should print */
  items: (lib: RadicalLibrary) => number[];
}

const top = (count: number) => (lib: RadicalLibrary) =>
  lib.radicals.slice(0, count || undefined).map((r) => r.n);

/**
 * Radicals that differ by a dot or a stroke, grouped so each group prints on
 * facing blocks: 氵 beside 冫, 礻 beside 衤, both 阝 beside 卩.
 */
const LOOKALIKES: number[][] = [
  [85, 15, 90],
  [113, 145],
  [9, 60, 94],
  [40, 14, 116],
  [27, 53, 104],
  [44, 63],
  [72, 73, 109],
  [106, 132],
  [32, 33],
  [75, 115],
  [154, 147],
  [18, 19],
  [162, 54],
  [66, 34],
  [170, 163, 26],
  [37, 11, 12],
  [108, 143],
  [56, 62],
  [74, 130],
  [140, 118],
];

export const RADICAL_PRESETS: RadicalPreset[] = [
  {
    id: 'radicals-20',
    name: 'The first 20',
    blurb: 'The twenty that turn up most often. Start here.',
    items: top(20),
  },
  {
    id: 'radicals-50',
    name: 'Top 50 radicals',
    blurb: 'The ones that unlock the most characters.',
    items: top(50),
  },
  {
    id: 'radicals-100',
    name: 'Top 100 radicals',
    blurb: 'Nearly everything you will meet in print.',
    items: top(100),
  },
  {
    id: 'radicals-forms',
    name: 'Written more than one way',
    blurb: '忄 and 心, 氵 and 水, 土 and the 土 of 地: every radical that changes shape.',
    items: (lib) => lib.radicals.filter((r) => r.forms.length > 1).map((r) => r.n),
  },
  {
    id: 'radicals-lookalikes',
    name: 'Easily confused',
    blurb: 'Radicals a dot or a stroke apart, printed side by side.',
    items: (lib) => LOOKALIKES.flat().filter((n) => lib.byNumber.has(n)),
  },
  {
    id: 'radicals-all',
    name: 'All 214 radicals',
    blurb: 'The complete Kangxi set, rare ones included.',
    items: top(0),
  },
];

/** How many to suggest taking from a preset of this size. */
export function suggestedRadicalCount(count: number): number {
  if (count <= 60) return count;
  return 50;
}
