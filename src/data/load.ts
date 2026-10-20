import type { CharacterEntry, ComponentGloss, Library, StrokeMap, SyllabusWord, Theme } from './types';

/**
 * The character data. Radicals are their own dataset, fetched by
 * data/radicals.ts when the radicals page is opened; nothing here reads them.
 */

let cached: Promise<Library> | null = null;
let extended: Promise<void> | null = null;

/**
 * Paths start at the root. Pages have addresses of their own now, and from
 * /collections/abc a relative `data/characters.json` would be a request for
 * /collections/data/characters.json.
 */
async function json<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} failed to load (${r.status})`);
  return r.json() as Promise<T>;
}

/**
 * Loads the character, word and theme tables plus the stroke outlines for
 * HSK 1-3. Outlines for the higher bands are several megabytes and are fetched
 * separately, the first time something actually needs them.
 */
export function loadLibrary(): Promise<Library> {
  if (cached) return cached;
  cached = (async () => {
    const [chars, words, themes, strokes] = await Promise.all([
      json<{ items: CharacterEntry[]; components: Record<string, ComponentGloss> }>(
        '/data/characters.json',
      ),
      json<{ items: SyllabusWord[] }>('/data/words.json'),
      json<{ items: Theme[] }>('/data/themes.json'),
      json<StrokeMap>('/data/strokes-core.json'),
    ]);
    const byWord = new Map(words.items.map((w) => [w.w, w]));
    leadWithUse(chars.items, byWord);
    return {
      characters: chars.items,
      components: chars.components ?? {},
      themes: themes.items,
      strokes,
      byChar: new Map(chars.items.map((c) => [c.c, c])),
      words: words.items,
      byWord,
    };
  })();
  // A failed load is not cached, so trying again tries again.
  cached.catch(() => {
    cached = null;
  });
  return cached;
}

/**
 * A character's meaning as it is used today, where the syllabus has it as a
 * word on its own at the same level: 穿 is "to wear", not the dictionary's
 * first "to drill, to pierce"; 呢 is a question particle, not "wool"; 周 is a
 * week, not a dynasty. The character dictionary orders senses by history, and
 * the first sense is the one every card, list and drill shows. Where the word
 * comes only at a later level (中 as "within" at HSK 3), the character's own
 * reading stands.
 */
export function leadWithUse(chars: CharacterEntry[], byWord: ReadonlyMap<string, SyllabusWord>) {
  for (const c of chars) {
    const w = byWord.get(c.c);
    if (w?.d && w.hsk && c.hsk && w.hsk <= c.hsk) c.def = w.d;
  }
}

/**
 * Merges in the outlines for HSK 4-9. Safe to call repeatedly; the fetch
 * happens once. Resolves even on failure, since a missing outline degrades to
 * the font rather than breaking the page.
 */
export function loadExtendedStrokes(lib: Library): Promise<void> {
  if (!extended) {
    extended = json<StrokeMap>('/data/strokes-ext.json')
      .then((ext) => {
        Object.assign(lib.strokes, ext);
      })
      .catch(() => undefined);
  }
  return extended;
}

/** Ensures every one of `chars` has an outline loaded, if one exists at all. */
export async function ensureStrokes(
  lib: Library,
  chars: Iterable<string>,
): Promise<void> {
  for (const c of chars) {
    if (!lib.strokes[c]) {
      await loadExtendedStrokes(lib);
      return;
    }
  }
}
