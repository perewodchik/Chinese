/**
 * A review strip of some frames of a built atlas, by name prefix, scaled up
 * on a soft ground (§13 V4: the spirits, the woodcuts).
 *
 *   npx tsx scripts/world/art/frames-sheet.ts <atlas> <out.png> <scale> <prefix> [prefix …]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { blank, decodePng, encodePng, type Image } from './png';

export function framesSheet(atlas: string, prefixes: readonly string[], k = 4): Image {
  const img = decodePng(readFileSync(`public/world/art/${atlas}.png`));
  const j = JSON.parse(readFileSync(`public/world/art/${atlas}.json`, 'utf8')).frames as Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  const names = Object.keys(j).filter((n) => prefixes.some((p) => n.startsWith(p)));
  const pad = 4;
  const W = names.reduce((w, n) => w + j[n]!.frame.w * k + pad, pad);
  const H = Math.max(...names.map((n) => j[n]!.frame.h)) * k + 2 * pad;
  const out = blank(W, H);
  for (let i = 0; i < out.data.length; i += 4) out.data.set([214, 206, 184, 255], i);
  let x0 = pad;
  for (const n of names) {
    const f = j[n]!.frame;
    for (let y = 0; y < f.h * k; y++)
      for (let x = 0; x < f.w * k; x++) {
        const i = ((f.y + Math.floor(y / k)) * img.width + f.x + Math.floor(x / k)) * 4;
        const a = img.data[i + 3]! / 255;
        if (!a) continue;
        const o = ((pad + y) * W + x0 + x) * 4;
        for (let c = 0; c < 3; c++) out.data[o + c] = Math.round(img.data[i + c]! * a + out.data[o + c]! * (1 - a));
      }
    x0 += f.w * k + pad;
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [atlas = 'props', out = 'sheet.png', scale = '4', ...prefixes] = process.argv.slice(2);
  writeFileSync(out, encodePng(framesSheet(atlas, prefixes, Number(scale))));
  console.log(out);
}
