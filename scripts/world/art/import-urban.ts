/**
 * The generic street things from Kenney's RPG Urban Pack (CC0, §13 V1),
 * cut from the pack's own tile sheet, put into the game's palette and
 * written as editable `.px` files beside our own props (a few letters
 * swapped per frame, `REMAP`):
 *
 *   content/world/art/sprites/props/urban.px       16×16 — bins, a bench, a hydrant, hedges, a crate, a barrier, traffic lights
 *   content/world/art/sprites/props/urban-tall.px  16×32 — street lamps, a bus-stop sign, trees (green, and gold ginkgo 银杏)
 *
 *   npx tsx scripts/world/art/import-urban.ts
 *
 * Beijing's own architecture stays ours (V2); only generic city things come
 * from the pack. The pack's original sheet and license are in
 * content/world/art/vendor/kenney-rpg-urban/.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { blank, decodePng, type Image } from './png';
import { recolour } from './recolour';

const SHEET = 'content/world/art/vendor/kenney-rpg-urban/tilemap_packed.png';
const OUT = 'content/world/art/sprites/props';

/** name → [column, row] of the top tile on the pack's packed sheet (16 px, no spacing) */
export const SMALL: Readonly<Record<string, readonly [number, number]>> = {
  'bin-red': [8, 9],
  'bin-grey': [9, 9],
  bench: [0, 10],
  hydrant: [8, 10],
  'veg-crate': [6, 10],
  crate: [5, 10],
  'hedge-l': [4, 12],
  'hedge-m': [5, 12],
  'hedge-r': [6, 12],
  barrier: [5, 8],
  'traffic-light': [3, 15],
  'traffic-light-2': [4, 15],
};
export const TALL: Readonly<Record<string, readonly [number, number]>> = {
  lamp: [2, 6],
  'lamp-t': [3, 6],
  'lamp-green': [7, 6],
  'bus-stop': [4, 6],
  'tree-round': [16, 8],
  'tree-small': [17, 8],
  'tree-ginkgo': [16, 11],
  'tree-ginkgo-small': [17, 11],
};

/**
 * Letters swapped after the recolour, per frame, so the pack's things sit
 * in our palette the way our own do: the pack's teal trees take our tree
 * greens and wood trunks; its autumn trees become gold — Beijing's ginkgo
 * 银杏 in autumn (V3's falling leaves).
 */
const GREEN_TREE: Record<string, string> = { v: 'g', h: 'G', x: 'h', L: 'z', R: 'M' };
const GINKGO: Record<string, string> = { O: 'y', r: 'Y', R: 'o', w: 'z', F: 'M', t: 'm' };
export const REMAP: Readonly<Record<string, Record<string, string>>> = {
  'tree-round': GREEN_TREE,
  'tree-small': GREEN_TREE,
  'tree-ginkgo': GINKGO,
  'tree-ginkgo-small': GINKGO,
};

function crop(img: Image, c: number, r: number, h: number): Image {
  const out = blank(16, 16 * h);
  for (let y = 0; y < 16 * h; y++) for (let x = 0; x < 16; x++) {
    const i = ((r * 16 + y) * img.width + c * 16 + x) * 4;
    out.data.set(img.data.subarray(i, i + 4), (y * 16 + x) * 4);
  }
  return out;
}

function pxOf(img: Image, picks: Readonly<Record<string, readonly [number, number]>>, h: number, note: string): string {
  const parts: string[] = [`# ${note}`, `size: 16x${16 * h}`];
  for (const [name, [c, r]] of Object.entries(picks)) {
    const map = REMAP[name] ?? {};
    const letters = recolour(crop(img, c, r, h)).letters.map((row) => [...row].map((k) => map[k] ?? k).join(''));
    // one frame: toPx cuts into 16-high cells, so take the letters whole
    parts.push(`frame: ${name}`, ...letters);
  }
  return parts.join('\n') + '\n';
}

export function importUrban(): void {
  const img = decodePng(readFileSync(SHEET));
  const note = 'from Kenney’s RPG Urban Pack (CC0, kenney.nl), recoloured to the game’s palette by scripts/world/art/import-urban.ts — edit freely';
  writeFileSync(`${OUT}/urban.px`, pxOf(img, SMALL, 1, note));
  writeFileSync(`${OUT}/urban-tall.px`, pxOf(img, TALL, 2, note));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) importUrban();
