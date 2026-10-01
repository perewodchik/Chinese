/**
 * Compiles the text maps in `content/world/maps/` into Tiled's JSON map
 * format in `public/world/maps/` (prompt §6.1), so the engine loads them with
 * Phaser's Tiled loader and the learner could open them in Tiled.
 *
 *   npx tsx scripts/world/build-maps.ts
 *
 * Checks as it goes: sizes, characters not in the legend, tiles not in the
 * tileset, objects off the map, doors to maps or tiles that do not exist or
 * are blocked, people and props standing in walls.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mapObjectSchema } from '../../src/world/core/content';
import { LAYERS, parseMap, type Legend, type TextMap } from '../../src/world/core/maptext';
import type { MapObject } from '../../src/world/core/types';
import { HOODS, layoutHood, type MapGeo } from '../../src/world/core/hoods';
import { placeOf } from '../../src/world/core/places';
import { writeStamps } from './stamps';
import type { TilesetJson } from './art/build';

export const MAPS_SRC = 'content/world/maps';
export const MAPS_OUT = 'public/world/maps';
const TILESET = 'public/world/art/tiles-set.json';

export interface Compiled {
  map: TextMap;
  objects: MapObject[];
}

export interface TiledMap {
  type: 'map';
  version: string;
  tiledversion: string;
  orientation: 'orthogonal';
  renderorder: 'right-down';
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  infinite: false;
  nextlayerid: number;
  nextobjectid: number;
  tilesets: Array<Record<string, unknown>>;
  layers: Array<Record<string, unknown>>;
  properties: Array<{ name: string; type: 'string'; value: string }>;
}

/** Tiled's JSON for one map. Tile names become gids (index in the tileset + 1). */
export function toTiled(c: Compiled, set: TilesetJson): TiledMap {
  const gid = new Map(set.names.map((n, i) => [n.replace(/^[^/]+\//, ''), i + 1]));
  const { map } = c;
  const layer = (id: number, name: string, data: number[], visible = true) => ({
    type: 'tilelayer', id, name, x: 0, y: 0, width: map.width, height: map.height, opacity: 1, visible, data,
  });
  const layers: Array<Record<string, unknown>> = LAYERS.map((name, i) =>
    layer(i + 1, name, map.layers[name].map((t) => (t ? gid.get(t)! : 0))),
  );
  layers.push(layer(4, 'collide', [...map.collide].map((b) => (b ? 1 : 0)), false));
  const rows = Math.ceil(set.names.length / set.columns);
  layers.push({
    type: 'objectgroup', id: 5, name: 'objects', x: 0, y: 0, opacity: 1, visible: true, draworder: 'index',
    objects: c.objects.map((o, i) => {
      const tile = 'tile' in o ? o.tile : [0, 0];
      return {
        id: i + 1, name: o.id, type: o.kind, x: tile[0] * set.tileWidth, y: tile[1] * set.tileHeight,
        width: set.tileWidth, height: set.tileHeight, rotation: 0, visible: true,
        properties: [{ name: 'data', type: 'string', value: JSON.stringify(o) }],
      };
    }),
  });
  return {
    type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down',
    width: map.width, height: map.height, tilewidth: set.tileWidth, tileheight: set.tileHeight, infinite: false,
    nextlayerid: 6, nextobjectid: c.objects.length + 1,
    tilesets: [{
      firstgid: 1, name: 'tiles', image: `../art/${set.image}`, imagewidth: set.columns * set.tileWidth,
      imageheight: rows * set.tileHeight, tilewidth: set.tileWidth, tileheight: set.tileHeight,
      tilecount: set.names.length, columns: set.columns, margin: 0, spacing: 0,
    }],
    layers,
    properties: [
      { name: 'district', type: 'string', value: map.district },
      { name: 'life', type: 'string', value: JSON.stringify(map.life) },
    ],
  };
}

const blocked = (m: TextMap, [x, y]: readonly [number, number]) => m.collide[y * m.width + x] === 1;
const inside = (m: TextMap, [x, y]: readonly [number, number]) => x >= 0 && y >= 0 && x < m.width && y < m.height;

/** What is wrong across all maps: objects, doors, tiles missing from the tileset. */
export function checkMaps(all: Compiled[], set: TilesetJson): string[] {
  const errors: string[] = [];
  const names = new Set(set.names.map((n) => n.replace(/^[^/]+\//, '')));
  const byId = new Map(all.map((c) => [c.map.id, c.map]));
  for (const { map, objects } of all) {
    for (const l of LAYERS) for (const t of new Set(map.layers[l])) if (t && !names.has(t)) errors.push(`${map.id}: [${l}] tile "${t}" is not in the tileset`);
    const ids = new Set<string>();
    for (const o of objects) {
      const at = `${map.id}.objects ${o.id}`;
      if (ids.has(o.id)) errors.push(`${at}: id used twice`);
      ids.add(o.id);
      if ('tile' in o && !inside(map, o.tile)) {
        errors.push(`${at}: tile ${o.tile.join(',')} is off the map`);
        continue;
      }
      if (o.kind === 'door') {
        const to = byId.get(o.to.map);
        if (!to) errors.push(`${at}: door to unknown map "${o.to.map}"`);
        else if (!inside(to, o.to.tile)) errors.push(`${at}: door lands off ${o.to.map}`);
        else if (blocked(to, o.to.tile)) errors.push(`${at}: door lands on a blocked tile of ${o.to.map}`);
      }
      if (o.kind === 'edge') {
        const to = byId.get(o.target.map);
        if (!to) errors.push(`${at}: edge to unknown map "${o.target.map}"`);
        else {
          // §13 T1/T5: every tile of the exit is on the edge and open, and lands on an open tile of the next map
          for (let along = o.from; along <= o.to; along++) {
            const side = o.side;
            const here: [number, number] = side === 'left' ? [0, along] : side === 'right' ? [map.width - 1, along] : side === 'up' ? [along, 0] : [along, map.height - 1];
            const there: [number, number] =
              side === 'left' ? [to.width - 1, along + o.target.offset] : side === 'right' ? [0, along + o.target.offset] : side === 'up' ? [along + o.target.offset, to.height - 1] : [along + o.target.offset, 0];
            if (!inside(map, here) || blocked(map, here)) errors.push(`${at}: the exit's tile ${here.join(',')} is blocked`);
            else if (!inside(to, there) || blocked(to, there)) errors.push(`${at}: leads onto ${there.join(',')} of ${to.id}, which is blocked or off the map`);
          }
        }
      }
      if (o.kind === 'npc' && blocked(map, o.tile)) errors.push(`${at}: ${o.npc} stands on a blocked tile`);
    }
    for (const run of deadEnds(map, objects)) errors.push(`${map.id}: open ground runs off the map at ${run} and leads nowhere — make it an edge to the next map, or close it (a wall, a gate)`);
  }
  return errors;
}

/**
 * MH1 (the learner, 2026-10-01: "this kind of map should never exist"): every open tile on a map's
 * border must be part of an exit (an edge, or a door on it). Open ground that runs off the map and
 * goes nowhere looks like a road you can take and isn't. Returns each such run, like `left 12–14`.
 */
export function deadEnds(map: Compiled['map'], objects: readonly MapObject[]): string[] {
  const out: string[] = [];
  const exits = objects.filter((o): o is Extract<MapObject, { kind: 'edge' }> => o.kind === 'edge');
  const doors = new Set(objects.flatMap((o) => (o.kind === 'door' ? [o.tile.join(',')] : [])));
  // a corner belongs to two sides: an exit on either covers it
  const onExit = (e: Extract<MapObject, { kind: 'edge' }>, [x, y]: [number, number]) =>
    e.side === 'left' ? x === 0 && y >= e.from && y <= e.to : e.side === 'right' ? x === map.width - 1 && y >= e.from && y <= e.to : e.side === 'up' ? y === 0 && x >= e.from && x <= e.to : y === map.height - 1 && x >= e.from && x <= e.to;
  const sides = [
    ['up', map.width, (i: number) => [i, 0]],
    ['down', map.width, (i: number) => [i, map.height - 1]],
    ['left', map.height, (i: number) => [0, i]],
    ['right', map.height, (i: number) => [map.width - 1, i]],
  ] as const;
  for (const [side, n, tileAt] of sides) {
    let start = -1;
    const close = (end: number) => {
      if (start >= 0) out.push(`${side} ${start === end ? start : `${start}–${end}`}`);
      start = -1;
    };
    for (let i = 0; i < n; i++) {
      const t = tileAt(i) as [number, number];
      const open = !blocked(map, t) && !doors.has(t.join(',')) && !exits.some((e) => onExit(e, t));
      if (open && start < 0) start = i;
      if (!open) close(i - 1);
    }
    close(n - 1);
  }
  return out;
}

export function loadAll(src = MAPS_SRC): Compiled[] {
  if (!existsSync(join(src, 'legend.json'))) return [];
  const legend = JSON.parse(readFileSync(join(src, 'legend.json'), 'utf8')) as Legend;
  const out: Compiled[] = [];
  for (const f of readdirSync(src).filter((f) => f.endsWith('.map.txt')).sort()) {
    const map = parseMap(readFileSync(join(src, f), 'utf8'), legend, f);
    const objFile = join(src, f.replace('.map.txt', '.objects.json'));
    const raw = existsSync(objFile) ? (JSON.parse(readFileSync(objFile, 'utf8')) as unknown[]) : [];
    const objects = raw.map((o, i) => {
      const r = mapObjectSchema.safeParse(o);
      if (!r.success) throw new Error(`${objFile}[${i}]: ${r.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
      return r.data;
    });
    // A prop's footprint blocks the tiles it stands on.
    for (const o of objects) {
      if (o.kind !== 'prop' || !o.blocks) continue;
      const [w, h] = o.blocks;
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        const x = o.tile[0] + dx;
        const y = o.tile[1] - dy;
        if (x >= 0 && y >= 0 && x < map.width && y < map.height) map.collide[y * map.width + x] = 1;
      }
    }
    out.push({ map, objects });
  }
  return out;
}

export function buildMaps(src = MAPS_SRC, out = MAPS_OUT, tileset = TILESET): string[] {
  const all = loadAll(src);
  if (!all.length) return [];
  const set = JSON.parse(readFileSync(tileset, 'utf8')) as TilesetJson;
  const errors = checkMaps(all, set);
  if (errors.length) throw new Error(errors.join('\n'));
  mkdirSync(out, { recursive: true });
  for (const c of all) writeFileSync(join(out, `${c.map.id}.json`), JSON.stringify(toTiled(c, set)) + '\n');
  // The list the game checks a saved place against, so a save never points at a map this build lacks.
  // `links`: the maps a door or an edge of this one leads to — the city map's walking routes.
  const linksOf = (c: (typeof all)[number]) =>
    [...new Set(c.objects.flatMap((o) => (o.kind === 'door' ? [o.to.map] : o.kind === 'edge' ? [o.target.map] : [])))].filter((m) => m !== c.map.id).sort();
  // a door marked `oneWay` leads out only (神武门): the route finder does not walk back through it
  const oneWayOf = (c: (typeof all)[number]) => [...new Set(c.objects.flatMap((o) => (o.kind === 'door' && o.oneWay ? [o.to.map] : [])))].sort();
  const index = Object.fromEntries(
    all.map((c) => [c.map.id, { district: c.map.district, width: c.map.width, height: c.map.height, links: linksOf(c), ...(oneWayOf(c).length ? { oneWay: oneWayOf(c) } : {}) }]),
  );
  writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  // the neighbourhood plans (core/hoods.ts) for the minimap and the 🗺 panel
  const geo: Record<string, MapGeo> = Object.fromEntries(
    all.map((c) => [c.map.id, { width: c.map.width, height: c.map.height, objects: c.objects, inside: placeOf(c.map.id)?.kind === 'inside' }]),
  );
  writeFileSync(join(out, 'hoods.json'), JSON.stringify(HOODS.map((h) => layoutHood(h, geo))) + '\n');
  // the plans load hoods.json and the miniatures by a content hash (M8)
  if (out === MAPS_OUT) writeStamps();
  return all.map((c) => `${c.map.id}: ${c.map.width}×${c.map.height}, ${c.objects.length} objects`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    for (const line of buildMaps()) console.log(line);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
