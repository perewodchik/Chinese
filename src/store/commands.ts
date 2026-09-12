import { DEFAULT_SCOPE, type Collection, type PrintScope } from '../domain/collection';
import type { ItemId } from '../domain/ids';
import type { PrintedSheet, Rating, Skill } from '../domain/memory';
import { defaultSheet, type SheetOptions } from '../domain/sheet';
import type { GeneratedText, TextPlan, TextSet } from '../domain/text';
import { newId } from '../platform/ids';
import { serialise } from './migrations';
import type { AppSettings, AppState } from './state';
import { dispatch, getState } from './store';

/**
 * Everything a screen can do to what an account has saved.
 *
 * A command turns an intention into an action. Ids are minted and the clock is
 * read here, so that the action itself is plain data — data that means the
 * same thing when it is replayed later on top of another device's work.
 */

const now = () => Date.now();

const findCollection = (id: string) => getState().collections.find((c) => c.id === id) ?? null;

/* ------------------------------------------------------------ collections */

export function createCollection(opts: {
  name: string;
  items?: ItemId[];
  sheet?: Partial<SheetOptions>;
  presetId?: string;
}): Collection {
  const at = now();
  const collection: Collection = {
    id: newId(),
    name: opts.name.trim() || 'Untitled',
    items: [...new Set(opts.items ?? [])],
    sheet: { ...defaultSheet(), ...opts.sheet },
    scope: { ...DEFAULT_SCOPE },
    createdAt: at,
    updatedAt: at,
    presetId: opts.presetId,
  };
  dispatch({ type: 'collection/create', collection });
  return collection;
}

export const renameCollection = (id: string, name: string) =>
  dispatch({ type: 'collection/update', id, patch: { name }, at: now() });

export const setSheet = (id: string, sheet: Partial<SheetOptions>) =>
  dispatch({ type: 'collection/update', id, patch: { sheet }, at: now() });

export const setScope = (id: string, scope: Partial<PrintScope>) =>
  dispatch({ type: 'collection/update', id, patch: { scope }, at: now() });

export const deleteCollection = (id: string) => dispatch({ type: 'collection/delete', id });

export function duplicateCollection(id: string): Collection | null {
  const copyId = newId();
  dispatch({ type: 'collection/duplicate', id, copyId, at: now() });
  return findCollection(copyId);
}

/** Adds items at the end, skipping any already there. Returns how many were new. */
export function addItems(id: string, items: ItemId[]): number {
  const before = findCollection(id)?.items.length ?? 0;
  dispatch({ type: 'collection/addItems', id, items, at: now() });
  return (findCollection(id)?.items.length ?? 0) - before;
}

export const removeItems = (id: string, items: ItemId[]) =>
  dispatch({ type: 'collection/removeItems', id, items, at: now() });

export const reorderItems = (id: string, items: ItemId[]) =>
  dispatch({ type: 'collection/reorder', id, items, at: now() });

/* ----------------------------------------------------------------- memory */

/** One answer to one question, folded into what was already known. */
export const gradeItem = (id: ItemId, skill: Skill, rating: Rating) =>
  dispatch({ type: 'recall/grade', results: [{ id, skill, rating }], at: now() });

/**
 * Ticking the box by hand, which is still worth having — you have just read the
 * character in a sentence and you do know it. It is recorded as an assertion
 * rather than as a result, so it comes back to be checked in a week or so
 * instead of being believed forever. Unticking removes the claim and leaves
 * anything actually earned — a writing record, say — where it is.
 */
export function setLearned(ids: ItemId[], value: boolean) {
  if (ids.length) dispatch({ type: 'recall/setLearned', ids, value, at: now() });
}

export const toggleLearned = (id: ItemId) => setLearned([id], !getState().learned.has(id));

/* ------------------------------------------------------------ paper tests */

/**
 * Remembers that a recall sheet went to the printer.
 *
 * Without this the app would print a test and then have no idea it had done
 * so — and an unmarked test teaches nothing. The sheet sits in Review asking
 * to be marked until it is, or until it is thrown away.
 */
export function recordSheet(name: string, items: ItemId[]): PrintedSheet {
  const sheet: PrintedSheet = { id: newId(), name, items: [...items], printedAt: now(), gradedAt: null };
  dispatch({ type: 'sheet/record', sheet });
  return sheet;
}

/** Marking a printed sheet: one grade per line, all in one change. */
export const gradeSheet = (id: string, results: Array<{ id: ItemId; rating: Rating }>) =>
  dispatch({ type: 'sheet/grade', id, results, at: now() });

export const discardSheet = (id: string) => dispatch({ type: 'sheet/discard', id });

/* ------------------------------------------------------------------ texts */

export type NewText = Omit<GeneratedText, 'id' | 'createdAt' | 'read'>;

/**
 * A whole session's worth of texts at once, into a set made for them if it
 * does not exist yet. One change, so no screen ever shows half an import.
 */
export function addTexts(
  list: NewText[],
  target: { setId: string | null; name: string },
): { set: TextSet; texts: GeneratedText[] } {
  const at = now();
  const existing = target.setId ? getState().sets.find((s) => s.id === target.setId) : undefined;
  const set: TextSet = existing ?? {
    id: newId(),
    name: target.name.trim() || 'Writing session',
    createdAt: at,
  };
  const texts: GeneratedText[] = list.map((t, i) => ({
    ...t,
    setId: set.id,
    id: newId(),
    // A millisecond apart, so "newest first" keeps the order they were
    // written in rather than reversing it.
    createdAt: at + i,
    read: false,
  }));
  dispatch({ type: 'text/add', texts, newSet: existing ? null : set });
  return { set, texts };
}

export const deleteText = (id: string) => dispatch({ type: 'text/delete', id });

export const setTextRead = (id: string, read: boolean) => dispatch({ type: 'text/setRead', id, read });

/**
 * Another time through the same passage.
 *
 * Kept apart from `setTextRead`, which is a checkbox you can untick. This is an
 * event: it happened, and the count only goes up.
 */
export const markRead = (id: string) => dispatch({ type: 'text/markRead', id, at: now() });

export const renameSet = (id: string, name: string) => dispatch({ type: 'set/rename', id, name });

/** Removes a set and everything in it — the texts have nowhere else to live. */
export const deleteSet = (id: string) => dispatch({ type: 'set/delete', id });

/* ------------------------------------------------------------ the session */

export const startPlan = (plan: TextPlan) => dispatch({ type: 'plan/start', plan });

export function patchPlan(patch: Partial<TextPlan>) {
  const plan = getState().plan;
  if (plan) dispatch({ type: 'plan/patch', planId: plan.id, patch });
}

export function discardPlan() {
  const plan = getState().plan;
  if (plan) dispatch({ type: 'plan/discard', planId: plan.id });
}

/* --------------------------------------------------------------- settings */

export const setSettings = (patch: Partial<AppSettings>) => dispatch({ type: 'settings/patch', patch });

/* -------------------------------------------------------------- workspace */

/** Everything the account has saved, gone — from every device, as each next checks in. */
export const resetWorkspace = () => dispatch({ type: 'workspace/reset' });

/** Work from elsewhere becomes the whole of the account's workspace. For an account with nothing yet. */
export const replaceWorkspace = (incoming: AppState) =>
  dispatch({ type: 'workspace/replace', document: serialise(incoming) });

/** Work from elsewhere added to what the account already has, keeping both. */
export const mergeIntoWorkspace = (incoming: AppState) =>
  dispatch({ type: 'workspace/merge', document: serialise(incoming) });
