import { dayKey, logDay, type DayLog } from '../domain/activity';
import type { Collection, CollectionWord, PrintScope } from '../domain/collection';
import type { ItemId } from '../domain/ids';
import {
  grade,
  isLearned,
  learnedFrom,
  reclaimed,
  unclaimed,
  type PrintedSheet,
  type Rating,
  type RecallBook,
  type Skill,
} from '../domain/memory';
import type { SheetOptions } from '../domain/sheet';
import type { GeneratedText, TextPlan, TextSet } from '../domain/text';
import {
  mergeVideo,
  type DictationCheck,
  type Video,
  type VideoAsk,
  type VideoLine,
  type VideoMarks,
  type VideoPack,
  type VideoPart,
  type VideoStatus,
} from '../domain/video';
import type { WordListPlan } from '../domain/wordlist';
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
  words?: CollectionWord[];
}

/** What can be changed about a video by setting it. */
export interface VideoPatch {
  title?: string;
  status?: VideoStatus;
  marks?: Partial<VideoMarks>;
  parts?: VideoPart[];
  skipped?: string[];
}

export interface GradeResult {
  id: ItemId;
  skill: Skill;
  rating: Rating;
  /** how much a success proves, below 1 for a pick out of several; see `grade` */
  weight?: number;
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
  /** texts gathered into one set, made for them if `set` is new; sets left empty go */
  | { type: 'texts/collect'; textIds: string[]; set: TextSet }
  | { type: 'set/reorder'; id: string; order: string[] }
  | { type: 'plan/start'; plan: TextPlan }
  | { type: 'plan/patch'; planId: string; patch: Partial<TextPlan> }
  | { type: 'plan/discard'; planId: string }
  | { type: 'listPlan/start'; plan: WordListPlan }
  | { type: 'listPlan/patch'; planId: string; patch: Partial<WordListPlan> }
  | { type: 'listPlan/discard'; planId: string }
  | { type: 'settings/patch'; patch: Partial<AppSettings> }
  /** something done that no other action records — a word said out loud, say */
  | { type: 'activity/log'; at: number; add: Partial<DayLog> }
  /** a video onto the shelf; one already there takes whatever the new copy has more of */
  | { type: 'video/add'; video: Video }
  | { type: 'video/patch'; id: string; patch: VideoPatch; at: number }
  /** one line's text changed by hand or by Claude: `index` is its place in the whole video */
  | { type: 'video/line'; id: string; index: number; line: Partial<VideoLine>; at: number }
  /** Claude's study pack for a part; its pinyin and English go onto the part's lines */
  | { type: 'video/pack'; id: string; part: number; pack: VideoPack; at: number }
  | { type: 'video/check'; id: string; check: DictationCheck }
  | { type: 'video/ask'; id: string; ask: VideoAsk }
  /** a part played through, or "watched" ticked */
  | { type: 'video/watch'; id: string; at: number }
  | { type: 'video/delete'; id: string }
  | { type: 'workspace/reset' }
  | { type: 'workspace/replace'; document: PersistedState }
  | { type: 'workspace/merge'; document: PersistedState }
  | RadicalAction;

/** A batch of answers as a day's tally: how many, and how many were not "again". */
const answered = (results: Array<{ rating: Rating }>): Partial<DayLog> => ({
  answers: results.length,
  right: results.filter((r) => r.rating !== 'again').length,
});

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
      const { name, note, sheet, scope, words } = action.patch;
      return updateCollection(state, action.id, action.at, (c) => ({
        ...c,
        name: name ?? c.name,
        note: note ?? c.note,
        words: words ?? c.words,
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
      for (const { id, skill, rating, weight } of action.results) {
        const book = recall[id];
        recall[id] = { ...book, [skill]: grade(book?.[skill], rating, action.at, skill, weight) };
      }
      return {
        ...withRecall(state, recall),
        activity: logDay(state.activity, action.at, answered(action.results)),
      };
    }

    case 'recall/setLearned': {
      if (!action.ids.length) return state;
      const recall: RecallBook = { ...state.recall };
      action.ids.forEach((id, i) => {
        const had = recall[id]?.recognise;
        if (action.value) {
          if (isLearned(recall[id])) return;
          // A few days apart, so marking thirty at the end of a text does not
          // produce thirty questions on one morning next week. Marking again
          // something already met keeps its history and the date it was first
          // marked: the claim is being renewed, not made for the first time.
          recall[id] = { ...recall[id], recognise: reclaimed(had, action.at, 7 + (i % 10)) };
        } else if (had) {
          // Only the claim is taken back. Answers actually given stay, and
          // the item falls due instead of vanishing from the schedule.
          const left = unclaimed(had, action.at);
          const { recognise: _claim, ...rest } = recall[id];
          if (left) recall[id] = { ...rest, recognise: left };
          else if (Object.keys(rest).length) recall[id] = rest;
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
        activity: logDay(state.activity, action.at, answered(action.results)),
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
        activity: state.texts.some((t) => t.id === action.id)
          ? logDay(state.activity, action.at, { read: 1 })
          : state.activity,
      };

    case 'activity/log':
      return { ...state, activity: logDay(state.activity, action.at, action.add) };

    /* --------------------------------------------------------------- videos */
    case 'video/add': {
      const had = state.videos.find((v) => v.id === action.video.id);
      if (!had) return { ...state, videos: [action.video, ...state.videos] };
      // The same video added again — from another device, or once its
      // captions could be fetched: keep the work, take the text if it is new.
      if (had.lines.length || !action.video.lines.length) return state;
      const filled: Video = {
        ...mergeVideo(had, action.video),
        lines: action.video.lines,
        parts: action.video.parts,
        textFrom: action.video.textFrom,
        title: action.video.title,
        channel: action.video.channel,
        seconds: action.video.seconds,
        description: action.video.description,
        status: had.status,
      };
      return { ...state, videos: state.videos.map((v) => (v.id === had.id ? filled : v)) };
    }

    case 'video/patch':
      return updateVideo(state, action.id, action.at, (v) => ({
        ...v,
        title: action.patch.title ?? v.title,
        status: action.patch.status ?? (action.patch.marks ? started(v.status) : v.status),
        marks: action.patch.marks ? { ...v.marks, ...action.patch.marks } : v.marks,
        parts: action.patch.parts ?? v.parts,
        skipped: action.patch.skipped ?? v.skipped,
      }));

    case 'video/line':
      return updateVideo(state, action.id, action.at, (v) =>
        v.lines[action.index]
          ? { ...v, lines: v.lines.map((l, i) => (i === action.index ? { ...l, ...action.line } : l)) }
          : v,
      );

    case 'video/pack':
      return updateVideo(state, action.id, action.at, (v) => {
        const part = v.parts[action.part];
        if (!part) return v;
        const lines = v.lines.map((l, i) => {
          const fix = i >= part.from && i < part.to ? action.pack.lines[i - part.from + 1] : undefined;
          if (!fix) return l;
          const next = { ...l };
          if (fix.py) next.py = fix.py;
          // Claude's English over the caption's: channels' translations are often word for word, or wrong.
          if (fix.en) next.en = fix.en;
          if (fix.who) next.who = fix.who;
          if (fix.doubt) next.doubt = fix.doubt;
          return next;
        });
        return { ...v, lines, packs: { ...v.packs, [action.part]: action.pack } };
      });

    // A check marked again straight after (a mis-tap put right) keeps its id
    // and replaces itself rather than counting twice.
    case 'video/check':
      return updateVideo(state, action.id, action.check.at, (v) => ({
        ...v,
        checks: v.checks.some((c) => c.id === action.check.id)
          ? v.checks.map((c) => (c.id === action.check.id ? action.check : c))
          : [...v.checks, action.check],
        marks: { ...v.marks, written: true },
        status: started(v.status),
      }));

    case 'video/ask':
      return updateVideo(state, action.id, action.ask.at, (v) =>
        v.asks.some((a) => a.id === action.ask.id) ? v : { ...v, asks: [...v.asks, action.ask] },
      );

    case 'video/watch':
      return updateVideo(state, action.id, action.at, (v) => ({
        ...v,
        marks: { ...v.marks, watched: v.marks.watched + 1 },
        status: started(v.status),
      }));

    case 'video/delete':
      return state.videos.some((v) => v.id === action.id)
        ? { ...state, videos: state.videos.filter((v) => v.id !== action.id) }
        : state;

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

    case 'texts/collect': {
      const moving = new Set(action.textIds.filter((id) => state.texts.some((t) => t.id === id)));
      if (!moving.size) return state;
      const target = action.set;
      const emptied = new Set(
        state.texts.filter((t) => moving.has(t.id) && t.setId && t.setId !== target.id).map((t) => t.setId!),
      );
      const texts = state.texts.map((t) => (moving.has(t.id) ? { ...t, setId: target.id } : t));
      // A set the move took everything out of has nothing left to be.
      for (const t of texts) if (t.setId) emptied.delete(t.setId);
      const exists = state.sets.some((s) => s.id === target.id);
      const sets = (exists
        ? state.sets.map((s) => (s.id === target.id ? { ...s, order: target.order } : s))
        : [target, ...state.sets]
      ).filter((s) => !emptied.has(s.id));
      return { ...state, texts, sets };
    }

    case 'set/reorder':
      return {
        ...state,
        sets: state.sets.map((s) => (s.id === action.id ? { ...s, order: action.order } : s)),
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

    /* ------------------------------------------------------- the word list */
    case 'listPlan/start':
      return { ...state, listPlan: action.plan };

    case 'listPlan/patch':
      return state.listPlan && state.listPlan.id === action.planId
        ? { ...state, listPlan: { ...state.listPlan, ...action.patch } }
        : state;

    case 'listPlan/discard':
      return state.listPlan && state.listPlan.id === action.planId ? { ...state, listPlan: null } : state;

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
    case 'listPlan/patch':
      return last.type === 'listPlan/patch' && last.planId === next.planId
        ? { ...next, patch: { ...last.patch, ...next.patch } }
        : null;
    case 'settings/patch':
      return last.type === 'settings/patch' ? { ...next, patch: { ...last.patch, ...next.patch } } : null;
    case 'activity/log': {
      // A run of tries on the same day is one change with the counts added.
      if (last.type !== 'activity/log' || dayKey(last.at) !== dayKey(next.at)) return null;
      const add: Partial<DayLog> = { ...last.add };
      for (const [k, v] of Object.entries(next.add) as Array<[keyof DayLog, number]>) add[k] = (add[k] ?? 0) + v;
      return { ...next, add };
    }
    case 'collection/update':
      return last.type === 'collection/update' && last.id === next.id
        ? { ...next, patch: mergePatch(last.patch, next.patch) }
        : null;
    case 'collection/reorder':
      return last.type === 'collection/reorder' && last.id === next.id ? next : null;
    case 'text/setRead':
      return last.type === 'text/setRead' && last.id === next.id ? next : null;
    case 'video/patch':
      return last.type === 'video/patch' && last.id === next.id
        ? {
            ...next,
            patch: {
              ...last.patch,
              ...next.patch,
              marks: last.patch.marks || next.patch.marks ? { ...last.patch.marks, ...next.patch.marks } : undefined,
            },
          }
        : null;
    case 'set/rename':
      return last.type === 'set/rename' && last.id === next.id ? next : null;
    case 'set/reorder':
      return last.type === 'set/reorder' && last.id === next.id ? next : null;
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

/** A video anything has been done with is being worked on — unless it is already done or put aside. */
const started = (status: VideoStatus): VideoStatus => (status === 'want' ? 'working' : status);

/** Applies `change` to one video, marking it updated only if something changed. */
function updateVideo(state: AppState, id: string, at: number, change: (v: Video) => Video): AppState {
  let changed = false;
  const videos = state.videos.map((v) => {
    if (v.id !== id) return v;
    const next = change(v);
    if (next === v) return v;
    changed = true;
    return { ...next, updatedAt: Math.max(v.updatedAt, at) };
  });
  return changed ? { ...state, videos } : state;
}

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
