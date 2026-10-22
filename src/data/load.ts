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

/** Characters asked of the server, by the request that asks: each is asked once at a time. */
const askingServer = new Map<string, Promise<void>>();

/**
 * Ensures every one of `chars` has an outline loaded, if one exists at all:
 * the syllabus from the built data, anything else (圳, a name in a book) from
 * the server, which looks it up in the same source.
 */
export async function ensureStrokes(
  lib: Library,
  chars: Iterable<string>,
): Promise<void> {
  const want = [...new Set(chars)].filter((c) => /\p{Script=Han}/u.test(c));
  if (want.some((c) => !lib.strokes[c])) await loadExtendedStrokes(lib);
  const missing = want.filter((c) => !lib.strokes[c]);
  const fresh = missing.filter((c) => !askingServer.has(c));
  if (fresh.length) {
    const asked = askServer(lib, fresh);
    for (const c of fresh) askingServer.set(c, asked);
  }
  // A second page asking for the same character waits for the same answer.
  await Promise.all(missing.map((c) => askingServer.get(c)));
}

async function askServer(lib: Library, chars: string[]): Promise<void> {
  try {
    const { lookUpStrokes } = await import('../api/strokes');
    const { STROKES_PER_REQUEST } = await import('../../shared/strokes');
    for (let i = 0; i < chars.length; i += STROKES_PER_REQUEST) {
      const { strokes } = await lookUpStrokes(chars.slice(i, i + STROKES_PER_REQUEST));
      Object.assign(lib.strokes, strokes);
    }
  } catch {
    // Offline, or the source did not answer: the font stands in, and the
    // next page that needs one asks again.
    for (const c of chars) askingServer.delete(c);
  }
}
