#!/usr/bin/env node
/**
 * A photo of a comic's page, made to look like a scan — for /add-text, before
 * the page goes into its chapter with `npm run texts -- put`.
 *
 *   node scripts/texts/page.mjs grid <photo> <out.jpg> [--turn 90|180|270]
 *       the photo turned upright, with a grid every 100 px and its size, to
 *       read the corners off
 *   node scripts/texts/page.mjs fix <photo> <out.jpg> --turn 90 --corners x,y x,y x,y x,y
 *                                  [--ratio 1.40] [--margin 0.03,0.03,0.05,0.03]
 *       the page cut out, squared up and evened out
 *
 * `--corners` are the outer corners of the page's panels, all its panels
 * together — top left, top right, bottom right, bottom left — in pixels of the
 * upright photo the grid shows. Those lines were printed straight, so pulling
 * them square undoes the angle the photo was taken at. Around them goes a
 * margin (fractions of the width: top, right, bottom, left) that keeps the
 * book's own margin, captions outside the panels and the page number.
 *
 * Every page of a book comes out the same: 1400 px wide, the panels' block at
 * `--ratio` (height over width; measure it on the first page, then pass the
 * same number for the rest), the same margins. The colour is evened out the
 * same way each time: the white of the paper and the bubbles is made neutral
 * white, the darkest ink near black, a little colour and sharpness back.
 *
 * The decoding and drawing is Chromium's, as in art/render.mjs, so it runs
 * wherever Playwright does: on the Mac and in a cloud session alike.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const WIDTH = 1400;
const USAGE = 'node scripts/texts/page.mjs grid|fix <photo> <out.jpg> [--turn 90] [--corners x,y x,y x,y x,y] [--ratio 1.4] [--margin t,r,b,l]';

const [command, input, output, ...rest] = process.argv.slice(2);
if (!['grid', 'fix'].includes(command) || !input || !output) {
  console.error(USAGE);
  process.exit(1);
}
const opt = {};
for (let i = 0; i < rest.length; i++) {
  const k = rest[i];
  if (k === '--turn') opt.turn = Number(rest[++i]);
  else if (k === '--ratio') opt.ratio = Number(rest[++i]);
  else if (k === '--margin') opt.margin = rest[++i].split(',').map(Number);
  else if (k === '--corners') {
    opt.corners = [];
    while (rest[i + 1] && !rest[i + 1].startsWith('--')) opt.corners.push(rest[++i].split(',').map(Number));
  } else {
    console.error(`What is ${k}?\n${USAGE}`);
    process.exit(1);
  }
}
const turn = opt.turn ?? 0;
if (![0, 90, 180, 270].includes(turn)) throw new Error('--turn is 90, 180 or 270: degrees clockwise.');
if (command === 'fix' && (opt.corners?.length !== 4 || opt.corners.some((c) => c.length !== 2 || c.some((n) => !Number.isFinite(n))))) {
  throw new Error('--corners takes four x,y points: top left, top right, bottom right, bottom left.');
}

const mime = { '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic' }[extname(input).toLowerCase()] ?? 'image/jpeg';
const photo = `data:${mime};base64,${readFileSync(input).toString('base64')}`;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
try {
  const page = await browser.newPage();
  const result = await page.evaluate(work, { command, photo, turn, corners: opt.corners, ratio: opt.ratio, margin: opt.margin ?? [0.03, 0.03, 0.05, 0.03], width: WIDTH });
  writeFileSync(output, Buffer.from(result.jpeg.split(',')[1], 'base64'));
  console.log(`  ${output}: ${result.w}×${result.h}${result.note ? ` · ${result.note}` : ''}`);
} finally {
  await browser.close();
}

/** Runs in the page: everything from decoding the photo to the finished JPEG. */
async function work({ command, photo, turn, corners, ratio, margin, width }) {
  const img = new Image();
  img.src = photo;
  await img.decode();
  // Upright first: the browser has already applied the camera's orientation tag.
  const side = turn % 180 !== 0;
  const up = document.createElement('canvas');
  up.width = side ? img.naturalHeight : img.naturalWidth;
  up.height = side ? img.naturalWidth : img.naturalHeight;
  const u = up.getContext('2d');
  u.translate(up.width / 2, up.height / 2);
  u.rotate((turn * Math.PI) / 180);
  u.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  u.setTransform(1, 0, 0, 1, 0, 0);

  if (command === 'grid') {
    u.lineWidth = Math.max(2, up.width / 800);
    u.font = `${Math.round(up.width / 60)}px sans-serif`;
    for (let x = 0; x < up.width; x += 100) {
      u.strokeStyle = x % 500 ? 'rgba(0,0,255,.7)' : 'rgba(255,0,0,.9)';
      u.beginPath(), u.moveTo(x, 0), u.lineTo(x, up.height), u.stroke();
      if (x % 500 === 0) (u.fillStyle = 'red'), u.fillText(String(x), x + 4, 30);
    }
    for (let y = 0; y < up.height; y += 100) {
      u.strokeStyle = y % 500 ? 'rgba(0,0,255,.7)' : 'rgba(255,0,0,.9)';
      u.beginPath(), u.moveTo(0, y), u.lineTo(up.width, y), u.stroke();
      if (y % 500 === 0) (u.fillStyle = 'red'), u.fillText(String(y), 4, y - 4);
    }
    return { jpeg: up.toDataURL('image/jpeg', 0.85), w: up.width, h: up.height };
  }

  const [tl, tr, br, bl] = corners;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const measured = (dist(tl, bl) + dist(tr, br)) / (dist(tl, tr) + dist(bl, br));
  const r = ratio || measured;
  const [mt, mr, mb, ml] = margin.map((m) => Math.round(m * width));
  const fw = width - ml - mr;
  const fh = Math.round(fw * r);
  const W = width;
  const H = fh + mt + mb;

  // The homography from the output's frame to the photo's corners.
  const dst = [[ml, mt], [ml + fw, mt], [ml + fw, mt + fh], [ml, mt + fh]];
  const A = [];
  const B = [];
  dst.forEach(([x, y], k) => {
    const [X, Y] = corners[k];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]), B.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]), B.push(Y);
  });
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r2 = c + 1; r2 < 8; r2++) if (Math.abs(A[r2][c]) > Math.abs(A[p][c])) p = r2;
    [A[c], A[p]] = [A[p], A[c]];
    [B[c], B[p]] = [B[p], B[c]];
    for (let r2 = 0; r2 < 8; r2++) {
      if (r2 === c) continue;
      const f = A[r2][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r2][k] -= f * A[c][k];
      B[r2] -= f * B[c];
    }
  }
  const h = B.map((b, c) => b / A[c][c]);

  const src = u.getImageData(0, 0, up.width, up.height).data;
  const sw = up.width;
  const sh = up.height;
  const out = new Float32Array(W * H * 3);
  const outside = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = h[6] * x + h[7] * y + 1;
      let X = (h[0] * x + h[1] * y + h[2]) / d;
      let Y = (h[3] * x + h[4] * y + h[5]) / d;
      const o = (y * W + x) * 3;
      // Past the photo's edge: the nearest edge stretched out, which on a
      // black page stays black where white paper would show as a stripe.
      if (X < 0 || Y < 0 || X > sw - 2 || Y > sh - 2) {
        outside[y * W + x] = 1;
        X = Math.min(Math.max(X, 0), sw - 2);
        Y = Math.min(Math.max(Y, 0), sh - 2);
      }
      const x0 = X | 0;
      const y0 = Y | 0;
      const fx = X - x0;
      const fy = Y - y0;
      const i = (y0 * sw + x0) * 4;
      const j = i + sw * 4;
      for (let c = 0; c < 3; c++) {
        out[o + c] = (src[i + c] * (1 - fx) + src[i + 4 + c] * fx) * (1 - fy) + (src[j + c] * (1 - fx) + src[j + 4 + c] * fx) * fy;
      }
    }
  }

  // Even out the light: the paper's white (the bright end, by channel) made
  // neutral, the darkest ink pulled toward black.
  const lum = [];
  for (let p = 0; p < W * H; p += 7) if (!outside[p]) lum.push(0.3 * out[p * 3] + 0.59 * out[p * 3 + 1] + 0.11 * out[p * 3 + 2]);
  lum.sort((a, b) => a - b);
  const hiL = lum[Math.floor(lum.length * 0.985)];
  const loL = lum[Math.floor(lum.length * 0.004)];
  const white = [0, 0, 0];
  let n = 0;
  for (let p = 0; p < W * H; p += 3) {
    if (outside[p]) continue;
    const l = 0.3 * out[p * 3] + 0.59 * out[p * 3 + 1] + 0.11 * out[p * 3 + 2];
    if (l >= hiL) for (let c = 0; c < 3; c++) white[c] += out[p * 3 + c], n++;
  }
  for (let c = 0; c < 3; c++) white[c] /= n / 3;
  const black = Math.min(loL, 60);
  const target = 246;
  const sat = 1.1;
  const res = new Uint8ClampedArray(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    const o = p * 3;
    let rgb = [0, 1, 2].map((c) => ((out[o + c] * (255 / white[c]) - black) / (255 - black)) * target);
    const l = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2];
    rgb = rgb.map((v) => l + (v - l) * sat);
    res[p * 4] = rgb[0];
    res[p * 4 + 1] = rgb[1];
    res[p * 4 + 2] = rgb[2];
    res[p * 4 + 3] = 255;
  }

  // Sharpness back after the resampling: an unsharp mask, small radius.
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(res, W, H), 0, 0);
  const blur = document.createElement('canvas');
  blur.width = W;
  blur.height = H;
  const b = blur.getContext('2d');
  b.filter = 'blur(1.2px)';
  b.drawImage(canvas, 0, 0);
  const soft = b.getImageData(0, 0, W, H).data;
  const amount = 0.7;
  for (let k = 0; k < res.length; k += 4) for (let c = 0; c < 3; c++) res[k + c] = res[k + c] + (res[k + c] - soft[k + c]) * amount;
  ctx.putImageData(new ImageData(res, W, H), 0, 0);

  const lost = outside.reduce((s, v) => s + v, 0) / (W * H);
  const note = [`ratio ${r.toFixed(3)}${ratio ? '' : ' (measured; pass it as --ratio for the next pages)'}`, lost > 0.002 ? `${Math.round(lost * 100)}% of the page was outside the photo, stretched from the edge: check that corner` : ''].filter(Boolean).join(' · ');
  return { jpeg: canvas.toDataURL('image/jpeg', 0.9), w: W, h: H, note };
}
