import { useSyncExternalStore } from 'react';
import {
  DEFAULT_CHAR_OPTIONS,
  DEFAULT_RADICAL_OPTIONS,
  DEFAULT_SETTINGS,
  type AppSettings,
  type ItemId,
  type ItemKind,
  type PersistedState,
  type SheetOptions,
  type Template,
} from './types';

const KEY = 'hanzi-workshop/v1';

interface State {
  templates: Template[];
  learned: Set<ItemId>;
  settings: AppSettings;
}

function emptyState(): State {
  return {
    templates: [],
    learned: new Set(),
    settings: { ...DEFAULT_SETTINGS },
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as PersistedState;
    return {
      // Backups written before print tracking was removed still carry
      // printedAt / printCount on each template; they are simply ignored.
      templates: p.templates ?? [],
      learned: new Set(p.learned ?? []),
      settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
    };
  } catch {
    // A corrupt or half-written entry must not brick the app.
    return emptyState();
  }
}

function serialise(s: State): PersistedState {
  return {
    version: 1,
    templates: s.templates,
    learned: [...s.learned],
    settings: s.settings,
  };
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(serialise(next)));
  } catch {
    // Out of quota or storage disabled - keep running with in-memory state.
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => state;

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(snapshot()),
    () => select(snapshot()),
  );
}

export const getState = () => state;

const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const touch = (t: Template): Template => ({ ...t, updatedAt: Date.now() });

// ---------------------------------------------------------------- templates

export function createTemplate(
  name: string,
  kind: ItemKind,
  items: ItemId[] = [],
  options?: Partial<SheetOptions>,
): Template {
  const base = kind === 'char' ? DEFAULT_CHAR_OPTIONS : DEFAULT_RADICAL_OPTIONS;
  const t: Template = {
    id: uid(),
    name: name.trim() || 'Untitled',
    kind,
    items: [...new Set(items)],
    options: { ...base, ...options },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  commit({ ...state, templates: [...state.templates, t] });
  return t;
}

export function updateTemplate(id: string, patch: Partial<Template>) {
  commit({
    ...state,
    templates: state.templates.map((t) =>
      t.id === id ? touch({ ...t, ...patch }) : t,
    ),
  });
}

export function setTemplateOptions(id: string, patch: Partial<SheetOptions>) {
  commit({
    ...state,
    templates: state.templates.map((t) =>
      t.id === id ? touch({ ...t, options: { ...t.options, ...patch } }) : t,
    ),
  });
}

export function deleteTemplate(id: string) {
  commit({ ...state, templates: state.templates.filter((t) => t.id !== id) });
}

/** Removes every template that came from one ready-made set. */
export function deleteCollection(name: string) {
  commit({
    ...state,
    templates: state.templates.filter((t) => t.collection !== name),
  });
}

export function duplicateTemplate(id: string) {
  const src = state.templates.find((t) => t.id === id);
  if (!src) return;
  const copy: Template = {
    ...src,
    id: uid(),
    name: `${src.name} (copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  commit({ ...state, templates: [...state.templates, copy] });
}

/** Adds items, keeping template order and ignoring anything already present. */
export function addToTemplate(id: string, ids: ItemId[]) {
  commit({
    ...state,
    templates: state.templates.map((t) => {
      if (t.id !== id) return t;
      const have = new Set(t.items);
      return touch({ ...t, items: [...t.items, ...ids.filter((i) => !have.has(i))] });
    }),
  });
}

export function removeFromTemplate(id: string, ids: ItemId[]) {
  const drop = new Set(ids);
  commit({
    ...state,
    templates: state.templates.map((t) =>
      t.id === id ? touch({ ...t, items: t.items.filter((i) => !drop.has(i)) }) : t,
    ),
  });
}

export function reorderTemplate(id: string, items: ItemId[]) {
  updateTemplate(id, { items });
}

/**
 * Splits a run of items into evenly sized, numbered templates -
 * "HSK 1 — Part 1", "HSK 1 — Part 2", and so on. A run that already fits in
 * one template keeps its plain name; "Food & drink — Part 1 of 1" would be
 * silly.
 */
export function createSeries(
  baseName: string,
  kind: ItemKind,
  items: ItemId[],
  perTemplate: number,
  options?: Partial<SheetOptions>,
  collection?: string,
): Template[] {
  const base = kind === 'char' ? DEFAULT_CHAR_OPTIONS : DEFAULT_RADICAL_OPTIONS;
  const made: Template[] = [];
  const now = Date.now();
  const single = items.length <= perTemplate;
  for (let i = 0; i < items.length; i += perTemplate) {
    const part = Math.floor(i / perTemplate) + 1;
    made.push({
      id: uid() + part,
      name: single ? baseName : `${baseName} — Part ${part}`,
      kind,
      items: items.slice(i, i + perTemplate),
      options: { ...base, ...options },
      createdAt: now,
      updatedAt: now,
      collection,
    });
  }
  commit({ ...state, templates: [...state.templates, ...made] });
  return made;
}

// ----------------------------------------------------------------- progress

export function toggleLearned(id: ItemId) {
  const next = new Set(state.learned);
  next.has(id) ? next.delete(id) : next.add(id);
  commit({ ...state, learned: next });
}

export function setLearned(ids: ItemId[], value: boolean) {
  const next = new Set(state.learned);
  ids.forEach((i) => (value ? next.add(i) : next.delete(i)));
  commit({ ...state, learned: next });
}


// ----------------------------------------------------------------- settings

export function setSettings(patch: Partial<AppSettings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}

// ------------------------------------------------------------ export/import

export function exportJSON(): string {
  return JSON.stringify(serialise(state), null, 2);
}

export function importJSON(text: string): { ok: true } | { ok: false; error: string } {
  let p: PersistedState;
  try {
    p = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!p || typeof p !== 'object' || !Array.isArray(p.templates)) {
    return { ok: false, error: 'That does not look like a Hanzi Workshop backup.' };
  }
  commit({
    templates: p.templates,
    learned: new Set(p.learned ?? []),
    settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
  });
  return { ok: true };
}

export function resetAll() {
  commit(emptyState());
}

// ------------------------------------------------------------------ derived

export interface ItemStatus {
  inTemplates: Template[];
  learned: boolean;
}

/**
 * Which templates hold each item, so the library can grey out what is already
 * placed and you never queue the same character twice.
 */
export function buildIndex(templates: Template[]) {
  const map = new Map<ItemId, Template[]>();
  for (const t of templates) {
    for (const i of t.items) {
      const list = map.get(i);
      if (list) list.push(t);
      else map.set(i, [t]);
    }
  }
  return map;
}

export function statusOf(
  id: ItemId,
  index: Map<ItemId, Template[]>,
  learned: Set<ItemId>,
): ItemStatus {
  return { inTemplates: index.get(id) ?? [], learned: learned.has(id) };
}
