import type { RadicalSheet } from './sheet';

/**
 * A radical set: a named list of radicals to put on paper.
 *
 * It is the radical counterpart of a collection, and kept apart from
 * collections on purpose. Radicals are shapes you learn early and then stop
 * studying; characters are studied for years and scheduled for review. While
 * the two shared one container, every character page had to filter radicals
 * out, and radical sheets offered choices — "due for review", "the ones I miss"
 * — that could never mean anything for them.
 */

/** Which slice of a set the next PDF covers. */
export type RadicalScopeMode = 'all' | 'unknown' | 'range';

export interface RadicalScope {
  mode: RadicalScopeMode;
  /** 1-based position of the first radical, for `range` */
  from: number;
  /** how many, for `range` */
  count: number;
}

export interface RadicalSet {
  id: string;
  name: string;
  /** Kangxi numbers, in the order they print */
  items: number[];
  sheet: RadicalSheet;
  scope: RadicalScope;
  createdAt: number;
  updatedAt: number;
  /** the ready-made set it started from */
  presetId?: string;
}

/**
 * The radicals you know, by Kangxi number, with when you said so.
 *
 * A plain claim, not a schedule. Knowing a radical means recognising the shape
 * inside a character and knowing what it signals; there is nothing to forget on
 * a timetable, and a review queue for it would be one more thing to clear.
 */
export type KnownRadicals = Record<number, number>;

export const DEFAULT_RADICAL_SCOPE: RadicalScope = { mode: 'all', from: 1, count: 20 };

export const isKnown = (known: KnownRadicals, n: number) => known[n] !== undefined;

/** The radicals the next PDF covers, in set order. */
export function radicalsInScope(set: RadicalSet, known: KnownRadicals): number[] {
  switch (set.scope.mode) {
    case 'unknown':
      return set.items.filter((n) => !isKnown(known, n));
    case 'range': {
      const from = Math.max(1, Math.min(set.scope.from, set.items.length || 1));
      return set.items.slice(from - 1, from - 1 + Math.max(1, set.scope.count));
    }
    default:
      return set.items;
  }
}

export const radicalPages = (count: number, perPage: number) =>
  Math.max(1, Math.ceil(count / Math.max(1, perPage)));

export interface RadicalSetStats {
  total: number;
  known: number;
  printing: number;
  pages: number;
}

export function radicalSetStats(set: RadicalSet, known: KnownRadicals): RadicalSetStats {
  const printing = radicalsInScope(set, known).length;
  return {
    total: set.items.length,
    known: set.items.filter((n) => isKnown(known, n)).length,
    printing,
    pages: radicalPages(printing, set.sheet.perPage),
  };
}

export function radicalScopeLabel(set: RadicalSet, known: KnownRadicals): string {
  const n = radicalsInScope(set, known).length;
  switch (set.scope.mode) {
    case 'unknown':
      return `${n} not known yet`;
    case 'range':
      return `${n} from #${set.scope.from}`;
    default:
      return `all ${n}`;
  }
}

/** A file name that says which slice it is, so two prints never collide. */
export function radicalPrintName(set: RadicalSet): string {
  if (set.scope.mode === 'range') {
    const to = Math.min(set.items.length, set.scope.from + set.scope.count - 1);
    return `${set.name} ${set.scope.from}-${to}`;
  }
  if (set.scope.mode === 'unknown') return `${set.name} — to learn`;
  return set.name;
}

export const radicalCount = (n: number) => `${n} radical${n === 1 ? '' : 's'}`;
