import type { Library } from '../../data/types';
import type { Collection } from '../../domain/collection';
import { charId, idValue, isWordId, wordId, type ItemId } from '../../domain/ids';
import { allPresets, type Preset } from '../../domain/presets';
import { hskLabel } from '../../domain/text';

/**
 * Everything the library holds, as sets: a band of the syllabus, a topic, or
 * a list of your own. They used to be three things in three places — the
 * band strip in the library, the ready-made sets under Lists to print, and
 * your lists beside them — although each is the same thing: some characters
 * and some words to look through, learn and print.
 *
 * A set is a view, not a stored thing, except a list of your own, which is
 * a collection. Printing a ready-made set makes it one of your lists, so the
 * sheet design has somewhere to be kept.
 */
export interface LibSet {
  /** `hsk-1`, `theme-food`, `wordset-zouzou-first`, or `list-<collection id>` */
  id: string;
  group: 'mine' | 'hsk' | 'topic';
  name: string;
  blurb: string;
  chars: string[];
  words: string[];
  /** a list of your own */
  collection?: Collection;
  /** a ready-made set, to make a list from */
  preset?: Preset;
}

export const listSetId = (c: Collection) => `list-${c.id}`;

function split(ids: readonly ItemId[]) {
  const chars: string[] = [];
  const words: string[] = [];
  for (const id of ids) (isWordId(id) ? words : chars).push(idValue(id));
  return { chars, words };
}

export function bandSet(lib: Library, band: number): LibSet {
  return {
    id: `hsk-${band}`,
    group: 'hsk',
    name: hskLabel(band),
    blurb: allPresets(lib).find((p) => p.id === `hsk-${band}`)?.blurb ?? '',
    chars: lib.characters.filter((c) => c.hsk === band).map((c) => c.c),
    words: lib.words.filter((w) => w.hsk === band).map((w) => w.w),
  };
}

/** The topics: the themed character sets and the word sets that are not a band. */
export function topicSets(lib: Library): LibSet[] {
  return allPresets(lib)
    .filter((p) => p.group === 'theme' || (p.group === 'words' && !p.id.startsWith('wordset-hsk-')))
    .map((p) => ({ id: p.id, group: 'topic' as const, name: p.name, blurb: p.blurb, preset: p, ...split(p.items(lib)) }));
}

export function listSet(c: Collection): LibSet {
  // A list written around words keeps them too; its characters are its items.
  const own = split(c.items);
  const words = [...new Set([...own.words, ...(c.words ?? []).map((w) => w.w)])];
  return { id: listSetId(c), group: 'mine', name: c.name, blurb: c.note ?? '', collection: c, chars: own.chars, words };
}

/**
 * A ready-made set you have printed is one set, not two: the list made from
 * it is where its sheet is kept, and the set's page prints from it.
 */
export function withList(set: LibSet, collections: readonly Collection[]): LibSet {
  const c = collections.find((x) => x.presetId === set.id);
  return c ? { ...set, collection: c } : set;
}

/** Your own lists: those not made from a ready-made set, which show as that set. */
export function ownLists(collections: readonly Collection[], known: ReadonlySet<string>): LibSet[] {
  return collections.filter((c) => !/^New from “/.test(c.name) && !(c.presetId && known.has(c.presetId))).map(listSet);
}

export function findSet(lib: Library, collections: readonly Collection[], id: string): LibSet | null {
  const band = /^hsk-(\d)$/.exec(id);
  if (band) return withList(bandSet(lib, Number(band[1])), collections);
  if (id.startsWith('list-')) {
    const c = collections.find((x) => listSetId(x) === id);
    return c ? listSet(c) : null;
  }
  const topic = topicSets(lib).find((s) => s.id === id);
  return topic ? withList(topic, collections) : null;
}

export const charIds = (s: LibSet) => s.chars.map(charId);
export const wordIds = (s: LibSet) => s.words.map(wordId);
