/**
 * What a worksheet looks like.
 *
 * Everything here is a decision the reader of the sheet can see. The numbers
 * that turn these decisions into points on a page live in `pdf/layout`; this
 * module only knows what the choices are.
 */

export type GridStyle = 'mizi' | 'tian' | 'blank';

/** Practice square size, within the range paper exercise books use. */
export type SquareSize = 'large' | 'medium' | 'small';

export type PaletteId = 'cinnabar' | 'indigo' | 'pine' | 'plum' | 'graphite';
export type StyleId = 'classic' | 'workbook' | 'quiet' | 'card';

/**
 * The ways a collection prints.
 *
 * There used to be eight controls here — how many to a page, square size,
 * guides, rows, how many to trace, how many faint, a design and a colour — and
 * their product is what made one page of "3 rows" come out with two rows under
 * one character and three under the next. A layout now fixes all of that at
 * once: every square is the same 15 mm, twelve to a row, and every block of a
 * layout has the same heading, the same notes zone and the same rows.
 *
 * Test is the odd one out: it prints only the learned items, as a reading and
 * a meaning over empty squares with the answers under a fold, and every print
 * of it waits in Review to be marked.
 */
export type LayoutId = 'study' | 'drill' | 'test';

/** What a collection stores about how it prints. */
export interface SheetChoice {
  layout: LayoutId;
  /** the collection's own colour, or null for the one in Settings */
  palette: PaletteId | null;
}

export const DEFAULT_SHEET: SheetChoice = { layout: 'study', palette: null };

export const defaultSheet = (): SheetChoice => ({ ...DEFAULT_SHEET });

export interface LayoutInfo {
  id: LayoutId;
  name: string;
  blurb: string;
  perPage: number;
  /** rows of practice squares under every item */
  rows: number;
}

export const LAYOUTS: Record<LayoutId, LayoutInfo> = {
  study: {
    id: 'study',
    name: 'Study',
    blurb: '2 a page. Stroke order, parts, words and a sentence, then 3 rows.',
    perPage: 2,
    rows: 3,
  },
  drill: {
    id: 'drill',
    name: 'Drill',
    blurb: '4 a page. The heading and stroke order, then 2 rows.',
    perPage: 4,
    rows: 2,
  },
  test: {
    id: 'test',
    name: 'Test',
    blurb: '9 a page, learned ones only. Reading and meaning, empty squares, answers under a fold.',
    // what `recallLayout` fits with one row and the key on the page
    perPage: 9,
    rows: 1,
  },
};

export const LAYOUT_IDS: LayoutId[] = ['study', 'drill', 'test'];

export const perPageOf = (layout: LayoutId) => LAYOUTS[layout].perPage;

/** The layout a page of this many items is drawn in. */
export const layoutFor = (perPage: number): LayoutId => (perPage <= 2 ? 'study' : 'drill');

/**
 * Everything the PDF code needs to draw a sheet, spelled out.
 *
 * Not stored and not chosen: it is what a `SheetChoice` means on paper, plus
 * the fields radical sheets still read. The trace pattern is fixed — the first
 * go solid enough to trace, the next ones faint — because it was never a
 * decision anybody wanted to make twice.
 */
export interface SheetOptions {
  /** items per A4 page */
  perPage: number;
  gridStyle: GridStyle;
  squareSize: SquareSize;
  /** rows of practice boxes under each item */
  practiceRows: number;
  /** goes at the start of row 1 pre-filled at full trace weight */
  traceCount: number;
  /** goes after those pre-filled at a lighter weight */
  fadeCount: number;

  palette: PaletteId;
  style: StyleId;
}

export function printSheet(choice: SheetChoice | LayoutId, fallback: PaletteId): SheetOptions {
  const c = typeof choice === 'string' ? { layout: choice, palette: null } : choice;
  const L = LAYOUTS[c.layout] ?? LAYOUTS.study;
  return {
    perPage: L.perPage,
    gridStyle: 'mizi',
    squareSize: 'large',
    practiceRows: L.rows,
    traceCount: 1,
    fadeCount: 3,
    palette: c.palette ?? fallback,
    style: 'classic',
  };
}

// ------------------------------------------------------------------- bands

/** The sections of a Study block, in the order they are read. */
export type CharBand = 'strokeOrder' | 'parts' | 'words' | 'sentence';

export const BAND_NAME: Record<CharBand, string> = {
  strokeOrder: 'Stroke order',
  parts: 'Built from',
  words: 'Common words',
  sentence: 'Example sentence',
};
