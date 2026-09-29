/**
 * How the world looks at each part of the day (prompt §9, concept §12):
 * a colour the whole scene is multiplied by, and whether lamps are lit.
 * Pure numbers, so the /play card's banner can use the same.
 */

import type * as Phaser from 'phaser';
import type { PartOfDay } from '../core/types';
import { heroFrames, toRgba, type WornOutfit } from '../art/hero';
import { lookKey, type HeroLook } from '../core/looks';

export interface DayLook {
  /** multiplied over the scene; 0xffffff leaves it alone */
  tint: number;
  /** lanterns and windows lit, glows drawn */
  lit: boolean;
  /** how strong the glows are, 0–1 */
  glow: number;
}

export const DAY_LOOK: Record<PartOfDay, DayLook> = {
  morning: { tint: 0xfff4e4, lit: false, glow: 0 },
  day: { tint: 0xffffff, lit: false, glow: 0 },
  evening: { tint: 0xf2c6a8, lit: true, glow: 0.7 },
  night: { tint: 0x5a64a8, lit: true, glow: 1 },
};

/**
 * Integer zoom for pixel art: about 21 tiles across on an iPad (×3), never
 * less than ×2 on a phone, ×4 on a big screen.
 */
export function zoomFor(width: number, height: number): number {
  return Math.max(2, Math.min(4, Math.floor(Math.min(width / 320, height / 200))));
}

// ---------------------------------------------------------------------------
// The player's own look (prompt §12, W1)
// ---------------------------------------------------------------------------

/** What the page hands the scene: the look and the clothes worn, as drawings. */
export interface HeroDress {
  look: HeroLook;
  worn: WornOutfit;
}

/** The texture key a dress composes to (the same dress is never drawn twice). */
export function heroKey(d: HeroDress): string {
  return `hero-${lookKey(d.look, {}, () => '')}-${Object.entries(d.worn)
    .map(([slot, w]) => `${slot}.${w.art}.${w.palette}`)
    .sort()
    .join('_')}`;
}

/** The thirteen frames side by side on one canvas (for a texture, or a picture in the page). */
export function heroCanvas(d: HeroDress): { canvas: HTMLCanvasElement; names: string[] } {
  const frames = heroFrames(d.look, d.worn);
  const canvas = document.createElement('canvas');
  canvas.width = 16 * frames.length;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  frames.forEach(([, g], i) => ctx.putImageData(new ImageData(toRgba(g), 16, 32), i * 16, 0));
  return { canvas, names: frames.map(([n]) => n) };
}

/**
 * The player's frames as one canvas texture with the frame names every
 * person has (`hero/down-0` …), keyed by the dress: the scene only swaps the
 * hero sprite's texture, so walking, the bike, depth, photos and emotes are
 * untouched. Composed once per change of clothes, never per frame.
 */
export function composeHero(textures: Phaser.Textures.TextureManager, d: HeroDress): string {
  const key = heroKey(d);
  if (textures.exists(key)) return key;
  const { canvas, names } = heroCanvas(d);
  const tex = textures.addCanvas(key, canvas);
  if (!tex) return 'chars';
  names.forEach((n, i) => tex.add(`hero/${n}`, 0, i * 16, 0, 16, 32));
  return key;
}
