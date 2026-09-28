/**
 * A built map (Tiled JSON from scripts/world/build-maps.ts) read into what the
 * game needs besides pictures: the walk grid for core/grid.ts, the objects,
 * the district. Pure — the scene and the tests both use it.
 */

import { gridFromLayer, type Grid } from '../core/grid';
import type { MapObject } from '../core/types';

export interface MapInfo {
  id: string;
  width: number;
  height: number;
  district: string;
  grid: Grid;
  objects: MapObject[];
}

interface TiledLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: Array<{ properties?: Array<{ name: string; value: string }> }>;
}

interface TiledJson {
  width: number;
  height: number;
  layers: TiledLayer[];
  properties?: Array<{ name: string; value: string }>;
}

export function readMap(id: string, json: unknown): MapInfo {
  const t = json as TiledJson;
  const collide = t.layers.find((l) => l.name === 'collide')?.data ?? [];
  const objects = (t.layers.find((l) => l.name === 'objects')?.objects ?? []).flatMap((o) => {
    const data = o.properties?.find((p) => p.name === 'data');
    return data ? [JSON.parse(data.value) as MapObject] : [];
  });
  return {
    id,
    width: t.width,
    height: t.height,
    district: t.properties?.find((p) => p.name === 'district')?.value ?? '',
    grid: gridFromLayer(t.width, t.height, (x, y) => (collide[y * t.width + x] ?? 1) !== 0),
    objects,
  };
}

/** Tiles people stand on, which block walking but move — passed to each search. */
export function occupiedBy(objects: readonly MapObject[]): Set<string> {
  const out = new Set<string>();
  for (const o of objects) if (o.kind === 'npc') out.add(`${o.tile[0]},${o.tile[1]}`);
  return out;
}
