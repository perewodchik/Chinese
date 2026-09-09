/**
 * Deciding which information bands a block can afford.
 *
 * The whole point of these sheets is the squares you write in, so the practice
 * grid gets first call on the space. If you push the items-per-page up, the
 * least essential bands drop out one at a time instead of the grid silently
 * disappearing off the bottom of the block.
 */
export interface Band {
  id: string;
  height: number;
  /** false when the item has no content for this band at all */
  available: boolean;
}

export interface BandPlan {
  /** bands that fit, in the order given */
  keep: Set<string>;
  /** total height they occupy, including the trailing gap */
  used: number;
  /** bands that were dropped for lack of room */
  dropped: string[];
}

/**
 * `bands` must be ordered most-droppable first. `reserve` is the height to keep
 * back for the practice grid.
 */
export function planBands(
  headHeight: number,
  gap: number,
  bands: Band[],
  available: number,
  reserve: number,
): BandPlan {
  const on = bands.filter((b) => b.available);
  const keep = new Set(on.map((b) => b.id));
  let used = headHeight + gap + on.reduce((t, b) => t + b.height, 0);
  const dropped: string[] = [];

  for (const b of on) {
    if (used + reserve <= available) break;
    keep.delete(b.id);
    dropped.push(b.id);
    used -= b.height;
  }
  return { keep, used, dropped };
}
