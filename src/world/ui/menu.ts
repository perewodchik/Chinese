/**
 * The menu's shape (prompt §10 P1): five tabs and ⚙, each tab with its
 * inner views, where an old panel id (`tasks`, `idioms` …) now lands, and
 * which views have news for a red dot. Pure, so tests pin it down.
 *
 * News is read from the save's own time stamps — a 成语's `at`, a stamp's
 * minute, a quest step's `at` — against `save.seen[view]`, the game minute
 * the view was last opened. Leads have no minute of their own, so each lead
 * seen gets a marker of its own (`lead:<quest>`).
 */

import { leads, type JournalContent } from '../core/journal';
import type { SaveAction } from '../core/save';
import type { WorldSave } from '../core/types';

export type MenuTab = 'journal' | 'bag' | 'map' | 'people' | 'collection';
export type JournalView = 'now' | 'story' | 'diary';
export type CollectionView = 'spirits' | 'idioms' | 'stamps' | 'album';

/**
 * Whatever can open the menu: a tab, ⚙, `menu` (the last tab and view this
 * device had open), or one of the old panel ids from before §10, which the
 * top bar, the keys and the minimap may still send.
 */
export type PanelId = MenuTab | 'settings' | 'menu' | 'tasks' | 'spirits' | 'idioms' | 'stamps' | 'friends' | 'diary' | 'album';

export interface MenuAt {
  tab: MenuTab | 'settings';
  /** the inner view, for the tabs that have them */
  view?: string;
}

/** `icon` is a frame of the menu atlas (`ui/<icon>`, drawn in scripts/world/art/gen/items.ts). */
export const MENU: readonly { id: MenuTab; icon: string; zh: string; en: string }[] = [
  { id: 'journal', icon: 'journal', zh: '日志', en: 'Journal' },
  { id: 'bag', icon: 'bag', zh: '包', en: 'Bag' },
  { id: 'map', icon: 'map', zh: '地图', en: 'Map' },
  { id: 'people', icon: 'people', zh: '朋友', en: 'People' },
  { id: 'collection', icon: 'collection', zh: '收藏', en: 'Collection' },
];

export const VIEWS: Partial<Record<MenuTab, readonly { id: string; label: string; title: string }[]>> = {
  journal: [
    { id: 'now', label: 'Now', title: 'What to do now, and where' },
    { id: 'story', label: 'Story', title: 'What happened, chapter by chapter' },
    { id: 'diary', label: '日记', title: 'The diary' },
  ],
  collection: [
    { id: 'spirits', label: '图鉴', title: 'The spirits' },
    { id: 'idioms', label: '成语', title: 'The 成语 book' },
    { id: 'stamps', label: '印章', title: 'The stamps passport' },
    { id: 'album', label: '相册', title: 'Photos' },
  ],
};

/** An old panel id → where it lives in the menu now. */
const OLD: Record<string, MenuAt> = {
  tasks: { tab: 'journal', view: 'now' },
  diary: { tab: 'journal', view: 'diary' },
  spirits: { tab: 'collection', view: 'spirits' },
  idioms: { tab: 'collection', view: 'idioms' },
  stamps: { tab: 'collection', view: 'stamps' },
  album: { tab: 'collection', view: 'album' },
  friends: { tab: 'people' },
};

/** What this device remembers of the menu: the last tab, and the view last open in each tab. */
export interface MenuMemory {
  tab: MenuTab;
  views: Partial<Record<MenuTab, string>>;
}

export const FIRST_MEMORY: MenuMemory = { tab: 'journal', views: {} };

const firstView = (tab: MenuTab) => VIEWS[tab]?.[0]?.id;
const isView = (tab: MenuTab, v: string | undefined) => !!v && !!VIEWS[tab]?.some((x) => x.id === v);

