import type { Collection, PrintScope } from '../domain/collection';
import type { ItemId } from '../domain/ids';
import {
  asserted,
  grade,
  isLearned,
  learnedFrom,
  type PrintedSheet,
  type Rating,
  type RecallBook,
  type Skill,
} from '../domain/memory';
import type { SheetOptions } from '../domain/sheet';
import type { GeneratedText, TextPlan, TextSet } from '../domain/text';
import { appendNew, reorderKeeping } from './lists';
import { mergeStates } from './merge';
import { hydrate } from './migrations';
import { coalesceRadicals, isRadicalAction, reduceRadicals, type RadicalAction } from './radicalActions';
import { emptyState, type AppSettings, type AppState, type PersistedState } from './state';

/**
 * Every change the app can make to what an account has saved, as data.
 *
 * Written as descriptions of changes rather than as functions that make them,
 * for one reason: a change made on the iPad while the PC was saving something
 * else has to be replayable on top of what the PC saved. So an action carries
 * everything it needs — the ids, the moment it happened — and `reduce` is a
 * pure function of (state, action). Replaying queued actions onto newer state
 * is how two devices' work ends up in one place instead of one overwriting the
 * other; see `sync/engine.ts`.
 *
 * The reducer is written to be replayed: an action about something that has
 * since gone does nothing, and adding what is already there adds nothing.
 */

export interface CollectionPatch {
  name?: string;
  note?: string;
  sheet?: Partial<SheetOptions>;
  scope?: Partial<PrintScope>;
}

export interface GradeResult {
  id: ItemId;
  skill: Skill;
  rating: Rating;
}

export type Action =
  | { type: 'collection/create'; collection: Collection }
  | { type: 'collection/update'; id: string; patch: CollectionPatch; at: number }
  | { type: 'collection/delete'; id: string }
  | { type: 'collection/duplicate'; id: string; copyId: string; at: number }
  | { type: 'collection/addItems'; id: string; items: ItemId[]; at: number }
  | { type: 'collection/removeItems'; id: string; items: ItemId[]; at: number }
  | { type: 'collection/reorder'; id: string; items: ItemId[]; at: number }
  | { type: 'recall/grade'; results: GradeResult[]; at: number }
  | { type: 'recall/setLearned'; ids: ItemId[]; value: boolean; at: number }
  | { type: 'sheet/record'; sheet: PrintedSheet }
  | { type: 'sheet/grade'; id: string; results: Array<{ id: ItemId; rating: Rating }>; at: number }
  | { type: 'sheet/discard'; id: string }
  | { type: 'text/add'; texts: GeneratedText[]; newSet: TextSet | null }
  | { type: 'text/delete'; id: string }
  | { type: 'text/setRead'; id: string; read: boolean }
  | { type: 'text/markRead'; id: string; at: number }
  | { type: 'set/rename'; id: string; name: string }
  | { type: 'set/delete'; id: string }
  | { type: 'plan/start'; plan: TextPlan }
  | { type: 'plan/patch'; planId: string; patch: Partial<TextPlan> }
  | { type: 'plan/discard'; planId: string }
  | { type: 'settings/patch'; patch: Partial<AppSettings> }
  | { type: 'workspace/reset' }
  | { type: 'workspace/replace'; document: PersistedState }
  | { type: 'workspace/merge'; document: PersistedState }
  | RadicalAction;

