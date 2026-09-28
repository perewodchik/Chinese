/**
 * A contact sheet of an atlas for review: every frame scaled up on a soft
 * checker, in name order.
 *
 *   npx tsx scripts/world/art/sheet.ts <atlas> <out.png> [scale]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { AtlasJson } from './pack';
import { blank, decodePng, encodePng, type Image } from './png';

export function sheet(atlas: Image, json: AtlasJson, scale = 4, perRow = 12): Image {
  const frames = Object.entries(json.frames);
  const cellW = Math.max(...frames.map(([, f]) => f.frame.w)) * scale + 8;
  const cellH = Math.max(...frames.map(([, f]) => f.frame.h)) * scale + 8;
  const cols = Math.min(perRow, frames.length);
  const rows = Math.ceil(frames.length / cols);
  const out = blank(cols * cellW, rows * cellH);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const v = ((x >> 3) + (y >> 3)) % 2 ? 214 : 226;
      out.data.set([v, v + 6, v - 4, 255], (y * out.width + x) * 4);
    }
  }
  frames.forEach(([, f], i) => {
    const ox = (i % cols) * cellW + 4;
    const oy = Math.floor(i / cols) * cellH + 4;
    for (let y = 0; y < f.frame.h * scale; y++) {
      for (let x = 0; x < f.frame.w * scale; x++) {
        const si = ((f.frame.y + Math.floor(y / scale)) * atlas.width + f.frame.x + Math.floor(x / scale)) * 4;
        const a = atlas.data[si + 3]! / 255;
        if (!a) continue;
        const di = ((oy + y) * out.width + ox + x) * 4;
        for (let k = 0; k < 3; k++) out.data[di + k] = Math.round(atlas.data[si + k]! * a + out.data[di + k]! * (1 - a));
      }
    }
  });
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [name, out, scale] = process.argv.slice(2);
  const atlas = decodePng(readFileSync(`public/world/art/${name}.png`));
  const json = JSON.parse(readFileSync(`public/world/art/${name}.json`, 'utf8')) as AtlasJson;
  writeFileSync(out!, encodePng(sheet(atlas, json, Number(scale ?? 4))));
}
