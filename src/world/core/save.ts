/**
 * The one way the save changes: `apply(save, action)` returns a new save.
 *
 * Content actions (`give`, `stamp`, `quest` …, see `types.ts`) and the
 * engine's own (`move`, `enter`, `meet`, `tick` …) go through here alike, so
 * a scene that plays wrong can be replayed as a list of actions in a test.
 * Nothing is mutated; unchanged parts are shared with the old save.
 */

import { dayOf, sleep as sleepClock, START_MINUTES, waitUntil } from './clock';
import { eventsOf, logDay } from './diary';
import { feedCat, fits, NO_CAT } from './room';
import { MAX_SUBJECTS } from './photo';
import type { Action, Facing, Place, Quest, Tile, WorldSave, WorldSettings } from './types';
import { applyWardrobe, newWardrobe, wardrobeEvents, type WardrobeAction } from './wardrobe';

/** 10 is the journal's (§10); 11 is §12's wardrobe; 12 is 成语 Practise (§10 P3) */
export const WORLD_SAVE_VERSION = 12;
/** how many payments the 账单 keeps */
export const BILLS = 20;

/** Where a new game starts: your room in 王阿姨's 四合院. */
export const HOME: Place = { map: 'siheyuan-room', tile: [4, 4], facing: 'down' };
export const HOME_DISTRICT = 'gulou';

export const DEFAULT_SETTINGS: WorldSettings = {
  input: 'keyboard',
  pinyin: true,
  joystick: false,
  textSize: 'm',
  live: false,
  volume: 0.6,
  music: 0.6,
};

/** What you arrive in Beijing with, in 元: enough for chapter 1 and a few treats, until the bank in chapter 3. */
export const START_MONEY = 200;

export function newSave(deviceId: string, now: number): WorldSave {
  return {
    version: WORLD_SAVE_VERSION,
    updatedAt: now,
    deviceId,
    place: HOME,
    district: HOME_DISTRICT,
    name: '',
    clock: START_MINUTES,
    chapter: 1,
    flags: [],
    scenes: [],
    quests: {},
    riddles: {},
    bag: { items: {}, money: START_MONEY, card: null },
    spirits: {},
    idioms: {},
    stamps: {},
    stations: [],
    districts: [HOME_DISTRICT],
    npcs: {},
    rides: {},
    diary: {},
    room: {},
    cat: { ...NO_CAT },
    photos: [],
    bills: [],
    daily: {},
    fresh: {},
    ...newWardrobe(),
    settings: DEFAULT_SETTINGS,
  };
}

/** What only the engine does: walking, doors, meeting people, time passing. */
export type EngineAction =
  | { do: 'move'; tile: Tile; facing: Facing }
  | { do: 'enter'; map: string; tile: Tile; facing: Facing; district?: string }
  | { do: 'meet'; npc: string }
  /** a present given today (one a day) */
  | { do: 'gifted'; npc: string; item?: string }
  /** a finished talk with a person: one heart a game day (X2) */
  | { do: 'talked'; npc: string }
  /** the name the player gave (X2) */
  | { do: 'name'; name: string }
  /** the name the cat got (X5) */
  | { do: 'cat_name'; name: string }
  /** a photo taken, with what is in it (X6) */
  | { do: 'photo'; subjects: string[] }
  | { do: 'scene_done'; scene: string }
  /** start the game over (settings stay): a new game, born now, that wins over the old one on every device */
  | { do: 'reset'; born: number }
  | { do: 'ride'; route: string }
  | { do: 'tick'; minutes: number }
  | { do: 'settings'; patch: Partial<WorldSettings> }
  /** a menu view opened (its news seen), or a lead looked at (§10) */
  | { do: 'seen'; key: string; at: number }
  /** follow a quest in the journal ('' for the story again); `rev` is the wall-clock ms (§10 J2) */
  | { do: 'track'; quest: string; rev: number }
  /** one 成语 Practise answer (§10 P3): right or missed, at the game's minute */
  | { do: 'practised'; idiom: string; right: boolean }
  /** the creator, the wardrobe, the mirror, the racks and the barber (§12) */
  | WardrobeAction;

export type SaveAction = Action | EngineAction;

export interface ApplyContext {
  /** wall-clock ms, stamped into `updatedAt` */
  now: number;
  deviceId?: string;
  /** quest definitions, so a step can be ordered against another */
  quests?: ReadonlyMap<string, Quest>;
  /** who is talking, for the 成语 book's "heard from" */
  scene?: string;
  npc?: string;
}

