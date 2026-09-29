import type { Library } from '../../data/types';
import { segment } from '../../domain/segment';

export interface Piece {
  /** as written */
  text: string;
  /** its reading with tone marks, '' for punctuation and latin */
  py: string;
  /** a word the drawer can open */
  word: boolean;
}

/**
 * A line cut into words with their readings: the game's own words first (its
 * 成语, 马马虎虎 mǎmǎhūhū — never 马 | 马虎 | 虎), then the syllabus word's own
 * reading where there is one (东西 dōngxi), else each character's first. Lines
 * with a manual `pinyin` in the script should use that instead.
 */
export function readLine(zh: string, lib: Library, own: ReadonlyMap<string, string> = new Map()): Piece[] {
  return segment(zh, lib, new Set(own.keys())).map((t) => {
    if (!t.word) return { text: t.text, py: '', word: false };
    const listed = lib.byWord.get(t.text);
    const py = own.get(t.text) ?? (listed ? listed.py.replace(/ /g, '') : [...t.text].map((c) => lib.byChar.get(c)?.py[0] ?? '').join(''));
    return { text: t.text, py, word: true };
  });
}

/** Just the reading of a line, word by word: `Gǔlóu · Nánluógǔxiàng`. */
export const pinyinOf = (zh: string, lib: Library) =>
  readLine(zh, lib)
    .map((p) => (p.word ? p.py : p.text.trim()))
    .filter(Boolean)
    .join(' ')
    .replace(/ ([·,，。！？])/g, '$1')
    .replace(/([·]) /g, '$1 ');
