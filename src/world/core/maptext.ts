/**
 * Maps written as text (prompt §6.1), so they can be authored and reviewed
 * without the Tiled GUI:
 *
 *   id: nanluo-main
 *   size: 40x24
 *   tilesets: tiles
 *   district: gulou
 *   crowd: 6          (optional: passers-by; also `pigeons:` and `bikes:`)
 *
 *   [ground]
 *   pppppppp…
 *   [below]
 *   ........
 *   [collide]        (optional: without it, whatever `below` draws blocks,
 *   ..##....          except the legend's walkable tiles, like a doorstep)
 *   [above]
 *   ........
 *
 * `legend.json` says which tile each character stands for, per layer; `.` is
 * always empty. Pure: the build script and the tests both use it.
 */

export const LAYERS = ['ground', 'below', 'above'] as const;
export type LayerName = (typeof LAYERS)[number];

export interface Legend {
  ground: Record<string, string>;
  below: Record<string, string>;
  above: Record<string, string>;
  /** tiles in `below` that can be walked on (doorsteps, steps, bridges) */
  walkable?: string[];
}

export interface TextMap {
  id: string;
  width: number;
  height: number;
  tilesets: string[];
  district: string;
  /** tile name per cell, '' for empty, row by row */
  layers: Record<LayerName, string[]>;
  /** 1 blocked, row by row */
  collide: Uint8Array;
  /** street life: passers-by, pigeons and cyclists at a time (header `crowd: 6` …) */
  life: MapLife;
}

export interface MapLife {
  crowd: number;
  pigeons: number;
  bikes: number;
}

export class MapError extends Error {}

export function parseMap(text: string, legend: Legend, file = 'map'): TextMap {
  const lines = text.split(/\r?\n/);
  const head: Record<string, string> = {};
  const sections: Record<string, Array<{ row: string; line: number }>> = {};
  let section: string | null = null;
  const fail = (i: number, msg: string): never => {
    throw new MapError(`${file}:${i + 1}: ${msg}`);
  };
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '');
    if (!line || (line.startsWith('#') && section === null)) return;
    const sec = /^\[(\w+)\]$/.exec(line);
    if (sec) {
      section = sec[1]!;
      if (![...LAYERS, 'collide'].includes(section)) fail(i, `unknown layer [${section}]`);
      if (sections[section]) fail(i, `[${section}] twice`);
      sections[section] = [];
      return;
    }
    if (section === null) {
      const kv = /^(\w+):\s*(.+)$/.exec(line);
      if (!kv) fail(i, `expected "key: value" before the first layer, got "${line}"`);
      head[kv![1]!] = kv![2]!.trim();
      return;
    }
    sections[section]!.push({ row: line, line: i });
  });
  const size = /^(\d+)x(\d+)$/.exec(head.size ?? '');
  if (!head.id) throw new MapError(`${file}: no id`);
  if (!size) throw new MapError(`${file}: size: WxH is missing`);
  const width = Number(size[1]);
  const height = Number(size[2]);
  const layers = {} as Record<LayerName, string[]>;
  for (const name of LAYERS) {
    const rows = sections[name];
    const cells = new Array<string>(width * height).fill('');
    if (!rows) {
      if (name === 'ground') throw new MapError(`${file}: no [ground] layer`);
      layers[name] = cells;
      continue;
    }
    if (rows.length !== height) throw new MapError(`${file}: [${name}] has ${rows.length} rows, not ${height}`);
    rows.forEach(({ row, line }, y) => {
      const chars = [...row];
      if (chars.length !== width) fail(line, `[${name}] row is ${chars.length} wide, not ${width}`);
      chars.forEach((ch, x) => {
        if (ch === '.') return;
        const tile = legend[name][ch];
        if (!tile) fail(line, `[${name}] "${ch}" is not in the legend`);
        cells[y * width + x] = tile!;
      });
    });
    layers[name] = cells;
  }
  const collide = new Uint8Array(width * height);
  const rows = sections.collide;
  if (rows) {
    if (rows.length !== height) throw new MapError(`${file}: [collide] has ${rows.length} rows, not ${height}`);
    rows.forEach(({ row, line }, y) => {
      if ([...row].length !== width) fail(line, `[collide] row is ${[...row].length} wide, not ${width}`);
      [...row].forEach((ch, x) => {
        if (ch !== '.' && ch !== '#') fail(line, `[collide] "${ch}": use # for blocked and . for free`);
        collide[y * width + x] = ch === '#' ? 1 : 0;
      });
    });
  } else {
    const walk = new Set(legend.walkable ?? []);
    layers.below.forEach((t, i) => {
      collide[i] = t && !walk.has(t) ? 1 : 0;
    });
  }
  return {
    id: head.id,
    width,
    height,
    tilesets: (head.tilesets ?? 'tiles').split(/[\s,]+/).filter(Boolean),
    district: head.district ?? '',
    life: { crowd: Number(head.crowd ?? 0) || 0, pigeons: Number(head.pigeons ?? 0) || 0, bikes: Number(head.bikes ?? 0) || 0 },
    layers,
    collide,
  };
}
