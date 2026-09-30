/**
 * The miniatures of every map for the minimap and the 🗺 panel (prompt
 * §9⅞ M1): each map drawn whole by the game's own rules (render-map.ts, by
 * day, no hero), then shrunk by averaging — streets and parks to 4 pixels a
 * tile, so a neighbourhood plan is the world in small; shops, rooms and
 * station halls to 8, as the pictures on their cards.
 *
 *   npx tsx scripts/world/build-minis.ts      → public/world/minis/<map>.png
 *
 * Then it stamps them (stamps.ts): src/world/ui/stamps.gen.ts holds a content hash of each,
 * which the plans put on the image URLs.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isRoom } from '../../src/world/core/hoods';
import { placeOf } from '../../src/world/core/places';
import { blank, encodePng, type Image } from './art/png';
import { drawWorld } from './render-map';
import { writeStamps } from './stamps';

const OUT = 'public/world/minis';

/** every `k`×`k` block of pixels as its average */
export function shrink(img: Image, k: number): Image {
  const w = Math.floor(img.width / k);
  const h = Math.floor(img.height / k);
  const out = blank(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sum = [0, 0, 0, 0];
      for (let j = 0; j < k; j++)
        for (let i = 0; i < k; i++) {
          const si = ((y * k + j) * img.width + x * k + i) * 4;
          for (let c = 0; c < 4; c++) sum[c]! += img.data[si + c]!;
        }
      out.data.set(
        sum.map((v) => Math.round(v / (k * k))),
        (y * w + x) * 4,
      );
    }
  return out;
}

export function buildMinis(out = OUT): string[] {
  const index = JSON.parse(readFileSync('public/world/maps/index.json', 'utf8')) as Record<string, unknown>;
  mkdirSync(out, { recursive: true });
  const done: string[] = [];
  for (const map of Object.keys(index)) {
    if (map.endsWith('-proto')) continue;
    const room = isRoom(map, placeOf(map)?.kind === 'inside');
    const img = shrink(drawWorld(map, 'day', null), room ? 2 : 4);
    writeFileSync(join(out, `${map}.png`), encodePng(img));
    done.push(`${map}: ${img.width}×${img.height}`);
  }
  if (out === OUT) writeStamps();
  return done;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  for (const line of buildMinis()) console.log(line);
}