export function reduce(state: AppState, action: Action): AppState {
  if (isRadicalAction(action)) {
    const radicals = reduceRadicals(state.radicals, action);
    return radicals === state.radicals ? state : { ...state, radicals };
  }

  switch (action.type) {
    /* ---------------------------------------------------------- collections */
    case 'collection/create':
      return state.collections.some((c) => c.id === action.collection.id)
        ? state
        : { ...state, collections: [...state.collections, action.collection] };

    case 'collection/update': {
      const { name, note, sheet, scope } = action.patch;
      return updateCollection(state, action.id, action.at, (c) => ({
        ...c,
        name: name ?? c.name,
        note: note ?? c.note,
        sheet: sheet ? { ...c.sheet, ...sheet } : c.sheet,
        scope: scope ? { ...c.scope, ...scope } : c.scope,
      }));
    }

    case 'collection/delete':
      return state.collections.some((c) => c.id === action.id)
        ? { ...state, collections: state.collections.filter((c) => c.id !== action.id) }
        : state;

    case 'collection/duplicate': {
      const source = state.collections.find((c) => c.id === action.id);
      if (!source || state.collections.some((c) => c.id === action.copyId)) return state;
      const copy: Collection = {
        ...source,
        id: action.copyId,
        name: `${source.name} (copy)`,
        createdAt: action.at,
        updatedAt: action.at,
      };
      return { ...state, collections: [...state.collections, copy] };
    }

    case 'collection/addItems':
      return updateCollection(state, action.id, action.at, (c) => {
        const items = appendNew(c.items, action.items);
        return items === c.items ? c : { ...c, items };
      });

    case 'collection/removeItems': {
      const drop = new Set(action.items);
      return updateCollection(state, action.id, action.at, (c) =>
        c.items.some((i) => drop.has(i)) ? { ...c, items: c.items.filter((i) => !drop.has(i)) } : c,
      );
    }

    case 'collection/reorder':
      return updateCollection(state, action.id, action.at, (c) => ({
        ...c,
        items: reorderKeeping(c.items, action.items),
      }));

    /* --------------------------------------------------------------- memory */
    case 'recall/grade': {
      if (!action.results.length) return state;
      const recall: RecallBook = { ...state.recall };
      for (const { id, skill, rating } of action.results) {
        const book = recall[id];
        recall[id] = { ...book, [skill]: grade(book?.[skill], rating, action.at, skill) };
      }
      return withRecall(state, recall);
    }

    case 'recall/setLearned': {
      if (!action.ids.length) return state;
      const recall: RecallBook = { ...state.recall };
      action.ids.forEach((id, i) => {
        if (action.value) {
          if (isLearned(recall[id])) return;
          // A few days apart, so marking thirty at the end of a text does not
          // produce thirty questions on one morning next week.
          recall[id] = { ...recall[id], recognise: asserted(action.at, 7 + (i % 10)) };
        } else if (recall[id]?.recognise) {
          const { recognise: _claim, ...rest } = recall[id];
          if (Object.keys(rest).length) recall[id] = rest;
          else delete recall[id];
        }
      });
      return withRecall(state, recall);
    }

    /* ---------------------------------------------------------- paper tests */
    case 'sheet/record':
      return state.sheets.some((s) => s.id === action.sheet.id)
        ? state
        : { ...state, sheets: [action.sheet, ...state.sheets] };

    case 'sheet/grade': {
      // Marked already, somewhere else: the same marks twice would count every line double.
      if (state.sheets.some((s) => s.id === action.id && s.gradedAt !== null)) return state;
      const recall: RecallBook = { ...state.recall };
      for (const { id, rating } of action.results) {
        const book = recall[id];
        recall[id] = { ...book, write: grade(book?.write, rating, action.at, 'write') };
      }
      return {
        ...withRecall(state, recall),
        sheets: state.sheets.map((s) => (s.id === action.id ? { ...s, gradedAt: action.at } : s)),
      };
    }

    case 'sheet/discard':
      return { ...state, sheets: state.sheets.filter((s) => s.id !== action.id) };

    /* ---------------------------------------------------------------- texts */
    case 'text/add': {
      const known = new Set(state.texts.map((t) => t.id));
      const fresh = action.texts.filter((t) => !known.has(t.id));
      const { newSet } = action;
      const addSet = newSet !== null && !state.sets.some((s) => s.id === newSet.id);
      if (!fresh.length && !addSet) return state;
      return {
        ...state,
        sets: addSet ? [newSet, ...state.sets] : state.sets,
        // Newest first on the shelf, which puts the batch back in writing order when read the other way.
        texts: [...fresh].reverse().concat(state.texts),
      };
    }

    case 'text/delete':
      return { ...state, texts: state.texts.filter((t) => t.id !== action.id) };

    case 'text/setRead':
      return {
        ...state,
        texts: state.texts.map((t) => (t.id === action.id ? { ...t, read: action.read } : t)),
      };

    case 'text/markRead':
      return {
        ...state,
        texts: state.texts.map((t) =>
          t.id === action.id
            ? { ...t, read: true, reads: (t.reads ?? 0) + 1, lastReadAt: action.at }
            : t,
        ),
      };

    case 'set/rename':
      return {
        ...state,
        sets: state.sets.map((s) => (s.id === action.id ? { ...s, name: action.name } : s)),
      };

    case 'set/delete':
      return {
        ...state,
        sets: state.sets.filter((s) => s.id !== action.id),
        texts: state.texts.filter((t) => t.setId !== action.id),
      };

    /* ---------------------------------------------------------- the session */
    case 'plan/start':
      return { ...state, plan: action.plan };

    // Both name the plan they were meant for, so an edit made to a session on
    // one device is not applied to a different session started on another.
    case 'plan/patch':
      return state.plan && state.plan.id === action.planId
        ? { ...state, plan: { ...state.plan, ...action.patch } }
        : state;

    case 'plan/discard':
      return state.plan && state.plan.id === action.planId ? { ...state, plan: null } : state;

    /* ------------------------------------------------------------- the rest */
    case 'settings/patch':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'workspace/reset':
      return emptyState();

    case 'workspace/replace':
      return hydrate(action.document);

    case 'workspace/merge':
      return mergeStates(state, hydrate(action.document));
  }
}

