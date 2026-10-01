/**
 * Draws a built map to a PNG without a browser, by the same rules as the
 * engine's scene (src/world/engine/scene.ts): ground, below, then props and
 * people sorted by where their feet are, then above; the time of day's tint
 * multiplied over it and the lamps' glow added on top; integer zoom.
 *
 * For review screenshots when no browser is at hand, and for the /play
 * card's banner (one picture per part of the day).
 *
 *   npx tsx scripts/world/render-map.ts <map> <WxH> <time> <out.png> [heroX,heroY] [focusX,focusY]
 */

import { existsSync, globSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { looksOf } from '../../src/world/core/cast';
import { holds } from '../../src/world/core/flags';
import { newSave } from '../../src/world/core/save';
import type { MapObject, NpcCard, PartOfDay, Tile } from '../../src/world/core/types';
import { DAY_LOOK, zoomFor } from '../../src/world/engine/look';
import { heroFrame, toRgba, type WornOutfit } from '../../src/world/art/hero';
import type { HeroLook } from '../../src/world/core/looks';
import type { AtlasJson } from './art/pack';
import { blank, decodePng, encodePng, type Image } from './art/png';

const T = 16;
const FRESH = newSave('render', 0);
const read = (p: string) => readFileSync(p);

interface Sheet {
  img: Image;
  json: AtlasJson;
}

const sheet = (name: string): Sheet => ({
  img: decodePng(read(`public/world/art/${name}.png`)),
  json: JSON.parse(readFileSync(`public/world/art/${name}.json`, 'utf8')) as AtlasJson,
});

function blit(dst: Image, src: Image, sx: number, sy: number, w: number, h: number, dx: number, dy: number) {
  for (let y = 0; y < h; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < w; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const si = ((sy + y) * src.width + sx + x) * 4;
      const a = src.data[si + 3]! / 255;
      if (!a) continue;
      const di = (ty * dst.width + tx) * 4;
      for (let k = 0; k < 3; k++) dst.data[di + k] = Math.round(src.data[si + k]! * a + dst.data[di + k]! * (1 - a));
      dst.data[di + 3] = 255;
    }
  }
}

function frame(dst: Image, s: Sheet, name: string, x: number, y: number) {
  const f = s.json.frames[name];
  if (!f) throw new Error(`no frame ${name}`);
  // origin (0, 1): x, y is the bottom-left foot
  blit(dst, s.img, f.frame.x, f.frame.y, f.frame.w, f.frame.h, x, y - f.frame.h);
}

/** The player as they look (W1): their own look and clothes instead of the atlas's plain hero. */
export interface Me {
  look: HeroLook;
  worn: WornOutfit;
}

export function renderMap(mapId: string, width: number, height: number, time: PartOfDay, hero: Tile, focus: Tile = hero, me?: Me): Image {
  const world = drawWorld(mapId, time, hero, me);
  const W = world.width;
  const H = world.height;
  // the camera: integer zoom, centred on the hero, clamped to the map
  const zoom = zoomFor(width, height);
  const vw = Math.ceil(width / zoom);
  const vh = Math.ceil(height / zoom);
  const fx = focus[0] * T;
  const fy = (focus[1] + 1) * T;
  const cx = Math.max(0, Math.min(W - vw, Math.round(fx + 8 - vw / 2)));
  const cy = Math.max(0, Math.min(H - vh, Math.round(fy - 16 - vh / 2)));
  const out = blank(width, height);
  for (let i = 0; i < out.data.length; i += 4) out.data.set([34, 32, 46, 255], i);
  const offX = W < vw ? Math.floor((vw - W) / 2) : 0;
  const offY = H < vh ? Math.floor((vh - H) / 2) : 0;
  for (let y = 0; y < height; y++) {
    const wy = Math.floor(y / zoom) + (H < vh ? -offY : cy);
    if (wy < 0 || wy >= H) continue;
    for (let x = 0; x < width; x++) {
      const wx = Math.floor(x / zoom) + (W < vw ? -offX : cx);
      if (wx < 0 || wx >= W) continue;
      const si = (wy * W + wx) * 4;
      out.data.set(world.data.subarray(si, si + 4), (y * width + x) * 4);
    }
  }
  return out;
}

