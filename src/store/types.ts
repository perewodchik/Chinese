export type ItemKind = 'char' | 'radical';

/** Stable id for a library item: `c好` for a character, `r38` for radical 38. */
export type ItemId = string;

export const charId = (c: string): ItemId => `c${c}`;
export const radId = (n: number): ItemId => `r${n}`;
export const idKind = (id: ItemId): ItemKind =>
  id.startsWith('r') ? 'radical' : 'char';

export type GridStyle = 'mizi' | 'tian' | 'blank';

/** How tightly a block is packed. Compact puts the bands side by side. */
export type Density = 'comfortable' | 'compact';

/** Practice square size, within the range paper exercise books use. */
export type SquareSize = 'large' | 'medium' | 'small';

export interface SheetOptions {
  /** items per A4 page */
  perPage: number;
  gridStyle: GridStyle;
  density: Density;
  squareSize: SquareSize;
  /** rows of practice boxes under each item */
  practiceRows: number;
  /** boxes at the start of row 1 pre-filled at full trace weight */
  traceCount: number;
  /** boxes after those pre-filled at a lighter weight */
  fadeCount: number;
  strokeOrder: boolean;
  memoryAids: boolean;
  componentColours: boolean;
  words: boolean;
  sentence: boolean;
  confusables: boolean;
  traditional: boolean;
  /** faint pinyin under each practice box, as a prompt */
  pinyinPrompt: boolean;
}

export const DEFAULT_CHAR_OPTIONS: SheetOptions = {
  perPage: 2,
  gridStyle: 'mizi',
  density: 'comfortable',
  squareSize: 'medium',
  practiceRows: 3,
  traceCount: 3,
  fadeCount: 2,
  strokeOrder: true,
  memoryAids: true,
  componentColours: true,
  words: true,
  sentence: true,
  confusables: true,
  traditional: true,
  pinyinPrompt: false,
};

export const DEFAULT_RADICAL_OPTIONS: SheetOptions = {
  perPage: 5,
  gridStyle: 'mizi',
  density: 'comfortable',
  squareSize: 'medium',
  practiceRows: 2,
  traceCount: 3,
  fadeCount: 2,
  strokeOrder: true,
  memoryAids: true,
  componentColours: false,
  words: false,
  sentence: false,
  confusables: true,
  traditional: false,
  pinyinPrompt: false,
};

export interface Template {
  id: string;
  name: string;
  kind: ItemKind;
  items: ItemId[];
  options: SheetOptions;
  createdAt: number;
  updatedAt: number;
  /** groups the parts of one ready-made set together in the gallery */
  collection?: string;
  note?: string;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  /** show only the N most-used radicals in the library, or 0 for all 214 */
  radicalLimit: number;
  /** library filter: which HSK band to show, or 0 for all 3000 */
  hskBand: number;
  /** name to stamp in the page footer */
  footerNote: string;
}

export interface PersistedState {
  version: 1;
  templates: Template[];
  learned: ItemId[];
  settings: AppSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  radicalLimit: 50,
  hskBand: 1,
  footerNote: '',
};
