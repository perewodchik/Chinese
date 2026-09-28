/**
 * `.px` — sprites and tiles written as text, one palette letter per pixel
 * (palette.ts), so art can be drawn, reviewed and diffed like code.
 *
 *   # the hero, 16×32, four directions
 *   size: 16x32
 *   frame: down-0
 *   ......kkkk......
 *   …                                  (exactly 32 rows of 16)
 *   frame: left-0 = mirror right-0     (flipped left to right)
 *   frame: down-2 = down-0             (the same pixels again)
 *   variant: auntie-blue r>n R>B       (every frame again, colours swapped)
 *
 * A frame is named `<file>/<frame>` in the atlas; a variant's frames are
 * `<variant>/<frame>`. Errors say the file and line.
 */

import { colourOf, PALETTE, TRANSPARENT } from './palette';
import { blank, type Image } from './png';

export interface PxFrame {
  name: string;
  /** rows of palette letters */
  rows: string[];
}

export interface PxSprite {
  name: string;
  width: number;
  height: number;
  frames: PxFrame[];
}

export class PxError extends Error {}

export function parsePx(text: string, name: string): PxSprite {
  const lines = text.split(/\r?\n/);
  let width = 0;
  let height = 0;
  const frames: PxFrame[] = [];
  const variants: Array<{ name: string; swap: Map<string, string>; line: number }> = [];
  let cur: PxFrame | null = null;
  let curLine = 0;
  const fail = (i: number, msg: string): never => {
    throw new PxError(`${name}.px:${i + 1}: ${msg}`);
  };
  const close = () => {
    const f = cur as PxFrame | null;
    if (f && f.rows.length !== height) fail(curLine, `frame "${f.name}" has ${f.rows.length} rows, not ${height}`);
    cur = null;
  };
  const find = (n: string, i: number) => frames.find((f) => f.name === n) ?? fail(i, `no frame "${n}" above this line`);

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const size = /^size:\s*(\d+)x(\d+)$/.exec(line);
    if (size) {
      if (frames.length) fail(i, 'size comes before the first frame');
      width = Number(size[1]);
      height = Number(size[2]);
      return;
    }
    const frame = /^frame:\s*([\w-]+)(?:\s*=\s*(mirror\s+)?([\w-]+))?$/.exec(line);
    if (frame) {
      close();
      if (!width) fail(i, 'size: WxH first');
      const [, fname, mirror, from] = frame;
      if (frames.some((f) => f.name === fname)) fail(i, `frame "${fname}" twice`);
      if (from) {
        const src = find(from, i);
        const rows = mirror ? src.rows.map((r) => [...r].reverse().join('')) : [...src.rows];
        frames.push({ name: fname!, rows });
        return;
      }
      cur = { name: fname!, rows: [] };
      curLine = i;
      frames.push(cur);
      return;
    }
    const variant = /^variant:\s*([\w-]+)((?:\s+\S>\S)+)$/.exec(line);
    if (variant) {
      close();
      const swap = new Map<string, string>();
      for (const pair of variant[2]!.trim().split(/\s+/)) {
        const [from, to] = pair.split('>') as [string, string];
        if (!PALETTE.has(from) || !PALETTE.has(to)) fail(i, `"${pair}": both sides must be palette letters`);
        swap.set(from, to);
      }
      variants.push({ name: variant[1]!, swap, line: i });
      return;
    }
    if (!cur) fail(i, `a row outside a frame: "${line}"`);
    const frameNow = cur as PxFrame;
    if ([...line].length !== width) fail(i, `row is ${[...line].length} wide, not ${width}`);
    for (const ch of line) if (ch !== TRANSPARENT && !PALETTE.has(ch)) fail(i, `"${ch}" is not a palette letter`);
    if (frameNow.rows.length >= height) fail(i, `frame "${frameNow.name}" has more than ${height} rows`);
    frameNow.rows.push(line);
  });
  close();
  if (!frames.length) throw new PxError(`${name}.px: no frames`);

  const out: PxFrame[] = frames.map((f) => ({ name: `${name}/${f.name}`, rows: f.rows }));
  for (const v of variants) {
    for (const f of frames) {
      out.push({ name: `${v.name}/${f.name}`, rows: f.rows.map((r) => [...r].map((c) => v.swap.get(c) ?? c).join('')) });
    }
  }
  return { name, width, height, frames: out };
}

/** A frame's pixels. */
export function render(frame: PxFrame, width: number, height: number): Image {
  const img = blank(width, height);
  frame.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = colourOf(ch);
      if (c) img.data.set(c, (y * width + x) * 4);
    }),
  );
  return img;
}
