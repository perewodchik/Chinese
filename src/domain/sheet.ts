/**
 * What a worksheet looks like.
 *
 * Everything here is a decision the reader of the sheet can see. The numbers
 * that turn these decisions into points on a page live in `pdf/layout`; this
 * module only knows what the choices are and which of them can coexist.
 */

export type GridStyle = 'mizi' | 'tian' | 'blank';

/** Practice square size, within the range paper exercise books use. */
export type SquareSize = 'large' | 'medium' | 'small';

export type PaletteId = 'cinnabar' | 'indigo' | 'pine' | 'plum' | 'graphite';
export type StyleId = 'classic' | 'workbook' | 'quiet' | 'card';

export interface SheetOptions {
  /** characters per A4 page, 1 to 4 */
  perPage: number;
  gridStyle: GridStyle;
  squareSize: SquareSize;
  /** rows of practice boxes under each item */
  practiceRows: number;
  /** boxes at the start of row 1 pre-filled at full trace weight */
  traceCount: number;
  /** boxes after those pre-filled at a lighter weight */
  fadeCount: number;

  palette: PaletteId;
  style: StyleId;
}

/**
 * There is deliberately no list of content switches here.
 *
 * What a sheet says is decided by how many items share the page — see the
 * profiles below — and by what the character actually has. Eight booleans on
 * top of that produced sheets nobody could describe ("HSK 1, but with the
 * sentence off and look-alikes on") and a panel of switches that were mostly
 * disabled at any given size. One control, and it is the one you were already
 * choosing.
 */

export const DEFAULT_CHAR_SHEET: SheetOptions = {
  perPage: 2,
  gridStyle: 'mizi',
  squareSize: 'medium',
  practiceRows: 3,
  traceCount: 3,
  fadeCount: 2,
  palette: 'cinnabar',
  style: 'classic',
};

export const defaultSheet = (): SheetOptions => ({ ...DEFAULT_CHAR_SHEET });

// ------------------------------------------------------------------- bands

/** The sections of a character block, in the order they are read. */
export type CharBand =
  | 'strokeOrder'
  | 'parts'
  | 'origin'
  | 'words'
  | 'sentence'
  | 'confusables';

export const BAND_NAME: Record<CharBand, string> = {
  strokeOrder: 'Stroke order',
  parts: 'Built from',
  origin: 'Where it comes from',
  words: 'Common words',
  sentence: 'Example sentence',
  confusables: "Don't confuse with",
};

// ---------------------------------------------------------------- profiles

/**
 * How much of a page one item gets, and therefore how much it can say.
 *
 * This is the single knob that used to be three (per page, density, and a
 * planner that silently threw sections away when they would not fit). Picking
 * two, three or four characters a page now picks a designed layout: the same
 * page, with the sections that cannot be read comfortably at that size taken
 * out on purpose rather than dropped at the bottom of the block.
 */
export type ProfileId = 'solo' | 'full' | 'mid' | 'tight';

export interface SheetProfile {
  id: ProfileId;
  /** what the picker calls it */
  label: string;
  /** one line under the label, saying what you give up */
  blurb: string;
  /** sections this profile has room for */
  bands: CharBand[];
  /** most words listed, however many the character has */
  maxWords: number;
  /** most components listed under "built from" */
  maxParts: number;
  /** components on one line instead of one per row */
  inlineParts: boolean;
}

const CHAR_PROFILES: Record<ProfileId, SheetProfile> = {
  solo: {
    id: 'solo',
    label: 'One per page',
    blurb: 'Everything, and half the page to write on.',
    bands: ['strokeOrder', 'parts', 'origin', 'words', 'sentence', 'confusables'],
    maxWords: 3,
    maxParts: 4,
    inlineParts: false,
  },
  full: {
    id: 'full',
    label: 'Two per page',
    blurb: 'The full sheet: origin, words, a sentence and look-alikes.',
    bands: ['strokeOrder', 'parts', 'origin', 'words', 'sentence', 'confusables'],
    maxWords: 3,
    maxParts: 4,
    inlineParts: false,
  },
  mid: {
    id: 'mid',
    label: 'Three per page',
    blurb: 'Drops the example sentence and the origin note.',
    bands: ['strokeOrder', 'parts', 'words', 'confusables'],
    maxWords: 2,
    maxParts: 3,
    inlineParts: false,
  },
  tight: {
    id: 'tight',
    label: 'Four per page',
    blurb: 'Stroke order, parts on one line, two words. Nothing else.',
    bands: ['strokeOrder', 'parts', 'words'],
    maxWords: 2,
    maxParts: 3,
    inlineParts: true,
  },
};

export function profileIdFor(perPage: number): ProfileId {
  if (perPage <= 1) return 'solo';
  if (perPage === 2) return 'full';
  if (perPage === 3) return 'mid';
  return 'tight';
}

export const profileFor = (perPage: number): SheetProfile => CHAR_PROFILES[profileIdFor(perPage)];

/** The per-page counts the editor offers, in order. */
export const PER_PAGE_CHOICES = [2, 3, 4];

/** Sections a roomier size would give you back. */
export function bandsLostAt(perPage: number): CharBand[] {
  const here = new Set(profileFor(perPage).bands);
  return profileFor(2).bands.filter((b) => !here.has(b));
}