/** Where an id opens the menu: a tab on its last view, an old id on its own view, `menu` on the last tab. */
export function panelTarget(id: PanelId, mem: MenuMemory = FIRST_MEMORY): MenuAt {
  if (id === 'settings') return { tab: 'settings' };
  const old = OLD[id];
  if (old) return old;
  const tab: MenuTab = id === 'menu' ? mem.tab : (id as MenuTab);
  if (!VIEWS[tab]) return { tab };
  const last = mem.views[tab];
  return { tab, view: isView(tab, last) ? last : firstView(tab) };
}

/** The memory after opening `at` (⚙ is not remembered as a tab: the menu reopens where you were). */
export function remember(mem: MenuMemory, at: MenuAt): MenuMemory {
  if (at.tab === 'settings') return mem;
  if (mem.tab === at.tab && (!at.view || mem.views[at.tab] === at.view)) return mem;
  return { tab: at.tab, views: at.view ? { ...mem.views, [at.tab]: at.view } : mem.views };
}

const KEY = 'zouzou:menu';
export function readMemory(): MenuMemory {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as MenuMemory | null;
    if (v && MENU.some((m) => m.id === v.tab) && typeof v.views === 'object' && v.views) return v;
  } catch {
    /* a private window, or junk: start from the journal */
  }
  return FIRST_MEMORY;
}
export function writeMemory(m: MenuMemory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* it just forgets */
  }
}

/** `journal/now`, `collection/idioms`, `people` … — the key a view's `seen` marker is kept under. */
export const viewKey = (at: MenuAt) => (at.view ? `${at.tab}/${at.view}` : at.tab);

const newest = (xs: Iterable<number>) => Math.max(-1, ...xs);
const seenAt = (s: WorldSave, key: string) => s.seen?.[key] ?? -1;

/** The latest game minute anything in a quest's log happened (J1's `at` stamps). */
export const questNewest = (s: WorldSave) => newest(Object.values(s.quests).flatMap((q) => Object.values(q.at ?? {})));

/**
 * The views with news (a red dot): a new spirit, 成语 or stamp, a riddle
 * pinned, a quest step that moved, a lead not yet looked at. `leads` are the
 * quest ids the journal shows as leads now.
 */
export function menuNews(s: WorldSave, leads: readonly string[] = []): Set<string> {
  const out = new Set<string>();
  const add = (key: string, t: number) => t > seenAt(s, key) && out.add(key);
  add('collection/spirits', newest(Object.values(s.spirits)));
  add('collection/idioms', newest(Object.values(s.idioms).map((x) => x.at)));
  add('collection/stamps', newest(Object.values(s.stamps)));
  const journal = Math.max(newest(Object.values(s.riddles).map((r) => r.pinnedAt)), questNewest(s));
  add('journal/now', journal);
  if (leads.some((l) => !(s.seen?.[`lead:${l}`] ?? 0))) out.add('journal/now');
  return out;
}

/** Whether a tab (or ⚙) has news in any of its views. */
export const tabHasNews = (news: ReadonlySet<string>, tab: MenuTab) => [...news].some((k) => k === tab || k.startsWith(`${tab}/`));

/** What opening a view with news writes to the save: its minute, and each lead now seen. */
export function markSeen(s: WorldSave, at: MenuAt, leads: readonly string[] = []): SaveAction[] {
  const key = viewKey(at);
  const out: SaveAction[] = [{ do: 'seen', key, at: Math.floor(s.clock) }];
  if (key === 'journal/now') for (const l of leads) if (!(s.seen?.[`lead:${l}`] ?? 0)) out.push({ do: 'seen', key: `lead:${l}`, at: 1 });
  return out;
}

/** 1–5 on the keyboard: the tabs in order. */
export const tabForKey = (key: string): MenuTab | null => MENU[Number(key) - 1]?.id ?? null;

/** The news with the journal's leads (§10 J2) counted in. */
export const menuNewsFor = (s: WorldSave, content: JournalContent) => menuNews(s, leads(s, content).map((l) => l.quest.id));
