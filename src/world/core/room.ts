/**
 * Your room in the 四合院, and the 胡同 cat (prompt X5).
 *
 * The room has five spots for things you buy around the city — three on the
 * wall and the window, two on the floor. Using a decoration from the bag on
 * a spot (a sign in the room: 墙, 窗户, 地上) puts it there; whatever stood
 * there goes back into the bag. What stands where is drawn as props by
 * `castMap`, the same for the page and the solver.
 *
 * The cat: feed it (小鱼干) on three different days and it trusts you; then
 * give it a name, and it sleeps in the courtyard and follows you in 帽儿胡同.
 */

import { dayOf } from './clock';
import type { CatState, MapObject, Tile, WorldSave } from './types';

export const ROOM_MAP = 'siheyuan-room';

export interface Spot {
  id: string;
  tile: Tile;
  on: 'wall' | 'floor';
}

export const SPOTS: readonly Spot[] = [
  { id: 'spot-wall-l', tile: [2, 1], on: 'wall' },
  { id: 'spot-window', tile: [4, 1], on: 'wall' },
  { id: 'spot-wall-r', tile: [6, 1], on: 'wall' },
  { id: 'spot-floor-l', tile: [3, 6], on: 'floor' },
  { id: 'spot-floor-r', tile: [8, 6], on: 'floor' },
];

export interface Decor {
  frame: string;
  /** the frame after dark (a lantern lit) */
  night?: string;
  light?: string;
  on: 'wall' | 'floor' | 'any';
}

export const DECOR: Record<string, Decor> = {
  jianzhi: { frame: 'jianzhi/red', on: 'wall' },
  shufa: { frame: 'shufa/scroll', on: 'wall' },
  lianpu: { frame: 'lianpu/red', on: 'wall' },
  denglong: { frame: 'lantern/unlit', night: 'lantern/lit-0', light: '#ffb44c', on: 'any' },
  huapen: { frame: 'plant/green', on: 'floor' },
};

export const isDecor = (item: string) => item in DECOR;

/** Whether a decoration may go on a spot (a paper-cut does not stand on the floor). */
export function fits(item: string, spot: string): boolean {
  const d = DECOR[item];
  const s = SPOTS.find((x) => x.id === spot);
  return !!d && !!s && (d.on === 'any' || d.on === s.on);
}

/** The props of the decorations in place. */
export function roomProps(s: WorldSave): MapObject[] {
  const out: MapObject[] = [];
  for (const spot of SPOTS) {
    const item = s.room[spot.id];
    const d = item ? DECOR[item] : undefined;
    if (!d) continue;
    out.push({
      kind: 'prop',
      id: `decor-${spot.id}`,
      tile: spot.tile,
      frame: d.frame,
      blocks: [1, spot.on === 'floor' ? 1 : 0],
      ...(d.night ? { night: d.night } : {}),
      ...(d.light ? { light: d.light } : {}),
    });
  }
  return out;
}

// ---------------------------------------------------------------- the cat

export const CAT_TRUST_DAYS = 3;
/** where the cat waits in the lane before it trusts you, and sleeps once it is yours */
export const CAT_LANE: { map: string; tile: Tile } = { map: 'hutong-home', tile: [33, 10] };
export const CAT_YARD: { map: string; tile: Tile } = { map: 'siheyuan-yard', tile: [2, 6] };

export const NO_CAT: CatState = { fed: 0, day: 0, name: '' };

export function feedCat(s: WorldSave): WorldSave {
  const today = dayOf(s.clock);
  if (s.cat.day === today) return s;
  return { ...s, cat: { ...s.cat, fed: s.cat.fed + 1, day: today } };
}

/** 「它叫小花」 / 「叫它小花」 / 「小花」: the name, at most eight characters. */
export function catNameFrom(text: string): string | null {
  const t = text.trim().replace(/[。！？!?.,，]+$/, '');
  const m = /(?:它叫|叫它|名字是|名字叫|就叫|叫)\s*([^\s，。！？、,.!?]+)/.exec(t);
  const name = (m ? m[1]! : /^[一-鿿]{1,4}$/.test(t) ? t : '').replace(/(吧|啊|呀)$/, '').slice(0, 8);
  return name || null;
}

/** The cat as a prop: in the lane until it has a name, then asleep in the courtyard (it follows you in the lane — the engine draws that). */
export function catProps(s: WorldSave, map: string): MapObject[] {
  if (!s.cat.name && map === CAT_LANE.map) return [{ kind: 'prop', id: 'cat', tile: CAT_LANE.tile, frame: 'cat/sit', blocks: [1, 1] }];
  if (s.cat.name && map === CAT_YARD.map) return [{ kind: 'prop', id: 'cat', tile: CAT_YARD.tile, frame: 'cat/sleep', blocks: [1, 1] }];
  return [];
}
