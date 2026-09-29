/**
 * Neighbourhoods (prompt §9⅞): the learner's way of seeing the game's
 * Beijing — the places around one station, joined on foot. A district may
 * hold two of them (三里屯 and 国贸 are a ride apart), and one neighbourhood
 * may reach into the next on foot (鼓楼 → 后海 → 北海).
 *
 * `layoutHood` lays a neighbourhood out from the game's own geometry, so the
 * minimap is the world in small: every street, park or square (an *area*)
 * is a rectangle the size of its map in tiles, put beside the map it joins
 * by an edge exactly as the edge joins them, or across the way from the
 * door that leads there; every shop, room and station (a *room*) is a small
 * card beside the door that opens onto it. A hero's tile on an area is a
 * point on the plan with no guessing.
 *
 * Pure: the build (scripts/world/build-maps.ts) writes the result to
 * public/world/maps/hoods.json; tests check every map is in one
 * neighbourhood and every neighbourhood hangs together on foot.
 */

import { walkPath, type MapLinks } from './places';
import { findRoute, routeText, station } from './travel';
import type { Facing, MapObject, WorldSave } from './types';

export interface Hood {
  id: string;
  zh: string;
  en: string;
  /** the station(s) the neighbourhood is around (ids from travel.ts) */
  stations: string[];
  /** its maps; the first area is where the layout starts */
  maps: string[];
}

export const HOODS: readonly Hood[] = [
  {
    id: 'nanluoguxiang',
    zh: '南锣鼓巷',
    en: 'Nanluoguxiang and the Drum Tower',
    stations: ['nanluoguxiang'],
    maps: ['nanluo-main', 'hutong-home', 'siheyuan-yard', 'siheyuan-room', 'gulou-square', 'gulou-dongdajie', 'subway-lane', 'zaodian', 'xiaomaibu', 'lifadian', 'chaguan', 'station-nanluoguxiang'],
  },
  { id: 'shichahai', zh: '什刹海', en: 'Shichahai · Houhai', stations: ['shichahai'], maps: ['houhai-lake', 'yandai-xiejie', 'gongwangfu', 'station-shichahai'] },
  {
    id: 'beihai',
    zh: '北海 · 景山',
    en: 'Beihai and Jingshan',
    stations: ['beihaibei'],
    maps: ['jingshan-park', 'beihai-north', 'beihai-baita', 'jingshan-view', 'jiaolou', 'station-beihaibei'],
  },
  {
    id: 'tiananmen',
    zh: '天安门 · 故宫',
    en: 'Tiananmen and the Forbidden City',
    stations: ['tiananmendong'],
    maps: ['tiananmen-square', 'wumen', 'taihedian', 'jiulongbi', 'yuhuayuan', 'station-tiananmendong'],
  },
  { id: 'wangfujing', zh: '王府井', en: 'Wangfujing', stations: ['wangfujing'], maps: ['wangfujing-street', 'shudian', 'yaodian', 'yinhang', 'baihuo-1', 'baihuo-2', 'station-wangfujing'] },
  { id: 'qianmen', zh: '前门', en: 'Qianmen · Dashilar', stations: ['qianmen'], maps: ['qianmen-street', 'xiyuan', 'ruifuxiang', 'neiliansheng', 'station-qianmen'] },
  { id: 'tiantan', zh: '天坛', en: 'Temple of Heaven', stations: ['tiantandongmen'], maps: ['tiantan-park', 'qiniandian', 'huiyinbi', 'huanqiu', 'station-tiantandongmen'] },
  { id: 'yonghegong', zh: '雍和宫', en: 'Lama Temple · Imperial Academy', stations: ['yonghegong'], maps: ['yonghegong-street', 'yonghegong-front', 'yonghegong-wanfuge', 'guozijian', 'kongmiao', 'ditan', 'station-yonghegong'] },
  { id: 'baiyunguan', zh: '白云观', en: 'White Cloud Temple', stations: ['muxidi'], maps: ['baiyunguan', 'station-muxidi'] },
  { id: 'dongyuemiao', zh: '东岳庙', en: 'Dongyue Temple', stations: ['chaoyangmen'], maps: ['dongyuemiao', 'station-chaoyangmen'] },
  { id: 'sanlitun', zh: '三里屯', en: 'Sanlitun', stations: ['tuanjiehu'], maps: ['sanlitun-street', 'station-tuanjiehu'] },
  { id: 'guomao', zh: '国贸', en: 'Guomao', stations: ['guomao'], maps: ['guomao-plaza', 'guomao-bank', 'bianlidian', 'station-guomao'] },
  { id: 'aoyun', zh: '奥林匹克公园', en: 'Olympic Park', stations: ['aolinpikegongyuan'], maps: ['olympic-park', 'station-aolinpikegongyuan'] },
  { id: 'panjiayuan', zh: '潘家园', en: 'Panjiayuan', stations: ['panjiayuan'], maps: ['panjiayuan-market', 'station-panjiayuan'] },
  { id: 'xizhimen', zh: '西直门', en: 'Xizhimen · Beijing North', stations: ['xizhimen', 'beijingbeizhan'], maps: ['stop-xizhimen', 'station-xizhimen', 'stop-beijingbeizhan'] },
  { id: 'yiheyuan', zh: '颐和园', en: 'Summer Palace', stations: ['yiheyuan'], maps: ['stop-yiheyuan', 'yiheyuan-changlang'] },
  { id: 'changcheng', zh: '长城', en: 'Great Wall at Badaling', stations: ['badalingchangcheng'], maps: ['changcheng', 'stop-badalingchangcheng'] },
];

