/**
 * Puts an imported picture into the game's palette, so tiles from different
 * free packs look like one game (concept §12). Every pixel becomes the
 * nearest palette colour; pixels less than half opaque become transparent.
 *
 *   npx tsx scripts/world/art/recolour.ts in.png out.png [--px out.px]
 *
 * With `--px` it also writes the picture as a `.px` file (one frame per
 * 16×16 cell, named r<row>c<col>), ready to edit by hand.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { nearest, PALETTE, TRANSPARENT } from './palette';
import { blank, decodePng, encodePng, type Image } from './png';

export function recolour(img: Image, alphaCut = 128): { img: Image; letters: string[] } {
  const out = blank(img.width, img.height);
  const letters: string[] = [];
  const cache = new Map<number, string>();
  for (let y = 0; y < img.height; y++) {
    let row = '';
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const a = img.data[i + 3]!;
      if (a < alphaCut) {
        row += TRANSPARENT;
        continue;
      }
      const key = (img.data[i]! << 16) | (img.data[i + 1]! << 8) | img.data[i + 2]!;
      let k = cache.get(key);
      if (!k) {
        k = nearest([img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, 255]);
        cache.set(key, k);
      }
      row += k;
      out.data.set(PALETTE.get(k)!, i);
    }
    letters.push(row);
  }
  return { img: out, letters };
}

/** The letters as a `.px` file cut into cells. */
export function toPx(letters: string[], cell = 16, note = ''): string {
  const h = letters.length;
  const w = letters[0]?.length ?? 0;
  const out = [`# ${note}`.trimEnd(), `size: ${cell}x${cell}`];
  for (let r = 0; r * cell < h; r++) {
    for (let c = 0; c * cell < w; c++) {
      const rows = letters.slice(r * cell, (r + 1) * cell).map((l) => l.slice(c * cell, (c + 1) * cell).padEnd(cell, TRANSPARENT));
      while (rows.length < cell) rows.push(TRANSPARENT.repeat(cell));
      if (rows.every((l) => /^\.+$/.test(l))) continue;
      out.push(`frame: r${r}c${c}`, ...rows);
    }
  }
  return out.join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [input, output, flag, pxPath] = process.argv.slice(2);
  if (!input || !output) {
    console.error('usage: recolour.ts in.png out.png [--px out.px]');
    process.exit(2);
  }
  const r = recolour(decodePng(readFileSync(input)));
  writeFileSync(output, encodePng(r.img));
  if (flag === '--px' && pxPath) writeFileSync(pxPath, toPx(r.letters, 16, `recoloured from ${basename(input)}`));
}
