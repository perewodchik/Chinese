import type { CharacterEntry, Library } from '../data/types';
import type { CollectionWord } from './collection';
import { idValue, isCharId, isWordId, type ItemId } from './ids';

/**
 * What a list of items puts on paper: one block per item.
 *
 * A word used to be taken apart into its characters, each printed once, where
 * it first came up — so 朋友 never reached the paper as 朋友, its reading
 * péngyou and its meaning were nowhere, and 男朋友 after it printed only 男.
 * It also meant a collection of twenty items could be forty blocks, so the page
 * count, the "1–2 of 20" in the header and the preview were all counting
 * something else. One item is one block now; a word is practised whole.
 */

export interface WordExample {
  zh: string;
  py: string;
  en: string;
}

export interface WordInfo {
  w: string;
  /** the reading as one word, péngyou rather than péng you */
  py: string;
  d: string;
  hsk: number | null;
  /** measure words it takes */
  cl: string[];
  ex: WordExample[];
  /** the characters it is written with, the ones the library knows */
  chars: CharacterEntry[];
  /** a couple of other words it turns up in: 朋友 → 男朋友, 女朋友 */
  also: Array<{ w: string; d: string }>;
}

export type PrintItem =
  | { kind: 'char'; id: ItemId; e: CharacterEntry }
  | { kind: 'word'; id: ItemId; w: WordInfo };

/** The glyphs a block practises. */
export const glyphsOf = (item: PrintItem): string[] =>
  item.kind === 'char' ? [item.e.c] : [...item.w.w];

/** Syllabus pinyin is spaced by syllable; a word is read, and printed, as one. */
const joinReading = (py: string) => py.replace(/\s+/g, '');

const firstSense = (d: string) => d.split(/[;,]/)[0].trim();

function wordInfo(lib: Library, w: string, listed?: CollectionWord): WordInfo {
  const sw = lib.byWord.get(w);
  const chars = [...w].map((c) => lib.byChar.get(c)).filter((e): e is CharacterEntry => !!e);

  // Examples from the word list first; failing that, any sentence one of its
  // characters carries that actually uses the word.
  let ex: WordExample[] = sw?.ex?.slice(0, 2) ?? listed?.examples?.slice(0, 2).map((l) => ({ zh: l.zh, py: l.py, en: l.en })) ?? [];
  if (!ex.length) {
    const sent = chars.map((c) => c.sent).find((s) => s && s.zh.includes(w));
    if (sent) ex = [{ zh: sent.zh, py: sent.py ?? '', en: sent.en }];
  }

  const also: WordInfo['also'] = [];
  if (w.length <= 3) {
    for (const o of lib.words) {
      if (also.length >= 2 || o.hsk > 4) continue;
      if (o.w !== w && o.w.includes(w)) also.push({ w: o.w, d: firstSense(o.d) });
    }
  }

  return {
    w,
    py: joinReading(sw?.py ?? listed?.py ?? chars.map((c) => c.py[0] ?? '').join('')),
    d: sw?.d ?? listed?.d ?? chars.map((c) => firstSense(c.def)).join(' + '),
    hsk: sw?.hsk ?? listed?.hsk ?? null,
    cl: sw?.cl ?? [],
    ex,
    chars,
    also,
  };
}

export function printItems(lib: Library, ids: ItemId[], words?: CollectionWord[]): PrintItem[] {
  const out: PrintItem[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const v = idValue(id);
    if (seen.has(v)) continue;
    if (isCharId(id) || (isWordId(id) && [...v].length === 1)) {
      // A one-character word is that character, and prints as one.
      const e = lib.byChar.get(v);
      if (!e) continue;
      seen.add(v);
      out.push({ kind: 'char', id, e });
    } else if (isWordId(id)) {
      const info = wordInfo(lib, v, words?.find((x) => x.w === v));
      if (!info.chars.length) continue;
      seen.add(v);
      out.push({ kind: 'word', id, w: info });
    }
  }
  return out;
}

/** "Characters", "Words" or "Items", for the corner of the page header. */
export function itemsNoun(items: PrintItem[]): string {
  if (items.every((i) => i.kind === 'char')) return 'Characters';
  if (items.every((i) => i.kind === 'word')) return 'Words';
  return 'Items';
}