const byMap = new Map(HOODS.flatMap((h) => h.maps.map((m) => [m, h] as const)));
export const hoodOf = (map: string): Hood | undefined => byMap.get(map);

/** a shop, a room or a station hall: drawn as a card at its door, not as a piece of street */
export const isRoom = (map: string, inside: boolean) => inside || map.startsWith('station-');

export interface MapGeo {
  width: number;
  height: number;
  objects: readonly MapObject[];
  /** a shop or room (places.ts kind `inside`) */
  inside: boolean;
}

export interface LaidArea {
  map: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LaidRoom {
  map: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** the door on the street it opens onto, in plan tiles */
  door: readonly [number, number];
}

export interface LaidExit {
  /** the neighbourhood you walk into */
  hood: string;
  map: string;
  x: number;
  y: number;
  side: Facing;
}

export interface HoodLayout {
  id: string;
  /** the plan's extent, in tiles */
  x: number;
  y: number;
  w: number;
  h: number;
  areas: LaidArea[];
  rooms: LaidRoom[];
  exits: LaidExit[];
}

/** a room card on the plan, in tiles */
export const CARD: readonly [number, number] = [9, 6];
const GAP = 3;

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect, pad = 1) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** Where a door sits on its map: the side it is nearest to. */
function doorSide(tile: readonly [number, number], w: number, h: number): Facing {
  const [x, y] = tile;
  const d = { left: x, right: w - 1 - x, up: y, down: h - 1 - y };
  return (Object.keys(d) as Facing[]).reduce((a, b) => (d[b] < d[a] ? b : a));
}

