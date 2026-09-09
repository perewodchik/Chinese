import type {
  CharacterEntry,
  ComponentGloss,
  Library,
  RadicalEntry,
  StrokeMap,
  Theme,
} from './types';

let cached: Promise<Library> | null = null;
let extended: Promise<void> | null = null;

async function json<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} failed to load (${r.status})`);
  return r.json() as Promise<T>;
}

/**
 * Loads the character, radical and theme tables plus the stroke outlines for
 * HSK 1-3. Outlines for the higher bands are several megabytes and are fetched
 * separately, the first time something actually needs them.
 */
export function loadLibrary(): Promise<Library> {
  if (cached) return cached;
  cached = (async () => {
    const [chars, rads, themes, strokes] = await Promise.all([
      json<{ items: CharacterEntry[]; components: Record<string, ComponentGloss> }>(
        'data/characters.json',
      ),
      json<{ items: RadicalEntry[] }>('data/radicals.json'),
      json<{ items: Theme[] }>('data/themes.json'),
      json<StrokeMap>('data/strokes-core.json'),
    ]);
    return {
      characters: chars.items,
      components: chars.components ?? {},
      radicals: rads.items,
      themes: themes.items,
      strokes,
      byChar: new Map(chars.items.map((c) => [c.c, c])),
      byRadical: new Map(rads.items.map((r) => [r.r, r])),
    };
  })();
  return cached;
}

/**
 * Merges in the outlines for HSK 4-9. Safe to call repeatedly; the fetch
 * happens once. Resolves even on failure, since a missing outline degrades to
 * the font rather than breaking the page.
 */
export function loadExtendedStrokes(lib: Library): Promise<void> {
  if (!extended) {
    extended = json<StrokeMap>('data/strokes-ext.json')
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

/** A radical is identified by its Kangxi number: 阝 is two different radicals. */
export const radicalKey = (r: RadicalEntry) => `r${r.n}`;
