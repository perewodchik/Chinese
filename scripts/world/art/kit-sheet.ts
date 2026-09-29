/**
 * The review sheet of the Beijing kit (§13 V2): the modules put together as
 * the maps will — a hall in each glaze (grey with gable ends, green, yellow
 * with its ridge beasts, blue), a double-eaved hall, a stretch of
 * north–south street, and every kit prop — on a paving ground.
 *
 *   npx tsx scripts/world/art/kit-sheet.ts [out.png] [scale]
 */

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { colourOf } from './palette';
import { blank, encodePng, type Image } from './png';
import type { Grid } from './gen/grid';
import { KIT_TILES } from './gen/kit';
import { KIT_PROPS } from './gen/kit-props';
import { paving, road } from './gen/tiles';

const T = 16;
const kit = new Map(KIT_TILES.map(([n, f]) => [n, f()]));
const get = (n: string) => {
  const g = kit.get(n);
  if (!g) throw new Error(`no kit tile ${n}`);
  return g;
};

function draw(img: Image, g: Grid, x0: number, y0: number, scale: number) {
  const rows = g.lines();
  rows.forEach((row, y) =>
    [...row].forEach((k, x) => {
      if (k === '.') return;
      const c = colourOf(k);
      if (!c) return;
      const a = c[3] / 255;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const px = (x0 + x) * scale + dx;
          const py = (y0 + y) * scale + dy;
          if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
          const i = (py * img.width + px) * 4;
          for (let j = 0; j < 3; j++) img.data[i + j] = Math.round(c[j]! * a + img.data[i + j]! * (1 - a));
          img.data[i + 3] = 255;
        }
    }),
  );
}

/** A hall `w` tiles wide at tile (tx, ty): ridge, upper slope, slope, eave, then faces. */
function hall(img: Image, glaze: string, tx: number, ty: number, w: number, faces: string[], scale: number) {
  const rows = ['ridge', 'up', 'slope', 'eave'];
  rows.forEach((r, j) => {
    for (let i = 0; i < w; i++) {
      const n = `roof-${glaze}-${r}${i === 0 ? '-l' : i === w - 1 ? '-r' : ''}`;
      draw(img, get(n), (tx + i) * T, (ty + j) * T, scale);
    }
  });
  faces.forEach((row, j) => {
    const names = row.split(' ');
    for (let i = 0; i < w; i++) draw(img, get(names[i % names.length]!), (tx + i) * T, (ty + rows.length + j) * T, scale);
  });
}

export function kitSheet(scale = 3): Image {
  const W = 44;
  const H = 30;
  const img = blank(W * T * scale, H * T * scale);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) draw(img, x >= 30 && x <= 33 ? road(3) : paving(1 + ((x * 7 + y * 3) % 5)), x * T, y * T, scale);
  const temple = ['beam-xuanzi', 'face-pillar face-lattice face-lattice face-pillar face-lattice face-lattice face-pillar'];
  hall(img, 'grey', 1, 1, 5, ['beam-xuanzi', 'face-red face-lattice face-red face-lattice face-red'], scale);
  hall(img, 'green', 7, 1, 7, temple, scale);
  hall(img, 'yellow', 15, 1, 9, ['beam-xuanzi', 'face-pillar face-lattice face-studs face-studs-r face-lattice face-pillar face-lattice face-lattice face-pillar'], scale);
  hall(img, 'blue', 1, 9, 5, ['beam-su', 'face-pillar face-lattice face-lattice face-lattice face-pillar'], scale);
  // 重檐: a double-eaved hall — a small roof over a painted band over a wide roof
  hall(img, 'yellow', 9, 9, 5, ['beam-xuanzi'], scale);
  hall(img, 'yellow', 8, 14, 7, ['beam-xuanzi', 'face-pillar face-lattice face-studs face-studs-r face-lattice face-lattice face-pillar'], scale);
  draw(img, get('danbi'), 11 * T, 20 * T, scale);
  // a north–south street: houses and walls on both sides of the road
  for (let y = 1; y < 22; y++) {
    const house = y % 7 < 4;
    draw(img, get(house ? (y % 7 === 1 ? 'side-roof-ridge' : 'side-roof') : 'side-wall-w'), 28 * T, y * T, scale);
    draw(img, get(house ? 'side-roof-eave-w' : 'side-wall-w'), 29 * T, y * T, scale);
    draw(img, get(!house ? 'side-roof-eave-e' : 'side-wall-e'), 34 * T, y * T, scale);
    draw(img, get(!house ? (y % 7 === 5 ? 'side-roof-ridge' : 'side-roof') : 'side-wall-e'), 35 * T, y * T, scale);
  }
  // the props, in a row along the bottom (their foot on the row's line)
  let px = 1 * T;
  let py = 26 * T;
  for (const [, , frames] of KIT_PROPS) {
    for (const [, g] of frames().slice(0, 1)) {
      if (px + g.w > (W - 1) * T) {
        px = 1 * T;
        py += 4 * T;
      }
      draw(img, g, px, py - g.h, scale);
      px += g.w + 6;
    }
  }
  return img;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const out = process.argv[2] ?? 'docs/world-game/review/v/kit.png';
  writeFileSync(out, encodePng(kitSheet(Number(process.argv[3] ?? 3))));
  console.log(out);
}
