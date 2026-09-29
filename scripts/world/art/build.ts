/**
 * Builds the game's art: every `.px` file under
 * `content/world/art/sprites/<atlas>/` into `public/world/art/<atlas>.png`
 * and `<atlas>.json` (Phaser's atlas format).
 *
 *   npx tsx scripts/world/art/build.ts
 *
 * The output is committed, so Vercel needs none of this. Deterministic: the
 * same sources always give the same bytes, so an unchanged atlas shows no diff.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pack, type Packable } from './pack';
import { blank, encodePng } from './png';
import { parsePx, render } from './px';
import { buildOutfitAtlas } from './outfit';

export const SPRITES = 'content/world/art/sprites';
export const OUT = 'public/world/art';

/**
 * The tiles also go out as a plain tileset — 16×16 cells, 8 across, no
 * padding, in the order they are written — because maps use Tiled's format,
 * which counts tiles by index in one image. `<atlas>-set.json` names each index.
 */
export interface TilesetJson {
  image: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  /** index → frame name; Tiled's gid is index + firstgid */
  names: string[];
}

export function buildTileset(items: Packable[], atlas: string, size = 16, columns = 8): { png: Uint8Array; json: string } {
  const rows = Math.ceil(items.length / columns);
  const img = blank(columns * size, rows * size);
  items.forEach((it, i) => {
    if (it.img.width !== size || it.img.height !== size) throw new Error(`${it.name}: a tile is ${size}×${size}`);
    const ox = (i % columns) * size;
    const oy = Math.floor(i / columns) * size;
    for (let y = 0; y < size; y++) img.data.set(it.img.data.subarray(y * size * 4, (y + 1) * size * 4), ((oy + y) * img.width + ox) * 4);
  });
  const json: TilesetJson = { image: `${atlas}-set.png`, tileWidth: size, tileHeight: size, columns, names: items.map((i) => i.name) };
  return { png: encodePng(img), json: JSON.stringify(json, null, 1) + '\n' };
}

function itemsOf(dir: string): Packable[] {
  const items: Packable[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.px')).sort()) {
    const sprite = parsePx(readFileSync(join(dir, file), 'utf8'), basename(file, '.px'));
    for (const f of sprite.frames) items.push({ name: f.name, img: render(f, sprite.width, sprite.height) });
  }
  return items;
}

export function buildAtlas(dir: string, atlas: string): { png: Uint8Array; json: string; frames: number } {
  const items = itemsOf(dir);
  const names = new Set<string>();
  for (const it of items) {
    if (names.has(it.name)) throw new Error(`${atlas}: frame ${it.name} comes from two files`);
    names.add(it.name);
  }
  const { png, json } = pack(items, `${atlas}.png`);
  return { png: encodePng(png), json: JSON.stringify(json, null, 1) + '\n', frames: items.length };
}

export function buildAll(src = SPRITES, out = OUT): string[] {
  if (!existsSync(src)) return [];
  mkdirSync(out, { recursive: true });
  const done: string[] = [];
  for (const atlas of readdirSync(src, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const r = buildAtlas(join(src, atlas), atlas);
    writeFileSync(join(out, `${atlas}.png`), r.png);
    writeFileSync(join(out, `${atlas}.json`), r.json);
    if (atlas === 'tiles') {
      const set = buildTileset(itemsOf(join(src, atlas)), atlas);
      // maps name tiles without their file: two files with the same tile name would hide one of them (§13 V2/V3)
      const bare = (JSON.parse(String(set.json)) as { names: string[] }).names.map((n) => n.replace(/^[^/]+\//, ''));
      const twice = bare.filter((n, i) => bare.indexOf(n) !== i);
      if (twice.length) throw new Error(`tile names used in two files: ${[...new Set(twice)].join(', ')}`);
      writeFileSync(join(out, `${atlas}-set.png`), set.png);
      writeFileSync(join(out, `${atlas}-set.json`), set.json);
    }
    done.push(`${atlas}: ${r.frames} frames`);
  }
  return done;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  for (const line of buildAll()) console.log(line);
  // the hero's layers (W1): drawn by code, not from .px files
  console.log(`outfit: ${buildOutfitAtlas()} strips`);
}
