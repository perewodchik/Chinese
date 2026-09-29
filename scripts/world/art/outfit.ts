/**
 * The hero's layers as art files (W1):
 *
 *   - `public/world/art/outfit.png/json` — the `outfit` atlas: every layer on
 *     its own as a strip of its thirteen frames (`outfit/<layer>`): the two
 *     builds in each skin tone, every face part, every hair style in every
 *     colour, every garment in every colour `clothes.json` gives it, on both
 *     builds. The game composes from the same pixel code
 *     (`src/world/art/hero.ts`); the atlas is what the checks and the review
 *     sheets read, and what a person can look through to see every piece.
 *   - `docs/world-game/review/w/*.png` — contact sheets of whole figures (`--review`).
 *
 *   npx tsx scripts/world/art/outfit.ts [--review]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Grid } from '../../../src/world/art/grid';
import { DEFAULT_WORN, FRAME_NAMES, GARMENT_ART, heroFrames, layerFrame, toRgba, type Dir, type Layer, type WornOutfit } from '../../../src/world/art/hero';
import { BROWS, BUILDS, DEFAULT_LOOK, EYES, HAIR_COLOURS, HAIR_STYLES, MOUTHS, SKINS, type HeroLook } from '../../../src/world/core/looks';
import { pack, type Packable } from './pack';
import { blank, encodePng, type Image } from './png';

export const CLOTHES = 'content/world/clothes.json';

/** Every garment id with each of its colours' palettes: from clothes.json when it is there, else one test colour each. */
export function garmentColours(root = '.'): Array<{ id: string; colour: string; palette: string }> {
  const p = `${root}/${CLOTHES}`;
  if (existsSync(p)) {
    const c = JSON.parse(readFileSync(p, 'utf8')) as { clothes: Array<{ id: string; colours: Array<{ id: string; palette: string }> }> };
    return c.clothes.flatMap((x) => x.colours.map((k) => ({ id: x.id, colour: k.id, palette: k.palette })));
  }
  return Object.keys(GARMENT_ART).map((id) => ({ id, colour: 'test', palette: 'nBrR' }));
}

/** A grid as RGBA. */
export function toImage(g: Grid): Image {
  return { width: g.w, height: g.h, data: new Uint8Array(toRgba(g).buffer) };
}

/** Frames of 16×32 side by side. */
function strip(frames: Grid[]): Image {
  const out = blank(16 * frames.length, 32);
  frames.forEach((g, i) => {
    const img = toImage(g);
    for (let y = 0; y < 32; y++) out.data.set(img.data.subarray(y * 64, (y + 1) * 64), (y * out.width + i * 16) * 4);
  });
  return out;
}

/** frame name → how it is drawn */
export const FRAME_POSES: Array<{ name: string; dir: Dir; step: number; closed: boolean; mirror: boolean }> = FRAME_NAMES.map((name) => {
  const [d, s] = name.split('-') as [string, string];
  return {
    name,
    dir: (d === 'right' ? 'left' : d) as Dir,
    step: s === '1' ? 1 : s === '2' ? -1 : 0,
    closed: s === 'blink',
    mirror: d === 'right',
  };
});

/** One layer's thirteen frames. */
export function layerStrip(layer: Layer, look: HeroLook, worn: WornOutfit): Grid[] {
  return FRAME_POSES.map((f) => {
    const g = layerFrame(layer, look, worn, f.dir, f.step, f.closed);
    return f.mirror ? g.mirror() : g;
  });
}

/** Every strip of the atlas, by name (without the `outfit/` prefix), as grids. */
export function outfitStrips(root = '.'): Array<[string, Grid[]]> {
  const out: Array<[string, Grid[]]> = [];
  for (const build of BUILDS) for (let skin = 0; skin < SKINS; skin++) out.push([`body-${build}-${skin}`, layerStrip('body', { ...DEFAULT_LOOK, build, skin }, {})]);
  for (const eyes of EYES) out.push([`eyes-${eyes}`, layerStrip('face', { ...DEFAULT_LOOK, face: { eyes, brows: 'none', mouth: 'line' } }, {})]);
  for (const brows of BROWS) out.push([`brows-${brows}`, layerStrip('face', { ...DEFAULT_LOOK, face: { eyes: 'dot', brows, mouth: 'line' } }, {})]);
  for (const mouth of MOUTHS) out.push([`mouth-${mouth}`, layerStrip('face', { ...DEFAULT_LOOK, face: { eyes: 'dot', brows: 'none', mouth } }, {})]);
  for (const style of HAIR_STYLES) {
    for (const colour of HAIR_COLOURS) {
      const look = { ...DEFAULT_LOOK, hair: { style, colour } };
      const front = layerStrip('hair', look, {});
      const back = layerStrip('hairBack', look, {});
      out.push([`hair-${style}-${colour}`, front.map((g, i) => new Grid(16, 32).stamp(back[i]!, 0, 0).stamp(g, 0, 0))]);
    }
  }
  for (const { id, colour, palette } of garmentColours(root)) {
    const art = GARMENT_ART[id];
    if (!art) continue;
    for (const build of BUILDS) out.push([`${id}-${colour}-${build}`, layerStrip(art.slot as Layer, { ...DEFAULT_LOOK, build }, { [art.slot]: { art: id, palette } })]);
  }
  return out;
}

