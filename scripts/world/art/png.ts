/**
 * Just enough PNG to build the game's art without a dependency: write RGBA,
 * and read the common kinds (RGBA, RGB, grey, palette; 8-bit, palette also
 * 1/2/4-bit; not interlaced) so imported packs can be recoloured.
 */

import { deflateSync, inflateSync } from 'node:zlib';

export interface Image {
  width: number;
  height: number;
  /** RGBA, row by row */
  data: Uint8Array;
}

export function blank(width: number, height: number): Image {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

export function encodePng(img: Image): Uint8Array {
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, img.width);
  v.setUint32(4, img.height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = img.width * 4;
  const raw = new Uint8Array((stride + 1) * img.height);
  for (let y = 0; y < img.height; y++) raw.set(img.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const parts = [SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

export function decodePng(bytes: Uint8Array): Image {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) throw new Error('not a PNG');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 8;
  let width = 0;
  let height = 0;
  let depth = 8;
  let type = 6;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (at < bytes.length) {
    const len = view.getUint32(at);
    const name = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + len);
    if (name === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      depth = body[8]!;
      type = body[9]!;
      if (body[12] !== 0) throw new Error('interlaced PNGs are not supported');
    } else if (name === 'PLTE') palette = body;
    else if (name === 'tRNS') trns = body;
    else if (name === 'IDAT') idat.push(body);
    else if (name === 'IEND') break;
    at += 12 + len;
  }
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[type];
  if (!channels) throw new Error(`PNG colour type ${type} is not supported`);
  if (depth !== 8 && !(type === 3 && [1, 2, 4].includes(depth))) throw new Error(`PNG bit depth ${depth} is not supported`);
  const joined = new Uint8Array(idat.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of idat) {
    joined.set(p, o);
    o += p.length;
  }
  const raw = inflateSync(joined);
  const bpp = Math.max(1, (channels * depth) / 8);
  const stride = Math.ceil((width * channels * depth) / 8);
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]!;
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = rows.subarray(y * stride, (y + 1) * stride);
    const up = y ? rows.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp]! : 0;
      const b = up ? up[x]! : 0;
      const c = up && x >= bpp ? up[x - bpp]! : 0;
      const s = src[x]!;
      row[x] = (f === 0 ? s : f === 1 ? s + a : f === 2 ? s + b : f === 3 ? s + ((a + b) >> 1) : s + paeth(a, b, c)) & 0xff;
    }
  }
  const img = blank(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = (y * width + x) * 4;
      const r = rows.subarray(y * stride, (y + 1) * stride);
      if (type === 3) {
        const perByte = 8 / depth;
        const byte = r[Math.floor(x / perByte)]!;
        const shift = (perByte - 1 - (x % perByte)) * depth;
        const idx = (byte >> shift) & ((1 << depth) - 1);
        img.data[d] = palette![idx * 3]!;
        img.data[d + 1] = palette![idx * 3 + 1]!;
        img.data[d + 2] = palette![idx * 3 + 2]!;
        img.data[d + 3] = trns && idx < trns.length ? trns[idx]! : 255;
      } else {
        const p = r.subarray(x * channels, x * channels + channels);
        const [c0, c1, c2, c3] = [p[0]!, p[1] ?? 0, p[2] ?? 0, p[3] ?? 255];
        if (type === 0) img.data.set([c0, c0, c0, 255], d);
        else if (type === 4) img.data.set([c0, c0, c0, c1], d);
        else if (type === 2) img.data.set([c0, c1, c2, 255], d);
        else img.data.set([c0, c1, c2, c3], d);
      }
    }
  }
  return img;
}
