/**
 * How the world looks at each part of the day (prompt §9, concept §12):
 * a colour the whole scene is multiplied by, and whether lamps are lit.
 * Pure numbers, so the /play card's banner can use the same.
 */

import type { PartOfDay } from '../core/types';

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