/**
 * One action that does what `last` followed by `next` would, or null when the
 * two have to stay separate.
 *
 * Typing into a field is a keystroke's worth of actions, and none of them is
 * worth sending or storing on its own. Only actions that set values are
 * folded; anything that adds, removes or counts stays as it happened.
 */
export function coalesce(last: Action, next: Action): Action | null {
  if (isRadicalAction(next)) return isRadicalAction(last) ? coalesceRadicals(last, next) : null;

  switch (next.type) {
    case 'plan/patch':
      return last.type === 'plan/patch' && last.planId === next.planId
        ? { ...next, patch: { ...last.patch, ...next.patch } }
        : null;
    case 'settings/patch':
      return last.type === 'settings/patch' ? { ...next, patch: { ...last.patch, ...next.patch } } : null;
    case 'collection/update':
      return last.type === 'collection/update' && last.id === next.id
        ? { ...next, patch: mergePatch(last.patch, next.patch) }
        : null;
    case 'collection/reorder':
      return last.type === 'collection/reorder' && last.id === next.id ? next : null;
    case 'text/setRead':
      return last.type === 'text/setRead' && last.id === next.id ? next : null;
    case 'set/rename':
      return last.type === 'set/rename' && last.id === next.id ? next : null;
    default:
      return null;
  }
}

const mergePatch = (a: CollectionPatch, b: CollectionPatch): CollectionPatch => ({
  ...a,
  ...b,
  sheet: a.sheet || b.sheet ? { ...a.sheet, ...b.sheet } : undefined,
  scope: a.scope || b.scope ? { ...a.scope, ...b.scope } : undefined,
});

/**
 * `learned` is derived from the memory, and derived here, once per change that
 * could move it — not in a selector, which would build a new Set on every
 * render and re-render every card in the library with it.
 */
const withRecall = (state: AppState, recall: RecallBook): AppState => ({
  ...state,
  recall,
  learned: learnedFrom(recall),
});

/** Applies `change` to one collection, marking it updated only if something changed. */
function updateCollection(
  state: AppState,
  id: string,
  at: number,
  change: (c: Collection) => Collection,
): AppState {
  let changed = false;
  const collections = state.collections.map((c) => {
    if (c.id !== id) return c;
    const next = change(c);
    if (next === c) return c;
    changed = true;
    return { ...next, updatedAt: at };
  });
  return changed ? { ...state, collections } : state;
}
