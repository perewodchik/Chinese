/**
 * Frames into one atlas image, and the frame map Phaser reads
 * (`this.load.atlas(key, png, json)` — the JSON-hash format).
 *
 * Shelf packing: frames sorted tallest first, laid left to right in rows no
 * wider than `maxWidth`, one pixel of transparent padding between them so no
 * neighbour bleeds in when the canvas scales.
 */

import { blank, type Image } from './png';

export interface Packable {
  name: string;
  img: Image;
}

export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: false;
  trimmed: false;
  spriteSourceSize: { x: 0; y: 0; w: number; h: number };
  sourceSize: { w: number; h: number };
}

export interface AtlasJson {
  frames: Record<string, AtlasFrame>;
  meta: { app: string; image: string; size: { w: number; h: number }; scale: '1'; format: 'RGBA8888' };
}

const PAD = 1;

export function pack(items: Packable[], image: string, maxWidth = 512): { png: Image; json: AtlasJson } {
  const sorted = [...items].sort((a, b) => b.img.height - a.img.height || a.name.localeCompare(b.name));
  const placed: Array<{ it: Packable; x: number; y: number }> = [];
  let x = PAD;
  let y = PAD;
  let shelf = 0;
  let width = 0;
  for (const it of sorted) {
    if (it.img.width + 2 * PAD > maxWidth) throw new Error(`${it.name} is wider than the atlas`);
    if (x + it.img.width + PAD > maxWidth) {
      x = PAD;
      y += shelf + PAD;
      shelf = 0;
    }
    placed.push({ it, x, y });
    x += it.img.width + PAD;
    shelf = Math.max(shelf, it.img.height);
    width = Math.max(width, x);
  }
  const height = y + shelf + PAD;
  // Powers of two are kindest to older GPUs.
  const pow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));
  const png = blank(pow2(width), pow2(height));
  const frames: Record<string, AtlasFrame> = {};
  for (const { it, x: px, y: py } of placed) {
    for (let row = 0; row < it.img.height; row++) {
      const src = it.img.data.subarray(row * it.img.width * 4, (row + 1) * it.img.width * 4);
      png.data.set(src, ((py + row) * png.width + px) * 4);
    }
    const w = it.img.width;
    const h = it.img.height;
    frames[it.name] = {
      frame: { x: px, y: py, w, h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize: { w, h },
    };
  }
  const ordered = Object.fromEntries(Object.entries(frames).sort(([a], [b]) => a.localeCompare(b)));
  return {
    png,
    json: { frames: ordered, meta: { app: 'zouzou art build', image, size: { w: png.width, h: png.height }, scale: '1', format: 'RGBA8888' } },
  };
}
