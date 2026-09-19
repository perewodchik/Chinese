import type { ItemId } from './ids';
import { isDue, SKILLS, type RecallBook } from './memory';
import type { SheetOptions } from './sheet';
import type { TextLine } from './text';

/**
 * A collection is one named body of work — "HSK 1", "Food", "The ones I keep
 * missing" — and it is where characters are gathered to go on paper.
 *
 * Radicals are not in here. They are studied as shapes, early, and have sets of
 * their own (domain/radicals/sets.ts): while the two shared this container,
 * every character screen had to filter radicals out and every radical sheet
 * inherited choices — "due for review" — that could never mean anything for it.
 *
 * The thing it replaced was a template: a fixed sheet of twenty characters,
 * which meant a three-hundred-character band arrived as fifteen near-identical
 * cards and the question "have I done this one" had fifteen answers. A
 * collection instead holds however many items you put in it and decides at
 * print time how much of it to put on paper, so there is one card per subject
 * and one place to look.
 */

/**
 * Which slice of a collection the next PDF covers.
 *
 * The first three are choices you make. The last two are answers the app has:
 * `due` is what the schedule says is slipping, and `weak` is what you have
 * actually failed more than once — which is a better reason to spend paper on
 * a character than any decision made by hand.
 */
export type ScopeMode = 'all' | 'unlearned' | 'range' | 'due' | 'weak';

export interface PrintScope {
  mode: ScopeMode;
  /** 1-based position of the first item, for `range` */
  from: number;
  /** how many items, for `range` */
  count: number;
}

/**
 * A word a collection was built around, as its writer explained it.
 *
 * A collection is still a list of characters — characters are what go on
 * paper and what the schedule asks about. A list written to order ("seeing a
 * doctor") is made of words, though, and the words are the point: these ride
 * along beside the characters, so the collection can show what each one was
 * for.
 */
export interface CollectionWord {
  w: string;
  py: string;
  /** a short meaning */
  d: string;
  /** HSK band, 7 for 7–9; null outside the syllabus */
  hsk: number | null;
  /** how it is used, what it goes with, what to watch for */
  explain: string;
  examples: TextLine[];
}

export interface Collection {
  id: string;
  name: string;
  items: ItemId[];
  sheet: SheetOptions;
  scope: PrintScope;
  createdAt: number;
  updatedAt: number;
  /** the ready-made set it was built from, if any */
  presetId?: string;
  note?: string;
  /** the words it was written around, when Claude wrote it */
  words?: CollectionWord[];
  /** what was asked for, in your own words */
  brief?: string;
}

export const DEFAULT_SCOPE: PrintScope = { mode: 'all', from: 1, count: 20 };

export interface CollectionStats {
  total: number;
  learned: number;
  /** items the next PDF would cover */
  printing: number;
  pages: number;
}

/** Times this item has been failed, across every skill. */
export const lapsesOf = (book: RecallBook | undefined, id: ItemId): number =>
  SKILLS.reduce((n, s) => n + (book?.[id]?.[s]?.lapses ?? 0), 0);

const anyDue = (book: RecallBook | undefined, id: ItemId, now: number) =>
  SKILLS.some((s) => {
    const r = book?.[id]?.[s];
    return Boolean(r && isDue(r, now));
  });

/** The items the next PDF covers, in collection order. */
export function itemsInScope(
  c: Collection,
  learned: ReadonlySet<ItemId>,
  book?: RecallBook,
  now = Date.now(),
): ItemId[] {
  switch (c.scope.mode) {
    case 'unlearned':
      return c.items.filter((i) => !learned.has(i));
    case 'due':
      return c.items.filter((i) => anyDue(book, i, now));
    case 'weak':
      return c.items.filter((i) => lapsesOf(book, i) >= 2);
    case 'range': {
      const from = Math.max(1, Math.min(c.scope.from, c.items.length || 1));
      return c.items.slice(from - 1, from - 1 + Math.max(1, c.scope.count));
    }
    default:
      return c.items;
  }
}

export const pagesFor = (count: number, perPage: number) =>
  Math.max(1, Math.ceil(count / Math.max(1, perPage)));

export function statsOf(
  c: Collection,
  learned: ReadonlySet<ItemId>,
  book?: RecallBook,
): CollectionStats {
  const printing = itemsInScope(c, learned, book).length;
  return {
    total: c.items.length,
    learned: c.items.filter((i) => learned.has(i)).length,
    printing,
    pages: pagesFor(printing, c.sheet.perPage),
  };
}

export function scopeLabel(
  c: Collection,
  learned: ReadonlySet<ItemId>,
  book?: RecallBook,
): string {
  const n = itemsInScope(c, learned, book).length;
  switch (c.scope.mode) {
    case 'unlearned':
      return `${n} not yet learned`;
    case 'due':
      return `${n} due for review`;
    case 'weak':
      return `${n} missed more than once`;
    case 'range':
      return `${n} from #${c.scope.from}`;
    default:
      return `all ${n}`;
  }
}

/**
 * A file name for the PDF that says which slice it is, so two prints from one
 * collection do not land in the folder under the same name.
 */
export function printName(c: Collection): string {
  if (c.scope.mode === 'range') {
    const to = Math.min(c.items.length, c.scope.from + c.scope.count - 1);
    return `${c.name} ${c.scope.from}-${to}`;
  }
  if (c.scope.mode === 'unlearned') return `${c.name} — to learn`;
  if (c.scope.mode === 'due') return `${c.name} — due`;
  if (c.scope.mode === 'weak') return `${c.name} — the hard ones`;
  return c.name;
}

/**
 * Which collections hold each item, so the library can say "already in HSK 1"
 * and nothing gets queued twice by accident.
 */
export function collectionsByItem(collections: Collection[]): Map<ItemId, Collection[]> {
  const map = new Map<ItemId, Collection[]>();
  for (const c of collections) {
    for (const id of c.items) {
      const list = map.get(id);
      if (list) list.push(c);
      else map.set(id, [c]);
    }
  }
  return map;
}

/** Everything that some collection other than `exceptId` already holds. */
export function claimedItems(collections: Collection[], exceptId?: string): Set<ItemId> {
  const out = new Set<ItemId>();
  for (const c of collections) {
    if (c.id === exceptId) continue;
    for (const id of c.items) out.add(id);
  }
  return out;
}

/** "Characters 3" — a name for a new, empty collection that no collection has yet. */
export function nextCollectionName(collections: Collection[]): string {
  const taken = new Set(collections.map((c) => c.name));
  let n = collections.length + 1;
  while (taken.has(`Characters ${n}`)) n++;
  return `Characters ${n}`;
}
