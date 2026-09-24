import type { Library } from '../data/types';
import { charId, wordId, type ItemId } from './ids';

/**
 * Starting points for a new collection. A preset is a query over the library,
 * not a stored thing: adding one copies the items it names into a collection
 * you then own and can trim, extend or reorder.
 */

export type PresetGroup = 'hsk' | 'words' | 'theme';

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

/**
 * A character's band is the first band whose words use it, on the 2026 word
 * lists — so these are the characters you need to read each band's words.
 */
const BAND_BLURB: Record<number, string> = {
  1: 'The 248 characters the HSK 1 words are written in. Everything else builds on these.',
  2: 'The 123 more that HSK 2 words need — enough for simple conversation.',
  3: 'Rounds out the elementary syllabus at about 650 characters.',
  4: 'Intermediate: longer texts and more abstract words.',
  5: 'Intermediate upper band.',
  6: 'The last of the six graded bands.',
  7: 'Bands 7–9 as one: about 1100 advanced characters.',
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

const WORD_BLURB: Record<number, string> = {
  1: 'The 294 words of HSK 1: what the first texts, and the first conversations, are made of.',
  2: 'The 197 HSK 2 adds — 491 in all, enough to get through a day.',
  3: 'The next 487, where sentences start to join up.',
  4: 'Nearly a thousand more: the intermediate vocabulary.',
};

/**
 * A band's words, as a ready-made set. Its characters print like any
 * collection's; the words themselves come round in Review, a few new a day.
 */
function wordBandPreset(band: number): Preset {
  const of = (lib: Library) => lib.words.filter((w) => w.hsk === band);
  return {
    id: `wordset-hsk-${band}`,
    group: 'words',
    name: `HSK ${band} words`,
    blurb: WORD_BLURB[band] ?? '',
    items: (lib) => of(lib).map((w) => wordId(w.w)),
    sample: (lib) => of(lib).filter((w) => w.w.length > 1).slice(0, 6).map((w) => w.w),
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

  return [...[1, 2, 3, 4, 5, 6, 7].map(bandPreset), ...[1, 2, 3, 4].map(wordBandPreset), ...themes];
}

export const GROUP_LABEL: Record<PresetGroup, string> = {
  hsk: 'By HSK band',
  words: 'Words',
  theme: 'By topic',
};

export const GROUP_BLURB: Record<PresetGroup, string> = {
  hsk: 'The official syllabus, in an order that never puts a character before its parts.',
  words: 'The words of each band on the 2026 lists, commonest first. Their characters print as practice sheets; the words come round in Review, a few new ones a day.',
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
