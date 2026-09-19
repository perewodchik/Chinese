import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { CharacterEntry, Library } from '../../src/data/types';
import { singleTones, tonePairs } from '../../src/domain/pinyin/practice';
import { SOUND_LESSONS } from '../../src/domain/pinyin/sounds';
import { wordIndex } from '../../src/domain/vocab';

/**
 * Everything the pronunciation section says aloud, straight from the same
 * code that puts it on screen — so the voice pack can never drift from the
 * words the pages actually show.
 */

export interface Item {
  /** what is read */
  text: string;
  /** one syllable per character, for the tone check; absent where it should not be checked */
  reading?: string;
  /** tone-critical: a reference the learner's pitch is compared with */
  tonal: boolean;
}

export function libraryFromDisk(root: string): Library {
  const data = JSON.parse(readFileSync(`${root}/public/data/characters.json`, 'utf8')) as {
    items: CharacterEntry[];
  };
  return {
    characters: data.items,
    byChar: new Map(data.items.map((c) => [c.c, c])),
    themes: [],
    components: {},
    strokes: {},
  };
}

export function practiceItems(lib: Library): Item[] {
  const out = new Map<string, Item>();
  const add = (text: string, reading: string | undefined, tonal: boolean) => {
    const had = out.get(text);
    if (!had) out.set(text, { text, reading, tonal });
    else if (tonal && !had.tonal) out.set(text, { text, reading: reading ?? had.reading, tonal });
  };
  for (const pair of tonePairs(lib)) for (const w of pair.words) add(w.word, w.reading, true);
  for (const list of Object.values(singleTones(lib))) for (const w of list) add(w.word, w.reading, true);
  for (const l of SOUND_LESSONS) {
    for (const w of l.words) add(w.word, w.reading, false);
    for (const n of l.notes) add(n.example.word, n.example.reading, false);
    for (const p of l.pairs) {
      add(p.a.word, p.a.reading, false);
      add(p.b.word, p.b.reading, false);
    }
  }
  return [...out.values()];
}

export interface Sentence {
  id: number;
  zh: string;
  py: string;
  en: string;
  hsk: number;
  len: number;
  topics: string[];
}

/**
 * The reading of a sentence, one syllable per Han character.
 *
 * Words come from CC-CEDICT, through the app's own word index, longest match
 * first — it marks the neutral tones a learner has to hear (时候 shí hou), which
 * pypinyin mostly does not. Whatever no word covers keeps pypinyin's reading,
 * which was chosen with the sentence around it and so gets 了 and 都 right.
 */
export function sentenceReading(zh: string, pypinyin: string, lib: Library): string {
  const han = [...zh].filter((c) => /[一-鿿]/.test(c));
  const fallback = pypinyin.split(/\s+/);
  const words = wordIndex(lib);
  const out: string[] = [];
  for (let i = 0; i < han.length; ) {
    let took = 0;
    for (let n = Math.min(4, han.length - i); n >= 2 && !took; n--) {
      const w = words.get(han.slice(i, i + n).join(''));
      const syl = w?.p.trim().split(/\s+/);
      if (syl && syl.length === n) {
        out.push(...syl.map((s) => s.toLowerCase()));
        took = n;
      }
    }
    if (!took) {
      out.push(fallback[i] ?? '');
      took = 1;
    }
    i += took;
  }
  return out.join(' ');
}

/** A short stable name for a text, usable as a file name. */
export const clipName = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);
