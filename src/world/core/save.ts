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

export const WORLD_SAVE_VERSION = 6;

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
  | { do: 'settings'; patch: Partial<WorldSettings> };

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
      const next = { ...s, place: { map: a.map, tile: a.tile, facing } };
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
    case 'card':
      return { ...s, bag: { ...s.bag, card: Math.max(0, money((s.bag.card ?? 0) + a.amount)) } };
    case 'quest': {
      const index = stepIndex(ctx, a.quest, a.step);
      const cur = s.quests[a.quest];
      // A quest only moves forward: replaying an old scene cannot take it back.
      if (cur && (cur.done || cur.index > index)) return s;
      return { ...s, quests: { ...s.quests, [a.quest]: { step: a.step, index, done: false } } };
    }
    case 'quest_done': {
      const cur = s.quests[a.quest];
      const last = ctx.quests?.get(a.quest)?.steps.at(-1);
      const done = {
        step: last?.id ?? cur?.step ?? 'done',
        index: last ? (ctx.quests!.get(a.quest)!.steps.length - 1) : (cur?.index ?? 0),
        done: true,
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
    case 'reset':
      return { ...newSave(s.deviceId, s.updatedAt), born: a.born, settings: s.settings };
    case 'game':
      // The engine opens the game; the save only remembers where we were, which it already does.
      return s;
    default:
      return s;
  }
}

export function apply(s: WorldSave, a: SaveAction, ctx: ApplyContext): WorldSave {
  const changed = change(s, a, ctx);
  if (changed === s) return s;
  // the diary writes itself as things happen (X3); a night's sleep belongs to the day it ended
  const next = logDay(changed, eventsOf(s, changed, a, ctx.npc), a.do === 'sleep' ? s.clock : changed.clock);
  return { ...next, updatedAt: ctx.now, deviceId: ctx.deviceId ?? s.deviceId };
}

export function applyAll(s: WorldSave, actions: readonly SaveAction[], ctx: ApplyContext): WorldSave {
  return actions.reduce((acc, a) => apply(acc, a, ctx), s);
}
