/**
 * What the panels (E5) list, as plain functions of the save and the content:
 * tasks and pinned riddles, the bag, the map's route hints, the 图鉴, the 成语
 * book and the stamps passport.
 */

import { DISTRICTS, districtInfo, type DistrictInfo } from '../core/districts';
import { activeQuests } from '../core/quests';
import { dislikedNote, likedNote } from '../core/gifts';
import type { Shop } from '../core/shop';
import { findRoute, routeText, station } from '../core/travel';
import type { Idiom, Item, NpcCard, Quest, Scene, Spirit, Stamp, WorldSave } from '../core/types';
import { withName } from '../core/voice';

/** where the menu opens (§10 P1): the tabs, ⚙, and the old panel ids — see `menu.ts` */
export type { PanelId } from './menu';

export interface TaskRow {
  quest: Quest;
  now: string;
  done: boolean;
}

/** Quests under way first (most important first), then the finished ones. */
export function taskRows(s: WorldSave, quests: readonly Quest[]): TaskRow[] {
  const going = activeQuests(s, quests).map((a) => ({ quest: a.quest, now: a.step.now, done: false }));
  const done = quests.filter((q) => s.quests[q.id]?.done).map((q) => ({ quest: q, now: '', done: true }));
  return [...going, ...done];
}

export interface RiddleRow {
  id: string;
  zh: string;
  en: string;
  solved: boolean;
  /** who said it */
  npc?: string;
}

/** The 📌 key lines pinned so far, unsolved first, newest first. */
export function riddleRows(s: WorldSave, scenes: readonly Scene[]): RiddleRow[] {
  const byId = new Map(scenes.map((x) => [x.id, x]));
  return Object.entries(s.riddles)
    .map(([id, r]) => {
      const node = byId.get(r.scene)?.nodes.find((n) => n.id === r.node);
      return { id, zh: withName(node?.say ?? '', s.name), en: withName(node?.translate ?? '', s.name), solved: r.solved, npc: byId.get(r.scene)?.npc, at: r.pinnedAt };
    })
    .filter((r) => r.zh)
    .sort((a, b) => Number(a.solved) - Number(b.solved) || b.at - a.at)
    .map(({ at: _at, ...r }) => r);
}

export interface BagRow {
  id: string;
  name: string;
  en: string;
  count: number;
}

export function bagRows(s: WorldSave, items: readonly Item[]): BagRow[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return Object.entries(s.bag.items)
    .filter(([, n]) => n > 0)
    .map(([id, count]) => ({ id, name: byId.get(id)?.name ?? id, en: byId.get(id)?.en ?? '', count }));
}

/** The bag's filter line (Y5): one fixed row that fits 375 px. */
export type BagFilter = 'all' | 'food' | 'gift' | 'tool' | 'decor' | 'key';

export const BAG_FILTERS: readonly { id: BagFilter; label: string; title: string }[] = [
  { id: 'all', label: '全部', title: 'everything' },
  { id: 'food', label: '食物', title: 'food and drink' },
  { id: 'gift', label: '礼物', title: 'presents and toys' },
  { id: 'tool', label: '工具', title: 'tools' },
  { id: 'decor', label: '装饰', title: 'decorations' },
  { id: 'key', label: '重要', title: 'story things' },
];

/** Which filter a thing falls under: drinks with food, toys with presents, an unknown kind with tools. */
export function filterOf(item: Item | undefined): Exclude<BagFilter, 'all'> {
  switch (item?.kind) {
    case 'food':
    case 'drink':
      return 'food';
    case 'gift':
    case 'toy':
      return 'gift';
    case 'decor':
      return 'decor';
    case 'key':
      return 'key';
    default:
      return 'tool';
  }
}

export interface ItemFacts {
  /** where it is sold, and for how much */
  sold: { shop: string; price: number; measure: string }[];
  /** what it is worth to the recycler's eye (its base price) */
  worth?: number;
  /** people who were glad of it as a present, and people who were not */
  liked: string[];
  disliked: string[];
}

