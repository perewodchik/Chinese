import type { StrokeData, StrokeMap } from './types';

/**
 * The radical dataset: public/data/radicals.json, built by
 * scripts/build_radicals.py.
 *
 * Radicals are a different kind of thing from characters and are kept apart
 * from them all the way down. Nothing on the character side reads this file,
 * it is fetched the first time the radicals page is opened, and a radical is
 * identified by its Kangxi number — the 阝 on the left of 院 and the 阝 on the
 * right of 部 are two radicals that happen to share a shape.
 */

/** Where a form sits in the characters written with it. */
export type FormPos =
  | 'alone'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'topLeft'
  | 'bottomLeft'
  | 'topRight'
  | 'around';

export interface RadicalExample {
  c: string;
  py: string;
  /** a short gloss */
  d: string;
  /** HSK band (from the 2026 word lists), or 0 outside the syllabus */
  hsk: number;
}

/**
 * One way of writing a radical: 忄, 心 and ⺗ are three forms of radical 61.
 *
 * `k` keys the outline in `RadicalLibrary.strokes`. For every form except a
 * radical written on its own, that outline was cut out of a real character —
 * `host` — so it keeps the size and place it has there: 忄 narrow on the left,
 * 心 wide and low. Drawn into a practice square as it is, it asks for exactly
 * the proportions a hand has to learn.
 */
export interface RadicalForm {
  g: string;
  k: string;
  pos: FormPos;
  /** colloquial name, 竖心旁 */
  name: string | null;
  namePy: string | null;
  sc: number;
  /** how it differs from the radical written on its own */
  tip: string | null;
  host: string | null;
  /** syllabus characters written with this form */
  uses: number;
  ex: RadicalExample[];
}

export interface RadicalEntry {
  /** Kangxi number, 1–214, and the identity */
  n: number;
  /** the form met most often, which is the one a card shows */
  r: string;
  kangxi: string;
  /** the character the radical is named after, and its reading: 心 xīn for 忄 */
  word: string;
  py: string;
  /** what it means as a part of other characters */
  mean: string;
  /** what the characters built on it tend to be about */
  about: string | null;
  /** what it gets mistaken for */
  note: string | null;
  sc: number;
  /** characters filed under it, out of about ten thousand */
  count: number;
  /** ...of which are in the HSK syllabus */
  syllabus: number;
  /** by `syllabus`; 1 is the most used */
  rank: number;
  forms: RadicalForm[];
}

export interface RadicalLibrary {
  /** in rank order */
  radicals: RadicalEntry[];
  byNumber: Map<number, RadicalEntry>;
  /** the outline of every form, by `RadicalForm.k` */
  strokes: StrokeMap;
}

let cached: Promise<RadicalLibrary> | null = null;

export function loadRadicals(): Promise<RadicalLibrary> {
  if (cached) return cached;
  const loading = fetch('/data/radicals.json')
    .then((r) => {
      if (!r.ok) throw new Error(`/data/radicals.json failed to load (${r.status})`);
      return r.json() as Promise<{
        items: RadicalEntry[];
        strokes: Record<string, StrokeData>;
      }>;
    })
    .then((d) => {
      const radicals = [...d.items].sort((a, b) => a.rank - b.rank);
      return {
        radicals,
        byNumber: new Map(radicals.map((r) => [r.n, r])),
        strokes: d.strokes,
      };
    });
  cached = loading;
  // A failed fetch is not cached: opening the page again should try again.
  loading.catch(() => {
    if (cached === loading) cached = null;
  });
  return loading;
}