/** Lays out one neighbourhood; `hoodOfMap` names the neighbourhood of any map (for exits). */
export function layoutHood(hood: Hood, geo: Record<string, MapGeo>, hoodOfMap: (m: string) => string | undefined = (m) => hoodOf(m)?.id): HoodLayout {
  const mine = new Set(hood.maps.filter((m) => geo[m]));
  const area = (m: string) => mine.has(m) && !isRoom(m, geo[m]!.inside);
  const placed = new Map<string, LaidArea>();
  const rooms: LaidRoom[] = [];
  const exits: LaidExit[] = [];
  const taken: Rect[] = [];

  const free = (r: Rect, side: Facing): Rect => {
    // slide outwards until nothing is in the way
    const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[side];
    const out = { ...r };
    for (let i = 0; i < 200 && taken.some((t) => overlaps(out, t)); i++) {
      out.x += step[0]!;
      out.y += step[1]!;
    }
    return out;
  };
  const put = (m: string, r: Rect, side: Facing | null) => {
    const at = side ? free(r, side) : r;
    const a = { map: m, ...at };
    placed.set(m, a);
    taken.push(at);
    return a;
  };

  const first = hood.maps.find(area);
  if (first) put(first, { x: 0, y: 0, w: geo[first]!.width, h: geo[first]!.height }, null);
  // areas, breadth first from the first: an edge joins two maps side by side, a door puts the other across the way
  const queue = first ? [first] : [];
  while (queue.length) {
    const m = queue.shift()!;
    const a = placed.get(m)!;
    for (const o of geo[m]!.objects) {
      const to = o.kind === 'edge' ? o.target.map : o.kind === 'door' ? o.to.map : null;
      if (!to || to === m || !area(to) || placed.has(to)) continue;
      const g = geo[to]!;
      let r: Rect;
      let side: Facing;
      if (o.kind === 'edge') {
        side = o.side;
        const off = o.target.offset;
        r =
          side === 'left'
            ? { x: a.x - g.width, y: a.y - off, w: g.width, h: g.height }
            : side === 'right'
              ? { x: a.x + a.w, y: a.y - off, w: g.width, h: g.height }
              : side === 'up'
                ? { x: a.x - off, y: a.y - g.height, w: g.width, h: g.height }
                : { x: a.x - off, y: a.y + a.h, w: g.width, h: g.height };
      } else if (o.kind === 'door') {
        side = doorSide(o.tile, a.w, a.h);
        const [dx, dy] = [a.x + o.tile[0], a.y + o.tile[1]];
        const [tx, ty] = o.to.tile;
        r =
          side === 'up'
            ? { x: dx - tx, y: a.y - g.height - GAP, w: g.width, h: g.height }
            : side === 'down'
              ? { x: dx - tx, y: a.y + a.h + GAP, w: g.width, h: g.height }
              : side === 'left'
                ? { x: a.x - g.width - GAP, y: dy - ty, w: g.width, h: g.height }
                : { x: a.x + a.w + GAP, y: dy - ty, w: g.width, h: g.height };
      } else continue;
      // an edge joins exactly; only a door's neighbour may be moved out of the way
      put(to, r, o.kind === 'door' ? side : null);
      queue.push(to);
    }
  }

  // rooms: a card across from the door that opens onto them
  for (const [m, a] of placed) {
    const seen = new Set<string>();
    for (const o of geo[m]!.objects) {
      if (o.kind !== 'door' || seen.has(o.to.map)) continue;
      seen.add(o.to.map);
      const to = o.to.map;
      if (!mine.has(to) || area(to)) continue;
      const side = doorSide(o.tile, a.w, a.h);
      const door = [a.x + o.tile[0], a.y + o.tile[1]] as const;
      const [cw, ch] = CARD;
      const r: Rect =
        side === 'up'
          ? { x: door[0] - Math.floor(cw / 2), y: a.y - ch - GAP, w: cw, h: ch }
          : side === 'down'
            ? { x: door[0] - Math.floor(cw / 2), y: a.y + a.h + GAP, w: cw, h: ch }
            : side === 'left'
              ? { x: a.x - cw - GAP, y: door[1] - Math.floor(ch / 2), w: cw, h: ch }
              : { x: a.x + a.w + GAP, y: door[1] - Math.floor(ch / 2), w: cw, h: ch };
      // cards along a street sit side by side: slide along it first, then outwards
      const along: Facing = side === 'up' || side === 'down' ? 'right' : 'down';
      let at = r;
      for (let i = 0; i < 40 && taken.some((t) => overlaps(at, t)); i++) at = { ...at, ...(along === 'right' ? { x: at.x + 1 } : { y: at.y + 1 }) };
      if (taken.some((t) => overlaps(at, t))) at = free(r, side);
      taken.push(at);
      rooms.push({ map: to, ...at, door });
    }
  }
  // rooms reached from rooms (none today) or from nowhere are still drawn, below everything
  for (const m of hood.maps) {
    if (!mine.has(m) || placed.has(m) || rooms.some((r) => r.map === m)) continue;
    const bottom = Math.max(0, ...taken.map((t) => t.y + t.h));
    const r = { x: 0, y: bottom + GAP, w: CARD[0], h: CARD[1] };
    const at = free(r, 'right');
    taken.push(at);
    rooms.push({ map: m, ...at, door: [at.x + CARD[0] / 2, at.y] });
  }

  // ways out on foot, into the next neighbourhood
  for (const [m, a] of placed) {
    for (const o of geo[m]!.objects) {
      const to = o.kind === 'edge' ? o.target.map : o.kind === 'door' ? o.to.map : null;
      if (!to || mine.has(to)) continue;
      const other = hoodOfMap(to);
      if (!other || exits.some((e) => e.hood === other && e.map === m)) continue;
      if (o.kind === 'edge') {
        const mid = (o.from + o.to) / 2;
        const side = o.side;
        const [x, y] = side === 'left' ? [a.x, a.y + mid] : side === 'right' ? [a.x + a.w, a.y + mid] : side === 'up' ? [a.x + mid, a.y] : [a.x + mid, a.y + a.h];
        exits.push({ hood: other, map: m, x, y, side });
      } else if (o.kind === 'door') {
        exits.push({ hood: other, map: m, x: a.x + o.tile[0], y: a.y + o.tile[1], side: doorSide(o.tile, a.w, a.h) });
      }
    }
  }

  const all = [...placed.values(), ...rooms];
  const x0 = Math.min(...all.map((r) => r.x));
  const y0 = Math.min(...all.map((r) => r.y));
  const x1 = Math.max(...all.map((r) => r.x + r.w));
  const y1 = Math.max(...all.map((r) => r.y + r.h));
  return { id: hood.id, x: x0, y: y0, w: x1 - x0, h: y1 - y0, areas: [...placed.values()], rooms, exits };
}

