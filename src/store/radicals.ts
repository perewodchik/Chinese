import {
  DEFAULT_RADICAL_SCOPE,
  isKnown,
  type RadicalScope,
  type RadicalSet,
} from '../domain/radicals/sets';
import { DEFAULT_RADICAL_SHEET, type RadicalSheet } from '../domain/radicals/sheet';
import { newId } from '../platform/ids';
import { dispatch, getState } from './store';

/**
 * Everything that changes the radical slice.
 *
 * The character store never calls any of this, and nothing here touches
 * collections, the review book, printed test sheets or texts. Like every other
 * change to the workspace, each one goes through `dispatch` as an action (see
 * radicalActions.ts), so it is saved to the account and can be replayed on top
 * of another device's work.
 */

const now = () => Date.now();

// ---------------------------------------------------------------------- sets

export function createRadicalSet(opts: {
  name: string;
  items?: number[];
  presetId?: string;
  sheet?: Partial<RadicalSheet>;
}): RadicalSet {
  const at = now();
  const set: RadicalSet = {
    id: newId(),
    name: opts.name.trim() || 'Radicals',
    items: [...new Set(opts.items ?? [])],
    sheet: { ...DEFAULT_RADICAL_SHEET, ...opts.sheet },
    scope: { ...DEFAULT_RADICAL_SCOPE },
    createdAt: at,
    updatedAt: at,
    presetId: opts.presetId,
  };
  dispatch({ type: 'radicals/create', set });
  return set;
}

export const renameRadicalSet = (id: string, name: string) =>
  dispatch({ type: 'radicals/update', id, patch: { name }, at: now() });

export const setRadicalSheet = (id: string, sheet: Partial<RadicalSheet>) =>
  dispatch({ type: 'radicals/update', id, patch: { sheet }, at: now() });

export const setRadicalScope = (id: string, scope: Partial<RadicalScope>) =>
  dispatch({ type: 'radicals/update', id, patch: { scope }, at: now() });

export const deleteRadicalSet = (id: string) => dispatch({ type: 'radicals/delete', id });

export function duplicateRadicalSet(id: string): RadicalSet | null {
  const copyId = newId();
  dispatch({ type: 'radicals/duplicate', id, copyId, at: now() });
  return getState().radicals.sets.find((s) => s.id === copyId) ?? null;
}

/** Adds radicals in the order given, skipping any the set already has. */
export const addRadicals = (id: string, ns: number[]) =>
  dispatch({ type: 'radicals/add', id, items: ns, at: now() });

export const removeRadicals = (id: string, ns: number[]) =>
  dispatch({ type: 'radicals/remove', id, items: ns, at: now() });

export const reorderRadicals = (id: string, items: number[]) =>
  dispatch({ type: 'radicals/reorder', id, items, at: now() });

// --------------------------------------------------------------------- known

/** Ticking radicals as known, or taking the tick back. */
export function setKnown(ns: number[], value: boolean, at = now()) {
  if (ns.length) dispatch({ type: 'radicals/setKnown', items: ns, value, at });
}

export const toggleKnown = (n: number) => setKnown([n], !isKnown(getState().radicals.known, n));

export const setRadicalLimit = (limit: number) => dispatch({ type: 'radicals/setLimit', limit });