const money = (n: number) => Math.round(n * 100) / 100;
const withFlag = (flags: string[], flag: string, on: boolean) =>
  on ? (flags.includes(flag) ? flags : [...flags, flag]) : flags.includes(flag) ? flags.filter((f) => f !== flag) : flags;
const addOnce = (list: string[], v: string) => (list.includes(v) ? list : [...list, v]);

/** The `QuestState.at` key for the minute a quest was finished (step ids are latin, so it cannot clash). */
export const DONE_AT = '$done';
const stamp = (at: Record<string, number> | undefined, key: string, clock: number) => (at?.[key] !== undefined ? at : { ...at, [key]: Math.floor(clock) });

/** `scene/node` → its parts; a riddle id without a slash is its own scene. */
export function riddleParts(riddle: string): { scene: string; node: string } {
  const i = riddle.indexOf('/');
  return i < 0 ? { scene: riddle, node: '' } : { scene: riddle.slice(0, i), node: riddle.slice(i + 1) };
}

function stepIndex(ctx: ApplyContext, quest: string, step: string): number {
  const q = ctx.quests?.get(quest);
  const i = q ? q.steps.findIndex((s) => s.id === step) : -1;
  return i < 0 ? 0 : i;
}

/** The save's own changes, before `updatedAt` is stamped. Unknown actions change nothing. */
function change(s: WorldSave, a: SaveAction, ctx: ApplyContext): WorldSave {
  switch (a.do) {
    case 'move':
      return { ...s, place: { ...s.place, tile: a.tile, facing: a.facing } };
    case 'enter':
    case 'teleport': {
      const facing = a.facing ?? s.place.facing;
      const been = s.visited ?? [];
      const next = { ...s, place: { map: a.map, tile: a.tile, facing }, ...(been.includes(a.map) ? {} : { visited: [...been, a.map] }) };
      if (a.do === 'enter' && a.district && a.district !== s.district) {
        return { ...next, district: a.district, districts: addOnce(s.districts, a.district) };
      }
      return next;
    }
    case 'flag': {
      const flags = withFlag(s.flags, a.flag, a.value ?? true);
      return flags === s.flags ? s : { ...s, flags };
    }
    case 'give': {
      const n = (s.bag.items[a.item] ?? 0) + (a.count ?? 1);
      return { ...s, bag: { ...s.bag, items: { ...s.bag.items, [a.item]: n } } };
    }
    case 'take': {
      const n = (s.bag.items[a.item] ?? 0) - (a.count ?? 1);
      const items = { ...s.bag.items };
      if (n > 0) items[a.item] = n;
      else delete items[a.item];
      return { ...s, bag: { ...s.bag, items } };
    }
    case 'money':
      return { ...s, bag: { ...s.bag, money: Math.max(0, money(s.bag.money + a.amount)) } };
    case 'earn':
      return a.amount > 0 ? { ...s, bag: { ...s.bag, money: money(s.bag.money + a.amount) } } : s;
    case 'buy': {
      const n = (s.bag.items[a.item] ?? 0) + (a.count ?? 1);
      return { ...s, bag: { ...s.bag, items: { ...s.bag.items, [a.item]: n } }, fresh: { ...s.fresh, [a.item]: dayOf(s.clock) } };
    }
    case 'card':
      return { ...s, bag: { ...s.bag, card: Math.max(0, money((s.bag.card ?? 0) + a.amount)) } };
    case 'quest': {
      const index = stepIndex(ctx, a.quest, a.step);
      const cur = s.quests[a.quest];
      // A quest only moves forward: replaying an old scene cannot take it back.
      if (cur && (cur.done || cur.index > index)) return s;
      // the journal's clock (§10 J1): when each step was reached
      const at = stamp(cur?.at, a.step, s.clock);
      return { ...s, quests: { ...s.quests, [a.quest]: { step: a.step, index, done: false, at } } };
    }
    case 'quest_done': {
      const cur = s.quests[a.quest];
      const last = ctx.quests?.get(a.quest)?.steps.at(-1);
      const done = {
        step: last?.id ?? cur?.step ?? 'done',
        index: last ? (ctx.quests!.get(a.quest)!.steps.length - 1) : (cur?.index ?? 0),
        done: true,
        at: stamp(cur?.at, DONE_AT, s.clock),
      };
      return { ...s, quests: { ...s.quests, [a.quest]: done } };
    }
    case 'stamp':
      return s.stamps[a.stamp] !== undefined ? s : { ...s, stamps: { ...s.stamps, [a.stamp]: Math.floor(s.clock) } };
    case 'spirit':
      return s.spirits[a.spirit] !== undefined ? s : { ...s, spirits: { ...s.spirits, [a.spirit]: Math.floor(s.clock) } };
    case 'idiom': {
      if (s.idioms[a.idiom]) return s;
      const entry = { at: Math.floor(s.clock), ...(ctx.npc ? { npc: ctx.npc } : {}), ...(ctx.scene ? { scene: ctx.scene } : {}) };
      return { ...s, idioms: { ...s.idioms, [a.idiom]: entry } };
    }
    case 'station':
      return s.stations.includes(a.station) ? s : { ...s, stations: [...s.stations, a.station] };
    case 'district':
      return s.districts.includes(a.district) ? s : { ...s, districts: [...s.districts, a.district] };
    case 'chapter':
      return a.chapter > s.chapter ? { ...s, chapter: a.chapter } : s;
    case 'sleep':
      return { ...s, clock: sleepClock(s.clock) };
    case 'wait':
      return { ...s, clock: waitUntil(s.clock, a.until) };
    case 'pin': {
      if (s.riddles[a.riddle]) return s;
      const { scene, node } = riddleParts(a.riddle);
      return { ...s, riddles: { ...s.riddles, [a.riddle]: { scene, node, pinnedAt: Math.floor(s.clock), solved: false } } };
    }
    case 'solve': {
      const cur = s.riddles[a.riddle];
      if (cur?.solved) return s;
      const base = cur ?? { ...riddleParts(a.riddle), pinnedAt: Math.floor(s.clock) };
      return { ...s, riddles: { ...s.riddles, [a.riddle]: { ...base, solved: true } } };
    }
    case 'meet':
      return s.npcs[a.npc] ? s : { ...s, npcs: { ...s.npcs, [a.npc]: { met: Math.floor(s.clock), notes: [], hearts: 0, gift: 0, talk: 0 } } };
    case 'name': {
      const name = a.name.trim().slice(0, 12);
      return name && name !== s.name ? { ...s, name } : s;
    }
    case 'hearts': {
      const cur = s.npcs[a.npc] ?? { met: Math.floor(s.clock), notes: [], hearts: 0, gift: 0, talk: 0 };
      const hearts = Math.max(0, Math.min(5, cur.hearts + a.delta));
      return hearts === cur.hearts ? s : { ...s, npcs: { ...s.npcs, [a.npc]: { ...cur, hearts } } };
    }
    case 'place': {
      if (!fits(a.item, a.spot) || !(s.bag.items[a.item] ?? 0)) return s;
      const was = s.room[a.spot];
      if (was === a.item) return s;
      const items = { ...s.bag.items, [a.item]: (s.bag.items[a.item] ?? 0) - 1 };
      if (items[a.item]! <= 0) delete items[a.item];
      if (was) items[was] = (items[was] ?? 0) + 1;
      const flags = [...new Set([...s.flags, 'room-decorated', `decor-${a.item}`])];
      return { ...s, bag: { ...s.bag, items }, room: { ...s.room, [a.spot]: a.item }, flags };
    }
    case 'feed_cat':
      return feedCat(s);
    case 'eat': {
      const n = s.bag.items[a.item] ?? 0;
      if (!n) return s;
      const items = { ...s.bag.items, [a.item]: n - 1 };
      if (!items[a.item]) delete items[a.item];
      return { ...s, bag: { ...s.bag, items } };
    }
    case 'combine': {
      if (!(s.bag.items[a.a] ?? 0) || !(s.bag.items[a.b] ?? 0)) return s;
      const items = { ...s.bag.items, [a.a]: (s.bag.items[a.a] ?? 0) - 1, [a.b]: (s.bag.items[a.b] ?? 0) - 1, [a.makes]: (s.bag.items[a.makes] ?? 0) + 1 };
      for (const k of [a.a, a.b]) if (!items[k]) delete items[k];
      return { ...s, bag: { ...s.bag, items } };
    }
    case 'daily':
      return s.daily[a.id] === dayOf(s.clock) ? s : { ...s, daily: { ...s.daily, [a.id]: dayOf(s.clock) } };
    case 'photo': {
      const add = a.subjects.filter((x) => !s.photos.includes(x));
      // a photo of nothing in particular still counts for the diary
      if (!add.length) return { ...s, photos: s.photos };
      return { ...s, photos: [...s.photos, ...add].slice(-MAX_SUBJECTS) };
    }
    case 'cat_name': {
      const name = a.name.trim().slice(0, 8);
      if (!name || name === s.cat.name) return s;
      return { ...s, cat: { ...s.cat, name }, flags: s.flags.includes('cat-named') ? s.flags : [...s.flags, 'cat-named'] };
    }
    case 'talked': {
      const cur = s.npcs[a.npc] ?? { met: Math.floor(s.clock), notes: [], hearts: 0, gift: 0, talk: 0 };
      const today = dayOf(s.clock);
      if (cur.talk === today) return s;
      return { ...s, npcs: { ...s.npcs, [a.npc]: { ...cur, talk: today, hearts: Math.min(5, cur.hearts + 1) } } };
    }
    case 'gifted': {
      const cur = s.npcs[a.npc] ?? { met: Math.floor(s.clock), notes: [], hearts: 0, gift: 0, talk: 0 };
      return { ...s, npcs: { ...s.npcs, [a.npc]: { ...cur, gift: dayOf(s.clock) } } };
    }
    case 'remember': {
      const cur = s.npcs[a.npc] ?? { met: Math.floor(s.clock), notes: [], hearts: 0, gift: 0, talk: 0 };
      if (cur.notes.includes(a.note)) return s;
      // Keep the memory short: the last twenty things are what a neighbour recalls.
      const notes = [...cur.notes, a.note].slice(-20);
      return { ...s, npcs: { ...s.npcs, [a.npc]: { ...cur, notes } } };
    }
    case 'scene_done':
      return s.scenes.includes(a.scene) ? s : { ...s, scenes: [...s.scenes, a.scene] };
    case 'ride':
      return { ...s, rides: { ...s.rides, [a.route]: (s.rides[a.route] ?? 0) + 1 } };
    case 'tick':
      return a.minutes === s.clock ? s : { ...s, clock: Math.max(s.clock, a.minutes) };
    case 'settings':
      return { ...s, settings: { ...s.settings, ...a.patch } };
    case 'track':
      return s.tracked && s.tracked.rev >= a.rev ? s : { ...s, tracked: { quest: a.quest, rev: a.rev } };
    case 'practised': {
      const cur = s.practised?.[a.idiom] ?? { right: 0, wrong: 0, last: -1 };
      const next = { right: cur.right + (a.right ? 1 : 0), wrong: cur.wrong + (a.right ? 0 : 1), last: Math.max(cur.last, Math.floor(s.clock)) };
      return { ...s, practised: { ...s.practised, [a.idiom]: next } };
    }
    case 'seen':
      return (s.seen?.[a.key] ?? -1) >= a.at ? s : { ...s, seen: { ...s.seen, [a.key]: a.at } };
    case 'reset':
      return { ...newSave(s.deviceId, s.updatedAt), born: a.born, settings: s.settings };
    case 'create':
    case 'wear':
    case 'take_off':
    case 'save_outfit':
    case 'put_on':
    case 'buy_clothes':
    case 'sell_clothes':
    case 'hair':
      return applyWardrobe(s, a);
    case 'game':
      // The engine opens the game; the save only remembers where we were, which it already does.
      return s;
    default:
      return s;
  }
}

