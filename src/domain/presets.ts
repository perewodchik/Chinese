import type { Library } from '../data/types';
import { charId, type ItemId } from './ids';

/**
 * Starting points for a new collection. A preset is a query over the library,
 * not a stored thing: adding one copies the items it names into a collection
 * you then own and can trim, extend or reorder.
 */

export type PresetGroup = 'hsk' | 'theme';

export interface Preset {
  id: string;
  group: PresetGroup;
  name: string;
  blurb: string;
  /** the characters it covers, in teaching order */
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
  const of = (lib: Library) => lib.characters.filter((c) => c.hsk === band);
  return {
    id: `hsk-${band}`,
    group: 'hsk',
    name: band === 7 ? 'HSK 7–9' : `HSK ${band}`,
    blurb: BAND_BLURB[band] ?? '',
    items: (lib) => of(lib).map((c) => charId(c.c)),
    sample: (lib) => of(lib).slice(0, 8).map((c) => c.c),
  };
}

export function allPresets(lib: Library): Preset[] {
  const themes: Preset[] = lib.themes.map((t) => ({
    id: `theme-${t.id}`,
    group: 'theme' as const,
    name: t.name,
    blurb: t.blurb,
    items: () => t.items.map(charId),
    sample: () => t.items.slice(0, 8),
  }));

  return [...[1, 2, 3, 4, 5, 6, 7].map(bandPreset), ...themes];
}

export const GROUP_LABEL: Record<PresetGroup, string> = {
  hsk: 'By HSK band',
  theme: 'By topic',
};

export const GROUP_BLURB: Record<PresetGroup, string> = {
  hsk: 'The official syllabus, in an order that never puts a character before its parts.',
  theme: 'A set about one thing — useful when you have a trip or a menu coming up.',
};

/**
 * How many items to suggest taking from a set of this size.
 *
 * A three-hundred-character band is a term's work, not a collection; forty is
 * a fortnight of sheets and still one card in the gallery. Small sets are
 * taken whole.
 */
export function suggestedSize(count: number): number {
  if (count <= 60) return count;
  if (count <= 120) return 60;
  return 40;
}
