/**
 * Identity for a character on a worksheet.
 *
 * `c好` is the character 好. The prefix is what is left of a namespace that
 * once covered radicals too, as `r38`; radicals have their own data, their own
 * sets and their own page now, and are named by their Kangxi number there. It
 * stays because every stored workspace is written with it.
 */
export type ItemId = string;

export const charId = (c: string): ItemId => `c${c}`;

/** The character an id points at. */
export const idValue = (id: ItemId): string => id.slice(1);

/** True for the ids this side of the app owns, so an older document can be filtered. */
export const isCharId = (id: unknown): id is ItemId =>
  typeof id === 'string' && id.startsWith('c') && id.length > 1;

export const countLabel = (n: number) => `${n} character${n === 1 ? '' : 's'}`;