/** Where the hero is on a neighbourhood's plan: the tile on an area, or the middle of a room's card. */
export function heroOnPlan(l: HoodLayout, map: string, tile: readonly [number, number]): readonly [number, number] | null {
  const a = l.areas.find((x) => x.map === map);
  if (a) return [a.x + tile[0] + 0.5, a.y + tile[1] + 0.5];
  const r = l.rooms.find((x) => x.map === map);
  if (r) return [r.x + r.w / 2, r.y + r.h / 2];
  return null;
}

export type WayThere =
  | { kind: 'here' }
  | { kind: 'walk'; path: string[] }
  /** a ride from your neighbourhood's station to theirs, then on foot from the station you get off at */
  | { kind: 'ride'; from: string; to: string; text: string; fare: number; card: boolean; then: string[] | null }
  | { kind: 'none'; text: string };

/**
 * The way from where you stand to a map: on foot if doors and street ends
 * lead there, else by train from this neighbourhood's station to that one's
 * and on foot from there. `index` is public/world/maps/index.json.
 */
export function wayThere(s: WorldSave, to: string, index: MapLinks): WayThere {
  const here = s.place.map;
  if (here === to) return { kind: 'here' };
  const walk = walkPath(index, here, to);
  if (walk) return { kind: 'walk', path: walk };
  const from = hoodOf(here)?.stations[0];
  const dest = hoodOf(to)?.stations[0];
  if (!from || !dest) return { kind: 'none', text: 'No train goes there.' };
  const r = findRoute(from, dest);
  if (!r) return { kind: 'none', text: `No way there yet from ${station(from).zh}.` };
  const arrive = [`station-${dest}`, `stop-${dest}`].find((m) => index[m]);
  return { kind: 'ride', from, to: dest, text: `From ${station(from).zh}: ${routeText(r)}`, fare: r.fare, card: s.bag.card !== null, then: arrive ? walkPath(index, arrive, to) : null };
}
