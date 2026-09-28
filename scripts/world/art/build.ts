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
import { encodePng } from './png';
import { parsePx, render } from './px';

export const SPRITES = 'content/world/art/sprites';
export const OUT = 'public/world/art';

export function buildAtlas(dir: string, atlas: string): { png: Uint8Array; json: string; frames: number } {
  const items: Packable[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.px')).sort()) {
    const sprite = parsePx(readFileSync(join(dir, file), 'utf8'), basename(file, '.px'));
    for (const f of sprite.frames) items.push({ name: f.name, img: render(f, sprite.width, sprite.height) });
  }
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
    done.push(`${atlas}: ${r.frames} frames`);
  }
  return done;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  for (const line of buildAll()) console.log(line);
}
