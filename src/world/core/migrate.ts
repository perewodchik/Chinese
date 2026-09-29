/**
 * The save's own format version, apart from the workspace's.
 *
 * `readSave` takes whatever came out of localStorage or the server and
 * gives back a save of the current version, or says why it cannot: a save
 * written by a newer build is never downgraded (that build knows things this
 * one does not), and junk is refused rather than guessed at.
 *
 * To change the format: bump `WORLD_SAVE_VERSION` in save.ts and add the
 * step from the old version here. Fields that are merely *added* need no
 * step — `fill` gives a missing field its default.
 */

import { DEFAULT_SETTINGS, HOME, HOME_DISTRICT, newSave, WORLD_SAVE_VERSION } from './save';
import type { WorldSave } from './types';

type Raw = Record<string, unknown>;

/** version n → n + 1 */
export type Upgrade = (save: Raw) => Raw;
export const UPGRADES: Record<number, Upgrade> = {
  /** 1 → 2 (X1): every person remembered gets friendship hearts and the day of the last gift */
  1: (r) => ({
    ...r,
    version: 2,
    npcs: Object.fromEntries(Object.entries(isObj(r.npcs) ? r.npcs : {}).map(([k, v]) => [k, isObj(v) ? { hearts: 0, gift: 0, ...v } : v])),
  }),
  /** 2 → 3 (X2): the player's name, unknown until they tell someone; the day a talk last warmed each friendship */
  2: (r) => ({
    ...r,
    version: 3,
    name: typeof r.name === 'string' ? r.name : '',
    npcs: Object.fromEntries(Object.entries(isObj(r.npcs) ? r.npcs : {}).map(([k, v]) => [k, isObj(v) ? { talk: 0, ...v } : v])),
  }),
  /** 3 → 4 (X3): the diary, empty — it starts writing from today */
  3: (r) => ({ ...r, version: 4, diary: isObj(r.diary) ? r.diary : {} }),
  /** 4 → 5 (X5): an empty room and a cat not yet met */
  4: (r) => ({ ...r, version: 5, room: isObj(r.room) ? r.room : {}, cat: isObj(r.cat) ? r.cat : { fed: 0, day: 0, name: '' } }),
  /** 5 → 6 (X6): nothing photographed yet */
  5: (r) => ({ ...r, version: 6, photos: Array.isArray(r.photos) ? r.photos : [] }),
  /** 6 → 7 (Y2): an empty 账单 */
  6: (r) => ({ ...r, version: 7, bills: Array.isArray(r.bills) ? r.bills : [] }),
  /** 7 → 8 (Y3): nothing done today yet */
  7: (r) => ({ ...r, version: 8, daily: isObj(r.daily) ? r.daily : {} }),
  /** 8 → 9 (Y7): every 账单 line gets an id (so two phones' 账单 merge); nothing bought fresh yet */
  8: (r) => ({
    ...r,
    version: 9,
    bills: Array.isArray(r.bills) ? r.bills.map((b, i) => (isObj(b) && typeof b.id !== 'string' ? { ...b, id: `old:${i}` } : b)) : [],
    fresh: isObj(r.fresh) ? r.fresh : {},
  }),
  /**
   * 9 → 10 (§10 J1–J2): nothing to change — quests gain `at` stamps from now on (older steps show as
   * "earlier"), and the save may name a tracked quest; both are simply absent in an old save.
   */
  9: (r) => ({ ...r, version: 10 }),
};

