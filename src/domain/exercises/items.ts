import { picturesFor } from '../../data/pictures';
import type { Library } from '../../data/types';
import { charId, idValue, isCharId, wordId, type ItemId } from '../ids';
import { toneOf, withoutTone } from '../drill';
import { wordInfo } from '../words';

/**
 * Everything an exercise needs to know about one item, the same shape for a
 * character and a word, so a generator does not care which it was given.
 */
export interface ItemInfo {
  id: ItemId;
  kind: 'char' | 'word';
  /** the hanzi: 好, 火车 */
  text: string;
  /** reading, syllables separated by spaces: "huǒ chē" */
  py: string;
  /** a short English meaning, the first sense */
  gloss: string;
  /** the full definition, every sense */
  def: string;
  /** HSK band, 1–7, or 0 when off the lists */
  band: number;
  chars: string[];
  /** measure words, for nouns */
  cl: string[];
  /** example sentences */
  ex: Array<{ zh: string; py: string; en: string }>;
  /** a photo's source, when there is one */
  picture: string | null;
}

/** A short English gloss: the first sense, without "to " or a bracketed note. */
export function gist(d: string): string {
  const first = d.split(/[;]/)[0]!.split(/,\s/)[0]!;
  return first.replace(/\([^)]*\)/g, '').replace(/^to\s+/i, '').replace(/\s+/g, ' ').trim() || d.trim();
}

/** A reading in syllables: "huǒchē" or "huǒ chē" → ["huǒ", "chē"]. */
export function syllablesOf(py: string): string[] {
  return py
    .trim()
    .split(/[\s'’·-]+/)
    .filter(Boolean);
}

export function itemInfo(lib: Library, id: ItemId): ItemInfo | null {
  const text = idValue(id);
  if (isCharId(id)) {
    const e = lib.byChar.get(text);
    if (!e) return null;
    const ex = e.sent ? [{ zh: e.sent.zh, py: e.sent.py ?? '', en: e.sent.en }] : [];
    return {
      id,
      kind: 'char',
      text,
      py: e.py[0] ?? '',
      gloss: gist(e.def),
      def: e.def,
      band: e.hsk,
      chars: [text],
      cl: [],
      ex,
      picture: null,
    };
  }
  const w = wordInfo(lib, text);
  if (!w) return null;
  return {
    id,
    kind: 'word',
    text,
    py: w.py,
    gloss: gist(w.d),
    def: w.d,
    band: w.hsk,
    chars: [...text],
    cl: w.cl ?? [],
    ex: w.ex ?? [],
    picture: picturesFor(text)?.picture?.src ?? null,
  };
}

/** The tone of each syllable of an item's reading. */
export const tonesOf = (py: string) => syllablesOf(py).map((s) => ({ py: s, bare: withoutTone(s), tone: toneOf(s) }));

/** The id an item's text would have: a single character as a character, anything longer as a word. */
export const idFor = (text: string): ItemId => ([...text].length === 1 ? charId(text) : wordId(text));

/* ------------------------------------------------------------ distractors */

/**
 * Wrong answers that are worth being wrong about: for a character, its own
 * look-alikes first; for a word, words of the same length and band. Never an
 * item whose meaning is the same as the answer's — two right answers on one
 * card is a card nobody can pass.
 */
export function distractors(lib: Library, item: ItemInfo, n: number, pool: readonly ItemInfo[], shuffle: <T>(l: readonly T[]) => T[]): ItemInfo[] {
  const same = (x: ItemInfo) => x.text === item.text || x.gloss.toLowerCase() === item.gloss.toLowerCase();
  const out: ItemInfo[] = [];
  const take = (x: ItemInfo | null) => {
    if (x && !same(x) && !out.some((o) => o.text === x.text || o.gloss.toLowerCase() === x.gloss.toLowerCase())) out.push(x);
  };
  if (item.kind === 'char') {
    for (const c of lib.byChar.get(item.text)?.conf ?? []) {
      if (out.length >= Math.ceil(n / 2)) break;
      take(itemInfo(lib, charId(c)));
    }
  }
  const len = item.chars.length;
  const near = shuffle(pool.filter((x) => x.kind === item.kind && x.chars.length === len && Math.abs(x.band - item.band) <= 1));
  for (const x of near) {
    if (out.length >= n) break;
    take(x);
  }
  for (const x of shuffle(pool)) {
    if (out.length >= n) break;
    if (x.kind === item.kind) take(x);
  }
  return out.slice(0, n);
}

/* ------------------------------------------------------------ sentences */

const HANZI = /\p{Script=Han}/u;

/**
 * A sentence to meet an item in, whose every other character is already
 * known — a sentence with three strangers in it teaches none of them. The
 * shortest that qualifies, since a short sentence is one you can hold in mind
 * while you build it.
 */
export function sentenceFor(
  lib: Library,
  item: ItemInfo,
  known: ReadonlySet<string>,
): { zh: string; py: string; en: string } | null {
  const pool = [...item.ex];
  if (item.kind === 'char') {
    for (const w of lib.byChar.get(item.text)?.words ?? []) {
      const sw = lib.byWord.get(w.w);
      if (sw?.ex) pool.push(...sw.ex);
    }
  }
  const mine = new Set(item.chars);
  const ok = pool.filter(
    (s) => s.zh.includes(item.text) && [...s.zh].every((c) => !HANZI.test(c) || mine.has(c) || known.has(c)),
  );
  ok.sort((a, b) => a.zh.length - b.zh.length);
  return ok[0] ?? null;
}

/** Hanzi only: what a typed or built sentence is compared by. */
export const hanziOnly = (s: string) => [...s].filter((c) => HANZI.test(c)).join('');
