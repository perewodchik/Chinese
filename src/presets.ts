import type { Library } from './data/types';
import { charId, radId, type ItemId, type ItemKind } from './store/types';

export type PresetGroup = 'hsk' | 'radicals' | 'theme';

export interface Preset {
  id: string;
  group: PresetGroup;
  name: string;
  blurb: string;
  kind: ItemKind;
  /** the characters or radicals it covers, in teaching order */
  items: (lib: Library) => ItemId[];
  /** a few glyphs to show on the card */
  sample: (lib: Library) => string[];
}

const BAND_BLURB: Record<number, string> = {
  1: 'The first 300. Everything else builds on these.',
  2: 'The next 300 — enough for simple conversation.',
  3: 'Rounds out the elementary syllabus at 900 characters.',
  4: 'Intermediate: longer texts and more abstract words.',
  5: 'Intermediate upper band.',
  6: 'The last of the six graded bands.',
  7: 'The combined 七–九级 table: 1200 advanced characters.',
};

function bandPreset(band: number): Preset {
  return {
    id: `hsk-${band}`,
    group: 'hsk',
    name: band === 7 ? 'HSK 7–9' : `HSK ${band}`,
    blurb: BAND_BLURB[band] ?? '',
    kind: 'char',
    items: (lib) =>
      lib.characters.filter((c) => c.hsk === band).map((c) => charId(c.c)),
    sample: (lib) =>
      lib.characters.filter((c) => c.hsk === band).slice(0, 8).map((c) => c.c),
  };
}

function radicalPreset(n: number, name: string, blurb: string): Preset {
  const pick = (lib: Library) =>
    [...lib.radicals].sort((a, b) => a.rank - b.rank).slice(0, n || undefined);
  return {
    id: `radicals-${n || 'all'}`,
    group: 'radicals',
    name,
    blurb,
    kind: 'radical',
    items: (lib) => pick(lib).map((r) => radId(r.n)),
    sample: (lib) => pick(lib).slice(0, 8).map((r) => r.r),
  };
}

export function allPresets(lib: Library): Preset[] {
  const themes: Preset[] = lib.themes.map((t) => ({
    id: `theme-${t.id}`,
    group: 'theme' as const,
    name: t.name,
    blurb: t.blurb,
    kind: 'char' as const,
    items: () => t.items.map(charId),
    sample: () => t.items.slice(0, 8),
  }));

  return [
    ...[1, 2, 3, 4, 5, 6, 7].map(bandPreset),
    radicalPreset(50, 'Top 50 radicals', 'The ones that unlock the most characters.'),
    radicalPreset(100, 'Top 100 radicals', 'Covers nearly everything you will meet in print.'),
    radicalPreset(0, 'All 214 radicals', 'The complete Kangxi set, rare ones included.'),
    ...themes,
  ];
}

export const GROUP_LABEL: Record<PresetGroup, string> = {
  hsk: 'By HSK band',
  radicals: 'Radicals',
  theme: 'By topic',
};

export const GROUP_BLURB: Record<PresetGroup, string> = {
  hsk: 'The official syllabus, in an order that never puts a character before its parts.',
  radicals: 'Learn the building blocks first and every character afterwards gets easier.',
  theme: 'A set about one thing — useful when you have a trip or a menu coming up.',
};
