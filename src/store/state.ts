import type { Collection } from '../domain/collection';
import type { ItemId } from '../domain/ids';
import type { PrintedSheet, RecallBook } from '../domain/memory';
import type { PaletteId, StyleId } from '../domain/sheet';
import type { GeneratedText, TextPlan, TextSet } from '../domain/text';
import type { WordListPlan } from '../domain/wordlist';
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
  basisCount: number;
  /** what to call whoever wrote the passage, stamped on the text */
  modelName: string;
  /**
   * Pronunciation: draw the pitch staff and say what to change, or only mark
   * each syllable as understood or not
   */
  pitchChart: boolean;
  /**
   * How slowly the Guided button under a turn reads it back, as a fraction of
   * the speed it was said at. The time is stretched and the pitch left alone,
   * so the tones are the tones — see `playSlowly` in voiceOut.
   */
  guidedPace: number;
  /**
   * Seconds of quiet that end a recording on their own, or 0 to stop it by
   * hand. Somebody who has finished speaking should not have to say so.
   */
  silenceStop: number;
  /**
   * The conversation partners kept on the Speaking page, by voice id, in the
   * order they were kept. Empty until somebody has chosen: then every
   * partner is offered.
   */
  talkVoices: string[];
  /**
   * How a passage is laid out: the Chinese as paragraphs with the translation
   * as a block beneath it, or sentence by sentence with each translation
   * under its own line.
   */
  readerLayout: 'paragraph' | 'sentences';
  /** colour the characters and words a passage taught */
  markNew: boolean;
  /** underline words from above the target band */
  markAbove: boolean;
  /** the band a reader and a new session are pitched at, or 0 to work it out from what is learned */
  targetHsk: number;
  /** show a passage in traditional characters where it has them */
  readerTraditional: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  hskBand: 1,
  footerNote: '',
  readerPalette: 'cinnabar',
  readerStyle: 'classic',
  readerPractice: true,
  practicePerPage: 3,
  basisCount: 150,
  modelName: 'Claude Opus',
  pitchChart: true,
  guidedPace: 0.65,
  silenceStop: 3,
  talkVoices: [],
  readerLayout: 'paragraph',
  markNew: true,
  markAbove: true,
  targetHsk: 0,
  readerTraditional: false,
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
  /** a word list being written with Claude; absent in documents from before it existed */
  listPlan?: WordListPlan | null;
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
  /** the word list being written, kept across reloads */
  listPlan: WordListPlan | null;
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
  listPlan: null,
  radicals: emptyRadicals(),
  settings: { ...DEFAULT_SETTINGS },
});
