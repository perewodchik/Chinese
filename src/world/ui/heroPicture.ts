/**
 * The player as a picture for the page (W1): the dialogue's portrait of 我,
 * the creator's preview, the wardrobe's tiles. Drawn by the same composer as
 * the world sprite (`src/world/art/hero.ts`), as data URLs, cached by dress.
 */

import { heroFrame, toRgba, type Dir, type WornOutfit } from '../art/hero';
import type { HeroLook } from '../core/looks';
import { heroKey, type HeroDress } from '../engine/look';

const cache = new Map<string, string>();

/** One frame of a dress as a PNG data URL (16×32; scale it up with `image-rendering: pixelated`). */
export function heroPicture(d: HeroDress, dir: Dir | 'right' = 'down', step = 0): string {
  const key = `${heroKey(d)}|${dir}|${step}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let g = heroFrame(d.look, d.worn, dir === 'right' ? 'left' : dir, step);
  if (dir === 'right') g = g.mirror();
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 32;
  canvas.getContext('2d')!.putImageData(new ImageData(toRgba(g), 16, 32), 0, 0);
  const url = canvas.toDataURL('image/png');
  if (cache.size > 400) cache.clear();
  cache.set(key, url);
  return url;
}

/** The dress the player wears now, for 我's portrait; set by the page as the save changes. */
let current: HeroDress | null = null;
export const setCurrentDress = (d: HeroDress | null) => {
  current = d;
};
export const currentDress = () => current;

export type { HeroLook, WornOutfit };
