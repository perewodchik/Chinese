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

export interface RadicalEntry {
  /** Kangxi radical number, 1-214 */
  n: number;
  /** the form most often written in modern simplified Chinese */
  r: string;
  /** the canonical Kangxi form */
  kangxi: string;
  variants: string[];
  py: string;
  mean: string;
  /** colloquial Chinese name, e.g. 三点水 */
  cn: string | null;
  cnPy: string | null;
  sc: number | null;
  /** characters using this radical, across the whole 10k set */
  count: number;
  /** ...of which are in the 3000 most frequent */
  useful: number;
  /** rank by `useful`, 1 = most used */
  rank: number;
  /** example characters, easiest first */
  ex: string[];
  note: string | null;
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
  /** Kangxi radical number, when this component is itself a radical */
  rad: number | null;
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

export interface Library {
  characters: CharacterEntry[];
  themes: Theme[];
  components: Record<string, ComponentGloss>;
  radicals: RadicalEntry[];
  strokes: StrokeMap;
  byChar: Map<string, CharacterEntry>;
  byRadical: Map<string, RadicalEntry>;
}