/** The whole map at one pixel per pixel (16 per tile), without a camera; no hero when `hero` is null (the city map's miniatures). */
export function drawWorld(mapId: string, time: PartOfDay, hero: Tile | null, me?: Me): Image {
  const look = DAY_LOOK[time];
  // RENDER_MAP_FILE renders another build of the map (a before/after pair from git, §13 T5)
  const map = JSON.parse(readFileSync(process.env.RENDER_MAP_FILE ?? `public/world/maps/${mapId}.json`, 'utf8'));
  const names = (JSON.parse(readFileSync('public/world/art/tiles-set.json', 'utf8')).names as string[]).map((n) => n.replace(/^[^/]+\//, ''));
  const set = decodePng(read('public/world/art/tiles-set.png'));
  const chars = sheet('chars');
  // people are drawn with their card's look, as the game does (core/cast.ts)
  const looks: Record<string, string> = {};
  for (const id of existsSync('public/world/content/index.json') ? (JSON.parse(readFileSync('public/world/content/index.json', 'utf8')) as string[]) : []) {
    Object.assign(looks, looksOf(JSON.parse(readFileSync(`public/world/content/${id}.json`, 'utf8')).npcs as NpcCard[]));
  }
  // a person added since the last content build: their card in the source files (thumbnails come before content)
  for (const f of globSync('content/world/*/npcs.json')) for (const [id, l] of Object.entries(looksOf(JSON.parse(readFileSync(f, 'utf8')) as NpcCard[]))) looks[id] ??= l;
  const props = sheet('props');
  const W = map.width * T;
  const H = map.height * T;
  const world = blank(W, H);
  const layer = (name: string) => map.layers.find((l: { name: string }) => l.name === name).data as number[];
  const swap = (gid: number) => {
    if (!look.lit || !gid) return gid;
    const n = names[gid - 1];
    if (n === 'window') return names.indexOf('window-lit') + 1;
    if (n === 'shop') return names.indexOf('shop-lit') + 1;
    return gid;
  };
  const tiles = (name: string) =>
    layer(name).forEach((gid, i) => {
      const g = swap(gid);
      if (!g) return;
      const sx = ((g - 1) % 8) * T;
      const sy = Math.floor((g - 1) / 8) * T;
      blit(world, set, sx, sy, T, T, (i % map.width) * T, Math.floor(i / map.width) * T);
    });
  tiles('ground');
  tiles('below');

  const objects = (map.layers.find((l: { name: string }) => l.name === 'objects').objects as Array<{ properties: Array<{ value: string }> }>).map(
    (o) => JSON.parse(o.properties[0]!.value) as MapObject,
  );
  const glows: Array<{ x: number; y: number; r: number; c: [number, number, number] }> = [];
  const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  const draws: Array<{ y: number; draw: () => void }> = [];
  for (const o of objects) {
    // what a fresh game shows: a prop that is only there later (the broken lantern) is left out
    if (o.kind === 'prop' && o.when && !holds(o.when, FRESH)) continue;
    if (o.kind === 'prop') {
      const x = o.tile[0] * T;
      const y = (o.tile[1] + 1) * T;
      const name = look.lit && o.frame === 'lantern/unlit' ? 'lantern/lit-0' : look.lit && o.night ? o.night : o.frame;
      draws.push({ y, draw: () => frame(world, props, name, x, y) });
      if (look.lit && o.light) {
        const f = props.json.frames[name]!.frame;
        glows.push({ x: x + f.w / 2, y: y - f.h / 2, r: 28, c: hex(o.light) });
      }
    } else if (o.kind === 'npc') {
      const x = o.tile[0] * T;
      const y = (o.tile[1] + 1) * T;
      draws.push({ y, draw: () => frame(world, chars, `${looks[o.npc] ?? o.npc}/${o.facing ?? 'down'}-0`, x, y + 3) });
    } else if (o.kind === 'light' && look.lit) {
      glows.push({ x: o.tile[0] * T + 8, y: o.tile[1] * T + 8, r: o.radius ?? 32, c: hex(o.color ?? '#fff1b3') });
    }
  }
  if (hero) {
    const hx = hero[0] * T;
    const hy = (hero[1] + 1) * T;
    if (me) {
      // the same composer the game uses (src/world/art/hero.ts)
      const img: Image = { width: 16, height: 32, data: new Uint8Array(toRgba(heroFrame(me.look, me.worn, 'down', 0)).buffer) };
      draws.push({ y: hy + 0.5, draw: () => blit(world, img, 0, 0, 16, 32, hx, hy + 3 - 32) });
    } else draws.push({ y: hy + 0.5, draw: () => frame(world, chars, 'hero/down-0', hx, hy + 3) });
    draws.push({ y: hy + 0.6, draw: () => frame(world, chars, 'rabbit/down-0', hx + 12, hy - 18) });
  }
  draws.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
  tiles('above');
  if (look.lit) {
    layer('below').forEach((gid, i) => {
      const n = names[swap(gid) - 1];
      if (n === 'window-lit' || n === 'shop-lit') glows.push({ x: (i % map.width) * T + 8, y: Math.floor(i / map.width) * T + 10, r: 16, c: [255, 217, 138] });
    });
  }

  // tint (multiply), then glows (add)
  const tr = (look.tint >> 16) & 255;
  const tg = (look.tint >> 8) & 255;
  const tb = look.tint & 255;
  for (let i = 0; i < world.data.length; i += 4) {
    world.data[i] = Math.round((world.data[i]! * tr) / 255);
    world.data[i + 1] = Math.round((world.data[i + 1]! * tg) / 255);
    world.data[i + 2] = Math.round((world.data[i + 2]! * tb) / 255);
  }
  for (const g of glows) {
    for (let y = Math.floor(g.y - g.r); y < g.y + g.r; y++) {
      for (let x = Math.floor(g.x - g.r); x < g.x + g.r; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const d = Math.hypot(x - g.x, y - g.y) / g.r;
        if (d >= 1) continue;
        const a = (d < 0.35 ? 0.85 - (d / 0.35) * 0.5 : 0.35 * (1 - (d - 0.35) / 0.65)) * look.glow;
        const i = (y * W + x) * 4;
        for (let k = 0; k < 3; k++) world.data[i + k] = Math.min(255, world.data[i + k]! + Math.round(g.c[k]! * a));
      }
    }
  }

  return world;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [map, size, time, out, at, look] = process.argv.slice(2);
  const [w, h] = size!.split('x').map(Number) as [number, number];
  const hero = (at ?? '0,0').split(',').map(Number) as unknown as Tile;
  const focus = look ? (look.split(',').map(Number) as unknown as Tile) : hero;
  writeFileSync(out!, encodePng(renderMap(map!, w, h, time as PartOfDay, hero, focus)));
}
