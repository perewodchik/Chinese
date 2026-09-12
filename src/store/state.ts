import type { Collection } from '../domain/collection';
import type { ItemId } from '../domain/ids';
import type { PrintedSheet, RecallBook } from '../domain/memory';
import type { PaletteId, StyleId } from '../domain/sheet';
import type { GeneratedText, TextPlan, TextSet } from '../domain/text';
import { emptyRadicals, type RadicalState } from './radicalState';

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  /** library filter: which HSK band to show, or 0 for all 3000 */
  hskBand: number;
  /** name to stamp in the page footer */
  footerNote: string;
  /** how a printed reading passage looks; worksheets carry their own */
  readerPalette: PaletteId;
  readerStyle: StyleId;
  /** print practice squares for a text's new characters behind the reading */
  readerPractice: boolean;
  /** how many of those characters share a practice page */
  practicePerPage: number;
  /** what a new writing session assumes you can read, and how much of it */
  basisSource: string;
  basisCount: number;
  /** what to call whoever wrote the passage, stamped on the text */
  modelName: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  hskBand: 1,
  footerNote: '',
  readerPalette: 'cinnabar',
  readerStyle: 'classic',
  readerPractice: true,
  practicePerPage: 3,
  basisSource: 'learned',
  basisCount: 150,
  modelName: 'Claude Opus',
};

/** The workspace as it is written down — to the server now, and to localStorage before accounts. */
export interface PersistedState {
  version: 6;
  collections: Collection[];
  /**
   * What the app knows about your memory, by item.
   *
   * `learned` is still written alongside it, but it is a derived list rather
   * than the record itself: a document written by a build that predates the
   * scheduler opens here with everything ticked treated as
   * believed-but-unverified.
   */
  recall: RecallBook;
  /** recall sheets printed, and whether they have been marked yet */
  sheets: PrintedSheet[];
  learned: ItemId[];
  texts: GeneratedText[];
  sets: TextSet[];
  plan: TextPlan | null;
  /** radical sets and the radicals marked known, which nothing above reads */
  radicals: RadicalState;
  settings: AppSettings;
}

export interface AppState {
  collections: Collection[];
  recall: RecallBook;
  sheets: PrintedSheet[];
  /** derived from `recall`; recomputed only when `recall` changes */
  learned: Set<ItemId>;
  texts: GeneratedText[];
  sets: TextSet[];
  /** the writing session in progress, kept across reloads */
  plan: TextPlan | null;
  radicals: RadicalState;
  settings: AppSettings;
}

export const emptyState = (): AppState => ({
  collections: [],
  recall: {},
  sheets: [],
  learned: new Set(),
  texts: [],
  sets: [],
  plan: null,
  radicals: emptyRadicals(),
  settings: { ...DEFAULT_SETTINGS },
});
