/**
 * What the dialogue needs to know about words: how a sentence cuts into
 * them, how they are read, and what they mean. The game passes one built
 * from the app's library (`libraryLexicon`); tests can pass the same, or a
 * small fake.
 */

import type { Library } from '../../../data/types';
import { segment } from '../../../domain/segment';
import { readingSyllables, toneless } from './normalize';

export interface Lexicon {
  /** the words of a hanzi line, in order, punctuation dropped */
  words(zh: string): string[];
  /** toneless syllables of hanzi, erhua dropped: 在哪儿 → zai na */
  syllables(zh: string): string[];
  /** a word's reading with tone marks, and a short English meaning */
  gloss(w: string): { py: string; en: string } | null;
}

/** The first sense, short: `to buy; to purchase` → `buy`. */
function shortSense(d: string): string {
  return (d.split(/[;,]/)[0] ?? d).replace(/^to /, '').replace(/\(.*?\)/g, '').trim();
}

export function libraryLexicon(lib: Library): Lexicon {
  const readingOf = (w: string): string => {
    const listed = lib.byWord.get(w);
    if (listed) return listed.py;
    return [...w].map((c) => lib.byChar.get(c)?.py[0] ?? '').join(' ');
  };
  return {
    words: (zh) => segment(zh, lib).filter((t) => t.word).map((t) => t.text),
    syllables: (zh) =>
      segment(zh, lib)
        .filter((t) => t.word)
        .flatMap((t) => {
          const listed = lib.byWord.get(t.text);
          if (listed) return readingSyllables(listed.py);
          // Off the lists: read it character by character; a trailing 儿 is erhua.
          const chars = [...t.text];
          return chars.flatMap((c, i) =>
            c === '儿' && i > 0 ? [] : toneless(lib.byChar.get(c)?.py[0] ?? c).split(' '),
          );
        }),
    gloss: (w) => {
      const listed = lib.byWord.get(w);
      if (listed) return { py: listed.py.replace(/ /g, ''), en: shortSense(listed.d) };
      const ch = [...w].length === 1 ? lib.byChar.get(w) : undefined;
      if (ch) return { py: ch.py[0] ?? '', en: shortSense(ch.def) };
      // Off the lists, but one of its characters' entries may know the word.
      for (const c of new Set(w)) {
        const known = lib.byChar.get(c)?.words.find((x) => x.w === w);
        if (known) return { py: known.p.replace(/ /g, ''), en: shortSense(known.d) };
      }
      const py = readingOf(w);
      return py.trim() ? { py: py.replace(/ /g, ''), en: '' } : null;
    },
  };
}