/** What the bag's card says about a thing (Y5), learned from the shops and from your presents. */
export function itemFacts(item: Item, s: WorldSave, shops: readonly Shop[], npcs: readonly NpcCard[]): ItemFacts {
  const sold = shops.flatMap((sh) => sh.stock.filter((x) => x.item === item.id).map((x) => ({ shop: sh.name, price: x.price, measure: x.measure ?? '个' })));
  const name = (id: string) => npcs.find((n) => n.id === id)?.name ?? id;
  const who = (note: string) =>
    Object.entries(s.npcs)
      .filter(([, m]) => m.notes.includes(note))
      .map(([id]) => name(id));
  return { sold, ...(item.price !== undefined ? { worth: item.price } : {}), liked: who(likedNote(item)), disliked: who(dislikedNote(item)) };
}

export type MapHint =
  | { kind: 'here' }
  | { kind: 'walk'; text: string }
  | { kind: 'no-card'; text: string }
  | { kind: 'route'; text: string; from: string; fare: number }
  | { kind: 'far'; text: string };

/** The companion's way to a district from where you are (concept §5, the 🗺 map). */
export function mapHint(s: WorldSave, to: DistrictInfo): MapHint {
  if (to.id === s.district) return { kind: 'here' };
  const here = districtInfo(s.district);
  if (!here) return { kind: 'far', text: 'I am not sure where we are. Find a station first.' };
  const from = here.stations[0];
  const dest = to.stations[0];
  if (!from || !dest) return { kind: 'far', text: 'No train goes there.' };
  const r = findRoute(from, dest);
  if (!r) return { kind: 'far', text: `No way there yet from ${station(from).zh}.` };
  const text = `From ${station(from).zh}: ${routeText(r)}`;
  if (s.bag.card === null) return { kind: 'no-card', text: `${text} But first you need a 交通卡 — the ticket machine in any station sells them (40 元).` };
  return { kind: 'route', text, from, fare: r.fare };
}

export interface MapSpot {
  d: DistrictInfo;
  visited: boolean;
  here: boolean;
  /** the story has not reached it yet (it is still open to walk in) */
  later: boolean;
}

export function mapSpots(s: WorldSave): MapSpot[] {
  return DISTRICTS.map((d) => ({ d, visited: s.districts.includes(d.id), here: s.district === d.id, later: d.chapter > s.chapter }));
}

export interface SpiritRow {
  spirit: Spirit;
  found: boolean;
}

/** Every spirit of the content; found ones first, in the order of the story. */
export function spiritRows(s: WorldSave, spirits: readonly Spirit[]): SpiritRow[] {
  return spirits.map((x) => ({ spirit: x, found: x.id in s.spirits }));
}

export interface IdiomRow {
  idiom: Idiom;
  /** who said it, and in which scene */
  npc?: string;
  scene?: string;
}

/** The 成语 heard so far: the plain ones first, then the stories (concept §7), each in the order found. */
export function idiomRows(s: WorldSave, idioms: readonly Idiom[]): IdiomRow[] {
  const byId = new Map(idioms.map((i) => [i.id, i]));
  return Object.entries(s.idioms)
    .map(([id, e]) => ({ idiom: byId.get(id), ...e }))
    .filter((r): r is { idiom: Idiom; at: number; npc?: string; scene?: string } => !!r.idiom)
    .sort((a, b) => Number(a.idiom.tier === 'story') - Number(b.idiom.tier === 'story') || a.at - b.at)
    .map(({ at: _at, ...r }) => r);
}

export interface StampRow {
  stamp: Stamp;
  got: boolean;
}

/** Landmark seals first, then the situation stamps; all shown, the ones not yet got as empty frames. */
export function stampRows(s: WorldSave, stamps: readonly Stamp[]): StampRow[] {
  return [...stamps]
    .sort((a, b) => Number(!!b.landmark) - Number(!!a.landmark))
    .map((x) => ({ stamp: x, got: x.id in s.stamps }));
}

export interface FriendRow {
  id: string;
  name: string;
  role: string;
  hearts: number;
  /** what they remember of you, oldest first (English) */
  notes: string[];
}

/** The people you have met who have cards (X2): warmest first, then the order you met them. */
export function friendRows(s: WorldSave, npcs: readonly NpcCard[]): FriendRow[] {
  const cards = new Map(npcs.map((n) => [n.id, n]));
  return Object.entries(s.npcs)
    .filter(([id]) => cards.has(id))
    .sort(([, a], [, b]) => b.hearts - a.hearts || a.met - b.met)
    .map(([id, m]) => ({ id, name: cards.get(id)!.name, role: cards.get(id)!.role, hearts: m.hearts, notes: m.notes }));
}
