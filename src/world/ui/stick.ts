import type { Facing } from '../core/types';

/**
 * The on-screen joystick's direction for a thumb `dx, dy` pixels from its
 * centre: the stronger axis wins, nothing inside the dead zone. Past `run`
 * (a push to the rim) the hero runs.
 */
export function stickFacing(dx: number, dy: number, dead = 12, run = 44): { facing: Facing | null; run: boolean } {
  const d = Math.hypot(dx, dy);
  if (d < dead) return { facing: null, run: false };
  const facing: Facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  return { facing, run: d >= run };
}
