/**
 * The photo album and postcards (prompt X6). The pictures live on this
 * device only (localStorage, a few dozen small JPEGs) — the world save just
 * remembers what was photographed. Every read and write is wrapped: a
 * private window or a full disk simply means no album, never a broken game.
 */

export interface Photo {
  id: string;
  /** the game clock when it was taken */
  at: number;
  map: string;
  subjects: string[];
  /** where it was taken, as the top bar names it */
  place: string;
  /** a small JPEG, as a data URL */
  img: string;
  caption?: string;
}

export const ALBUM_MAX = 24;
const key = (user: string) => `zouzou:album:${user}`;

export function loadAlbum(user: string): Photo[] {
  try {
    const raw = localStorage.getItem(key(user));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list.filter((p) => p && typeof p.img === 'string') as Photo[]) : [];
  } catch {
    return [];
  }
}

/** Keeps the newest `ALBUM_MAX`; drops the oldest if the device says it is full. */
export function saveAlbum(user: string, list: Photo[]): Photo[] {
  let keep = list.slice(0, ALBUM_MAX);
  for (;;) {
    try {
      localStorage.setItem(key(user), JSON.stringify(keep));
      return keep;
    } catch {
      if (!keep.length) return keep;
      keep = keep.slice(0, -1);
    }
  }
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** The part of a screenshot inside the viewfinder (fractions of the whole), scaled to `width`, as a JPEG. */
export async function cropPhoto(shot: string, f: { x: number; y: number; w: number; h: number }, width = 400): Promise<string> {
  const img = await loadImage(shot);
  const sx = Math.round(img.width * f.x);
  const sy = Math.round(img.height * f.y);
  const sw = Math.round(img.width * f.w);
  const sh = Math.round(img.height * f.h);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = Math.round((width * sh) / sw);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

/**
 * A postcard as a PNG: the photo on cream card, your Chinese caption under
 * it, and a red 走走 seal in the corner — to save and send or print. (The
 * app's print flow wants word collections; a picture file is the cheap and
 * honest way for one card.)
 */
export async function postcardPng(p: Photo, caption: string, place: string): Promise<Blob> {
  const img = await loadImage(p.img);
  const W = 900;
  const pad = 40;
  const ph = Math.round(((W - pad * 2) * img.height) / img.width);
  const H = pad + ph + 150;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f8f3e6';
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, pad, pad, W - pad * 2, ph);
  ctx.strokeStyle = '#23202e';
  ctx.lineWidth = 3;
  ctx.strokeRect(pad, pad, W - pad * 2, ph);
  ctx.fillStyle = '#23202e';
  ctx.font = '40px "WenKai", "Kaiti SC", "STKaiti", serif';
  ctx.fillText(caption.slice(0, 24), pad, pad + ph + 70);
  ctx.fillStyle = '#7d8297';
  ctx.font = '24px "WenKai", "Kaiti SC", serif';
  ctx.fillText(place, pad, pad + ph + 115);
  // the seal
  const s = 84;
  const x = W - pad - s;
  const y = pad + ph + 36;
  ctx.fillStyle = '#b8452f';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#f8f3e6';
  ctx.font = 'bold 34px "WenKai", "Kaiti SC", serif';
  ctx.fillText('走', x + 8, y + 38);
  ctx.fillText('走', x + 40, y + 76);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('no picture'))), 'image/png'));
}

/** Hands the browser a file to save. */
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