/** One line of the 账单, with an id no other line (on this device or another) has. */
function bill(s: WorldSave, amount: number, ctx: ApplyContext): WorldSave['bills'][number] {
  const at = Math.floor(s.clock);
  const base = `${ctx.deviceId ?? s.deviceId}:${at}`;
  let id = base;
  for (let i = 2; s.bills.some((b) => b.id === id); i++) id = `${base}:${i}`;
  return { id, at, who: ctx.npc ?? ctx.scene ?? '', amount };
}

export function apply(s: WorldSave, a: SaveAction, ctx: ApplyContext): WorldSave {
  let changed = change(s, a, ctx);
  if (changed === s) return s;
  // every change to 余额 goes into the phone's 账单 (Y2)
  if ((a.do === 'money' || a.do === 'earn') && a.amount) {
    changed = { ...changed, bills: [...changed.bills, bill(changed, a.amount, ctx)].slice(-BILLS) };
  }
  // the diary writes itself as things happen (X3); a night's sleep belongs to the day it ended
  const codes = [...eventsOf(s, changed, a, ctx.npc), ...wardrobeEvents(s, changed, a as WardrobeAction)];
  const next = logDay(changed, codes, a.do === 'sleep' ? s.clock : changed.clock);
  return { ...next, updatedAt: ctx.now, deviceId: ctx.deviceId ?? s.deviceId };
}

export function applyAll(s: WorldSave, actions: readonly SaveAction[], ctx: ApplyContext): WorldSave {
  return actions.reduce((acc, a) => apply(acc, a, ctx), s);
}
