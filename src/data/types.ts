/** Shapes of the JSON produced by scripts/build_data.py. */

export interface Word {
  w: string;
  p: string;
  d: string;
  hsk: number | null;
}

export interface Etymology {
  type: 'pictographic' | 'ideographic' | 'pictophonetic';
  hint?: string;
  phonetic?: string;
  semantic?: string;
}

export interface CharacterEntry {
  /** the character itself */
  c: string;
  /** 1-based position in the teaching order */
  i: number;
  py: string[];
  def: string;
  rad: string | null;
  radNum: number | null;
  /** stroke count */
  sc: number | null;
  /** ideographic description sequence, e.g. "⿰女子" */
  ids: string | null;
  /** top-level components of the decomposition */
  parts: string[];
  /** every component, recursively */
  leaves: string[];
  ety: Etymology | null;
  trad: string | null;
  hsk: number;
  /** Jun Da frequency rank; lower is more common */
  freq: number;
  layer: number;
  words: Word[];
  sent: { zh: string; en: string; py?: string } | null;
  /** visually confusable characters */
  conf: string[];
}

/** hanzi-writer outlines: `s` = stroke paths, `m` = medians, `g` = component per stroke. */
export interface StrokeData {
  s: string[];
  m?: number[][][];
  g?: number[];
}

export type StrokeMap = Record<string, StrokeData>;

/** Pinyin and meaning for any component that can appear in a decomposition. */
export interface ComponentGloss {
  py: string;
  def: string;
}

/** A hand-curated topical set, e.g. every food character in the syllabus. */
export interface Theme {
  id: string;
  name: string;
  blurb: string;
  items: string[];
  /** highest HSK band any of its characters belongs to */
  maxHsk: number;
}

/**
 * A word on the HSK syllabus — the 2026 lists, from words.json.
 *
 * Unlike the few words each character entry carries, this is the whole list,
 * a word per entry, with the reading and sense a learner at its band means:
 * 东西 is dōng xi, "thing", and only mentions east and west in `alt`.
 */
export interface SyllabusWord {
  w: string;
  py: string;
  /** a short meaning, in the sense the syllabus means */
  d: string;
  /** 2026 band; 7 stands for 7–9 */
  hsk: number;
  /** the measure words it takes, commonest first */
  cl?: string[];
  /** its other readings, and what the word means read that way */
  alt?: Array<{ py: string; d: string }>;
  /** a couple of short sentences using it, for bands 1–4 */
  ex?: Array<{ zh: string; py: string; en: string }>;
}

export interface Library {
  characters: CharacterEntry[];
  themes: Theme[];
  components: Record<string, ComponentGloss>;
  strokes: StrokeMap;
  byChar: Map<string, CharacterEntry>;
  /** the syllabus words, band by band, commonest first within a band */
  words: SyllabusWord[];
  byWord: Map<string, SyllabusWord>;
}
