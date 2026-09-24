import type { CharacterEntry, ComponentGloss, Library } from '../data/types';
import { charId, idValue, isCharId, wordId, type ItemId } from './ids';

/**
 * Reading the library by item id.
 *
 * The data file knows nothing about ids — it is a table of characters.
 * Everything that turns an id back into something you can draw or read lives
 * here.
 */

/** The character an id names — never a word's, even a word one character long. */
export const characterOf = (lib: Library, id: ItemId): CharacterEntry | undefined =>
  isCharId(id) ? lib.byChar.get(idValue(id)) : undefined;

/** The glyph an id draws as. */
export const glyphOf = (_lib: Library, id: ItemId): string => idValue(id);

export interface ItemFacts {
  id: ItemId;
  glyph: string;
  py: string;
  gloss: string;
  /** position in the teaching order */
  idx: number;
  strokes: number;
  /** lower is more common */
  freq: number;
  radical: string;
  hsk: number;
}

export function factsOf(lib: Library, id: ItemId): ItemFacts | null {
  const c = characterOf(lib, id);
  if (c) {
    return {
      id,
      glyph: c.c,
      py: c.py.join(' / '),
      gloss: c.def,
      idx: c.i,
      strokes: c.sc ?? 0,
      freq: c.freq,
      radical: c.rad ?? '',
      hsk: c.hsk,
    };
  }
  return null;
}

/**
 * What one part of a character means — asking the character, not just the part.
 *
 * 阝 is two radicals that share a shape: a hill on the left of 院, a city on the
 * right of 部. 王 on the left of 玩 is jade, not king. The components table has
 * one entry per shape, so where the part sits decides which reading of it is
 * the true one.
 */
export function partGloss(
  components: Record<string, ComponentGloss>,
  e: CharacterEntry,
  part: string,
): string {
  const beside = e.ids?.startsWith('⿰') ?? false;
  const first = e.parts[0] === part;
  if (part === '阝' && beside) return first ? 'mound, hill' : 'city';
  if (part === '王' && beside && first) return 'jade';
  return components[part]?.def ?? '';
}

/** First sense of a definition — "good; fine; well" reads as "good". */
export const firstSense = (s: string) => s.split(/[;,]/)[0].trim();

/** Every character, in the order the library teaches them. */
export const poolFor = (lib: Library): ItemId[] => lib.characters.map((c) => charId(c.c));

/** Every syllabus word, band by band, commonest first. */
export const wordPoolFor = (lib: Library): ItemId[] => lib.words.map((w) => wordId(w.w));

/**
 * Sorts ids into library order, so a collection always reads teachably:
 * characters in teaching order, then words in syllabus order.
 */
export function sortByLibrary(lib: Library, ids: ItemId[]): ItemId[] {
  const rank = new Map([...poolFor(lib), ...wordPoolFor(lib)].map((id, i) => [id, i]));
  return [...ids].sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
}
