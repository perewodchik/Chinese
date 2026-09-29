/**
 * Two saves of the same game, made on two devices, as one.
 *
 * Almost everything in a save only grows, so most of the merge is a union:
 * a spirit found on the iPad stays found when the Mac saves. What cannot be
 * united — where you stand, the clock, what is in the bag, the settings — is
 * taken whole from the save changed last. Quests take the further step.
 *
 * The merge is commutative (ties on `updatedAt` are broken by `deviceId`),
 * so it does not matter which device notices the conflict. One thing is lost
 * by design: a flag cleared on one device comes back if the other still has
 * it. Content should use a new flag rather than clearing an old one.
 */

import { DIARY_PER_DAY } from './diary';
import type { NpcMemory, QuestState, Riddle, WorldSave } from './types';

const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])].sort();

function byKey<T>(a: Record<string, T>, b: Record<string, T>, pick: (x: T, y: T) => T): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const x = a[k];
    const y = b[k];
    out[k] = x === undefined ? y : y === undefined ? x : pick(x, y);
  }
  return out;
}

const further = (x: QuestState, y: QuestState): QuestState => {
  if (x.done !== y.done) return x.done ? x : y;
  if (x.index !== y.index) return x.index > y.index ? x : y;
  return x.step <= y.step ? x : y;
};

const riddle = (x: Riddle, y: Riddle): Riddle => ({
  ...x,
  pinnedAt: Math.min(x.pinnedAt, y.pinnedAt),
  solved: x.solved || y.solved,
});

const memory = (x: NpcMemory, y: NpcMemory): NpcMemory => {
  const xFirst = x.met !== y.met ? x.met < y.met : JSON.stringify(x.notes) <= JSON.stringify(y.notes);
  const [first, second] = xFirst ? [x, y] : [y, x];
  const notes = [...first.notes];
  for (const n of second.notes) if (!notes.includes(n)) notes.push(n);
  const hearts = Math.max(x.hearts ?? 0, y.hearts ?? 0);
  const gift = Math.max(x.gift ?? 0, y.gift ?? 0);
  const talk = Math.max(x.talk ?? 0, y.talk ?? 0);
  return { met: first.met, notes: notes.slice(-20), hearts, gift, talk };
};

type Heard = WorldSave['idioms'][string];
const earlier = (x: Heard, y: Heard): Heard => (x.at < y.at || (x.at === y.at && JSON.stringify(x) <= JSON.stringify(y)) ? x : y);

/** Whether `a` was changed after `b` (the device id decides a tie). */
export const isLater = (a: WorldSave, b: WorldSave) =>
  a.updatedAt !== b.updatedAt ? a.updatedAt > b.updatedAt : a.deviceId > b.deviceId;

export function merge(a: WorldSave, b: WorldSave): WorldSave {
  // Two different games (one was started over): the newer game is the game, whole.
  const [ba, bb] = [a.born ?? 0, b.born ?? 0];
  if (ba !== bb) return ba > bb ? a : b;
  const late = isLater(a, b) ? a : b;
  return {
    // taken whole from the later save
    version: Math.max(a.version, b.version),
    ...(late.born ? { born: late.born } : {}),
    updatedAt: late.updatedAt,
    deviceId: late.deviceId,
    place: late.place,
    district: late.district,
    // a name once told is not forgotten by the device that did not hear it
    name: late.name || (late === a ? b : a).name,
    clock: late.clock,
    bag: late.bag,
    // the 账单 goes with the purse it describes
    bills: late.bills,
    // what stands in the room goes with the bag it came out of
    room: late.room,
    // the cat remembers every day it was fed, and keeps a name once given
    cat: {
      fed: Math.max(a.cat.fed, b.cat.fed),
      day: Math.max(a.cat.day, b.cat.day),
      name: late.cat.name || (late === a ? b : a).cat.name,
    },
    settings: late.settings,
    // only ever grow
    chapter: Math.max(a.chapter, b.chapter),
    flags: union(a.flags, b.flags),
    scenes: union(a.scenes, b.scenes),
    stations: union(a.stations, b.stations),
    districts: union(a.districts, b.districts),
    ...(a.visited || b.visited ? { visited: union(a.visited ?? [], b.visited ?? []) } : {}),
    photos: union(a.photos, b.photos),
    quests: byKey(a.quests, b.quests, further),
    riddles: byKey(a.riddles, b.riddles, riddle),
    spirits: byKey(a.spirits, b.spirits, Math.min),
    stamps: byKey(a.stamps, b.stamps, Math.min),
    idioms: byKey(a.idioms, b.idioms, earlier),
    npcs: byKey(a.npcs, b.npcs, memory),
    rides: byKey(a.rides, b.rides, Math.max),
    daily: byKey(a.daily, b.daily, Math.max),
    // a day's diary from both devices: the earlier device's lines first, the other's after
    diary: byKey(a.diary, b.diary, (x, y) => {
      const [first, second] = JSON.stringify(x) <= JSON.stringify(y) ? [x, y] : [y, x];
      return [...first, ...second.filter((c) => !first.includes(c))].slice(0, DIARY_PER_DAY);
    }),
  };
}
