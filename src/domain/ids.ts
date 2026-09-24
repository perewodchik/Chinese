/**
 * Identity for something you study: a character, or a word.
 *
 * `c好` is the character 好 and `w好` is the word 好 — one character long, and
 * still a different thing to know: the character is what you write, the word
 * is what you read in a sentence. `w东西` is the word 东西. They are tracked
 * apart, and a collection can hold both.
 *
 * The prefix is what is left of a namespace that once covered radicals too, as
 * `r38`; radicals have their own data, their own sets and their own page now,
 * and are named by their Kangxi number there.
 */
export type ItemId = string;

export const charId = (c: string): ItemId => `c${c}`;

export const wordId = (w: string): ItemId => `w${w}`;

/** The character or word an id points at. */
export const idValue = (id: ItemId): string => id.slice(1);

export const isCharId = (id: unknown): id is ItemId =>
  typeof id === 'string' && id.startsWith('c') && id.length > 1;

export const isWordId = (id: unknown): id is ItemId =>
  typeof id === 'string' && id.startsWith('w') && id.length > 1;

/** True for the ids this side of the app owns, so an older document can be filtered. */
export const isItemId = (id: unknown): id is ItemId => isCharId(id) || isWordId(id);

/** The characters among a set of ids, as characters: what "the ones I can read" means. */
export function charsOf(ids: Iterable<ItemId>): Set<string> {
  const out = new Set<string>();
  for (const id of ids) if (isCharId(id)) out.add(idValue(id));
  return out;
}

/** The words among a set of ids, as words. */
export function wordsOf(ids: Iterable<ItemId>): Set<string> {
  const out = new Set<string>();
  for (const id of ids) if (isWordId(id)) out.add(idValue(id));
  return out;
}

export const countLabel = (n: number) => `${n} character${n === 1 ? '' : 's'}`;