export function buildOutfitAtlas(root = '.', out = 'public/world/art'): number {
  const items: Packable[] = outfitStrips(root).map(([name, frames]) => ({ name: `outfit/${name}`, img: strip(frames) }));
  const { png, json } = pack(items, 'outfit.png', 1024);
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/outfit.png`, encodePng(png));
  writeFileSync(`${out}/outfit.json`, JSON.stringify(json, null, 1) + '\n');
  return items.length;
}

/** A sheet of whole figures: one row per look, the thirteen frames across, scaled up on a light checker. */
export function figureSheet(rows: Array<{ look: HeroLook; worn: WornOutfit }>, scale = 4): Image {
  const cellW = 16 * scale + 4;
  const cellH = 32 * scale + 4;
  const out = blank(cellW * 13, cellH * rows.length);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const v = ((x >> 3) + (y >> 3)) % 2 ? 214 : 226;
      out.data.set([v, v + 6, v - 4, 255], (y * out.width + x) * 4);
    }
  }
  rows.forEach((r, j) => {
    heroFrames(r.look, r.worn).forEach(([, g], i) => {
      const img = toImage(g);
      for (let y = 0; y < 32 * scale; y++) {
        for (let x = 0; x < 16 * scale; x++) {
          const si = (Math.floor(y / scale) * 16 + Math.floor(x / scale)) * 4;
          const a = img.data[si + 3]! / 255;
          if (!a) continue;
          const di = ((j * cellH + 2 + y) * out.width + i * cellW + 2 + x) * 4;
          for (let k = 0; k < 3; k++) out.data[di + k] = Math.round(img.data[si + k]! * a + out.data[di + k]! * (1 - a));
        }
      }
    });
  });
  return out;
}

/** The review sheets: the creator's looks, and every garment in every colour on both builds (`docs/world-game/review/w/`). */
export function reviewSheets(root = '.', dir = 'docs/world-game/review/w'): string[] {
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  const looks: Array<{ look: HeroLook; worn: WornOutfit }> = [{ look: DEFAULT_LOOK, worn: DEFAULT_WORN }];
  HAIR_STYLES.forEach((style, i) =>
    looks.push({
      look: {
        ...DEFAULT_LOOK,
        build: i % 2 ? 'slim' : 'broad',
        skin: i % SKINS,
        face: { eyes: EYES[i % EYES.length]!, brows: BROWS[i % BROWS.length]!, mouth: MOUTHS[i % MOUTHS.length]! },
        hair: { style, colour: HAIR_COLOURS[i % HAIR_COLOURS.length]! },
      },
      worn: DEFAULT_WORN,
    }),
  );
  writeFileSync(`${dir}/looks.png`, encodePng(figureSheet(looks)));
  written.push(`${dir}/looks.png`);
  // every garment, each colour on the broad and the slim build, over today's clothes
  const all = garmentColours(root).filter((g) => GARMENT_ART[g.id]);
  for (let i = 0; i < all.length; i += 12) {
    const rows = all.slice(i, i + 12).flatMap(({ id, palette }) =>
      (['broad', 'slim'] as const).map((build, b) => ({
        look: { ...DEFAULT_LOOK, build, skin: (i + b) % SKINS, hair: { style: HAIR_STYLES[(i + b) % HAIR_STYLES.length]!, colour: 'black' as const } },
        worn: { ...DEFAULT_WORN, [GARMENT_ART[id]!.slot]: { art: id, palette } },
      })),
    );
    const name = `${dir}/garments-${String(i / 12 + 1).padStart(2, '0')}.png`;
    writeFileSync(name, encodePng(figureSheet(rows, 3)));
    written.push(name);
  }
  return written;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  console.log(`outfit: ${buildOutfitAtlas()} strips`);
  if (process.argv.includes('--review')) console.log(reviewSheets().join('\n'));
}
