import { readFileSync } from 'node:fs';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import type { Band, GameContext } from '../types';
import { makeContext } from './context';

/**
 * A game context built from the real data files, for tests. (Named .test.ts
 * so the app build leaves it out; it has no tests of its own.)
 *
 * Games are about real HSK material, so their tests run on it: a test that
 * passes on three made-up words says nothing about whether the game has ten
 * rounds' worth of measure words at band 1.
 */

const read = <T,>(p: string): T =>
  JSON.parse(readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')) as T;

let lib: Library | null = null;
let pictures: Map<string, string> | null = null;
let native: Set<string> | null = null;

export function testContext(band: Band = 2, seed = 'test'): GameContext {
  if (!lib) {
    const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
    const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
    lib = {
      characters: chars,
      components: {},
      themes: [],
      strokes: {},
      byChar: new Map(chars.map((c) => [c.c, c])),
      words,
      byWord: new Map(words.map((w) => [w.w, w])),
    };
    const pics = read<{ words: Record<string, { img?: string }> }>('src/data/pictures.json').words;
    pictures = new Map(Object.entries(pics).flatMap(([w, e]) => (e.img ? [[w, e.img] as [string, string]] : [])));
    native = new Set(Object.keys(read<{ clips: Record<string, unknown> }>('public/voices/index.json').clips));
  }
  return makeContext({ lib, band, native: native!, known: new Set(), seed, pictures: (w) => pictures!.get(w) ?? null });
}