export type ReadResult =
  | { ok: true; save: WorldSave; upgraded: boolean }
  | { ok: false; reason: 'newer' | 'invalid'; message: string };

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const record = <T>(v: unknown, ok: (x: unknown) => x is T): Record<string, T> => {
  const out: Record<string, T> = {};
  if (isObj(v)) for (const [k, x] of Object.entries(v)) if (ok(x)) out[k] = x;
  return out;
};
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Gives every field the current version has its value, or its default. */
function fill(r: Raw): WorldSave {
  const base = newSave(typeof r.deviceId === 'string' ? r.deviceId : 'unknown', isNum(r.updatedAt) ? r.updatedAt : 0);
  const place = isObj(r.place) && typeof r.place.map === 'string' && Array.isArray(r.place.tile) ? (r.place as unknown as WorldSave['place']) : HOME;
  const bag = isObj(r.bag) ? r.bag : {};
  return {
    ...base,
    ...(isNum(r.born) && r.born > 0 ? { born: r.born } : {}),
    place,
    district: typeof r.district === 'string' ? r.district : HOME_DISTRICT,
    name: typeof r.name === 'string' ? r.name : '',
    clock: isNum(r.clock) ? r.clock : base.clock,
    chapter: isNum(r.chapter) ? r.chapter : 1,
    flags: strings(r.flags),
    scenes: strings(r.scenes),
    quests: Object.fromEntries(
      Object.entries(record(r.quests, (x): x is WorldSave['quests'][string] => isObj(x) && typeof x.step === 'string')).map(([k, q]) => [
        k,
        { step: q.step, index: isNum(q.index) ? q.index : 0, done: !!q.done, ...(isObj(q.at) ? { at: record(q.at, isNum) } : {}) },
      ]),
    ),
    riddles: record(r.riddles, (x): x is WorldSave['riddles'][string] => isObj(x) && typeof x.scene === 'string'),
    bag: {
      items: record(bag.items, isNum),
      money: isNum(bag.money) ? bag.money : base.bag.money,
      card: isNum(bag.card) ? bag.card : null,
    },
    spirits: record(r.spirits, isNum),
    idioms: record(r.idioms, (x): x is WorldSave['idioms'][string] => isObj(x) && isNum(x.at)),
    stamps: record(r.stamps, isNum),
    stations: strings(r.stations),
    districts: strings(r.districts).length ? strings(r.districts) : [HOME_DISTRICT],
    ...(Array.isArray(r.visited) ? { visited: strings(r.visited) } : {}),
    npcs: Object.fromEntries(
      Object.entries(record(r.npcs, (x): x is WorldSave['npcs'][string] => isObj(x) && isNum(x.met))).map(([k, x]) => [
        k,
        { met: x.met, notes: strings(x.notes), hearts: isNum(x.hearts) ? x.hearts : 0, gift: isNum(x.gift) ? x.gift : 0, talk: isNum(x.talk) ? x.talk : 0 },
      ]),
    ),
    rides: record(r.rides, isNum),
    diary: record(r.diary, (x): x is string[] => Array.isArray(x) && x.every((c) => typeof c === 'string')),
    room: record(r.room, (x): x is string => typeof x === 'string'),
    photos: strings(r.photos),
    daily: record(r.daily, isNum),
    fresh: record(r.fresh, isNum),
    ...(isObj(r.seen) ? { seen: record(r.seen, isNum) } : {}),
    bills: Array.isArray(r.bills)
      ? r.bills.filter((b): b is WorldSave['bills'][number] => isObj(b) && typeof b.id === 'string' && isNum(b.at) && typeof b.who === 'string' && isNum(b.amount))
      : [],
    cat: isObj(r.cat)
      ? { fed: isNum(r.cat.fed) ? r.cat.fed : 0, day: isNum(r.cat.day) ? r.cat.day : 0, name: typeof r.cat.name === 'string' ? r.cat.name : '' }
      : { fed: 0, day: 0, name: '' },
    settings: { ...DEFAULT_SETTINGS, ...(isObj(r.settings) ? (r.settings as Partial<WorldSave['settings']>) : {}) },
  };
}

export function readSave(raw: unknown, upgrades: Record<number, Upgrade> = UPGRADES, current = WORLD_SAVE_VERSION): ReadResult {
  if (!isObj(raw) || !isNum(raw.version)) return { ok: false, reason: 'invalid', message: 'not a 走走 save' };
  if (raw.version > current) {
    return { ok: false, reason: 'newer', message: `the save is version ${raw.version}; this app knows ${current} — reload to update` };
  }
  let r: Raw = raw;
  let v = raw.version;
  while (v < current) {
    const step = upgrades[v];
    if (!step) return { ok: false, reason: 'invalid', message: `no way to upgrade a version ${v} save` };
    r = step(r);
    v++;
  }
  return { ok: true, save: { ...fill(r), version: current }, upgraded: raw.version !== current };
}
