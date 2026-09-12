import type { RadicalScope, RadicalSet } from '../domain/radicals/sets';
import type { RadicalSheet } from '../domain/radicals/sheet';
import { appendNew, reorderKeeping } from './lists';
import type { RadicalState } from './radicalState';

/**
 * Changes to the radical slice, as data.
 *
 * The same arrangement as the rest of the workspace (see actions.ts) — each
 * change carries its ids and its moment, so it can be replayed on top of
 * another device's work — in a file of its own because the slice is one:
 * nothing here reads collections, the review book, printed sheets or texts,
 * and nothing there reads this.
 */

export interface RadicalSetPatch {
  name?: string;
  sheet?: Partial<RadicalSheet>;
  scope?: Partial<RadicalScope>;
}

export type RadicalAction =
  | { type: 'radicals/create'; set: RadicalSet }
  | { type: 'radicals/update'; id: string; patch: RadicalSetPatch; at: number }
  | { type: 'radicals/delete'; id: string }
  | { type: 'radicals/duplicate'; id: string; copyId: string; at: number }
  | { type: 'radicals/add'; id: string; items: number[]; at: number }
  | { type: 'radicals/remove'; id: string; items: number[]; at: number }
  | { type: 'radicals/reorder'; id: string; items: number[]; at: number }
  | { type: 'radicals/setKnown'; items: number[]; value: boolean; at: number }
  | { type: 'radicals/setLimit'; limit: number };

export const isRadicalAction = (action: { type: string }): action is RadicalAction =>
  action.type.startsWith('radicals/');

export function reduceRadicals(state: RadicalState, action: RadicalAction): RadicalState {
  switch (action.type) {
    case 'radicals/create':
      return state.sets.some((s) => s.id === action.set.id) ? state : { ...state, sets: [...state.sets, action.set] };

    case 'radicals/update': {
      const { name, sheet, scope } = action.patch;
      return updateSet(state, action.id, action.at, (s) => ({
        ...s,
        name: name ?? s.name,
        sheet: sheet ? { ...s.sheet, ...sheet } : s.sheet,
        scope: scope ? { ...s.scope, ...scope } : s.scope,
      }));
    }

    case 'radicals/delete':
      return state.sets.some((s) => s.id === action.id)
        ? { ...state, sets: state.sets.filter((s) => s.id !== action.id) }
        : state;

    case 'radicals/duplicate': {
      const source = state.sets.find((s) => s.id === action.id);
      if (!source || state.sets.some((s) => s.id === action.copyId)) return state;
      const copy: RadicalSet = {
        ...source,
        id: action.copyId,
        name: `${source.name} (copy)`,
        createdAt: action.at,
        updatedAt: action.at,
      };
      return { ...state, sets: [...state.sets, copy] };
    }

    case 'radicals/add':
      return updateSet(state, action.id, action.at, (s) => {
        const items = appendNew(s.items, action.items);
        return items === s.items ? s : { ...s, items };
      });

    case 'radicals/remove': {
      const drop = new Set(action.items);
      return updateSet(state, action.id, action.at, (s) =>
        s.items.some((n) => drop.has(n)) ? { ...s, items: s.items.filter((n) => !drop.has(n)) } : s,
      );
    }

    case 'radicals/reorder':
      return updateSet(state, action.id, action.at, (s) => ({ ...s, items: reorderKeeping(s.items, action.items) }));

    case 'radicals/setKnown': {
      if (!action.items.length) return state;
      const known = { ...state.known };
      for (const n of action.items) {
        // Known since the first time it was said, however often it is said again.
        if (action.value) known[n] ??= action.at;
        else delete known[n];
      }
      return { ...state, known };
    }

    case 'radicals/setLimit':
      return state.limit === action.limit ? state : { ...state, limit: action.limit };
  }
}

/** The radical counterpart of `coalesce` in actions.ts: only changes that set values fold together. */
export function coalesceRadicals(last: RadicalAction, next: RadicalAction): RadicalAction | null {
  if (next.type === 'radicals/update' && last.type === 'radicals/update' && last.id === next.id) {
    const a = last.patch;
    const b = next.patch;
    return {
      ...next,
      patch: {
        ...a,
        ...b,
        sheet: a.sheet || b.sheet ? { ...a.sheet, ...b.sheet } : undefined,
        scope: a.scope || b.scope ? { ...a.scope, ...b.scope } : undefined,
      },
    };
  }
  if (next.type === 'radicals/reorder' && last.type === 'radicals/reorder' && last.id === next.id) return next;
  if (next.type === 'radicals/setLimit' && last.type === 'radicals/setLimit') return next;
  return null;
}

function updateSet(
  state: RadicalState,
  id: string,
  at: number,
  change: (set: RadicalSet) => RadicalSet,
): RadicalState {
  let changed = false;
  const sets = state.sets.map((s) => {
    if (s.id !== id) return s;
    const next = change(s);
    if (next === s) return s;
    changed = true;
    return { ...next, updatedAt: at };
  });
  return changed ? { ...state, sets } : state;
}
