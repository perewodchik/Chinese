import type { SquareSize } from '../../domain/sheet';

/**
 * Smallest square we will draw, in points. 44pt is about 15mm, the size of a
 * roomy exercise book; 32pt is about 11mm, tight but still writable, and fits
 * noticeably more practice on a page.
 */
export function minCellFor(size: SquareSize | undefined): number {
  return size === 'large' ? 44 : size === 'small' ? 32 : 38;
}

export interface GridFit {
  cols: number;
  rows: number;
  cell: number;
  /** rows that would fit if `maxRows` were not limiting it */
  capacity: number;
}

/**
 * Chooses how to fill the leftover space with practice squares.
 *
 * Fixing the column count wastes a band of paper whenever the remainder is not
 * a whole number of squares, so instead we try a range of column counts and
 * keep whichever yields the most squares at a size that is still comfortable
 * to write in - roughly 13-18 mm, which is what printed Chinese exercise books
 * use.
 */
export function gridFit(
  width: number,
  height: number,
  maxRows: number,
  minCell = 38,
  maxCell = 53,
): GridFit {
  let best: GridFit | null = null;
  for (let cols = 8; cols <= 16; cols++) {
    const cell = width / cols;
    if (cell < minCell || cell > maxCell) continue;
    const capacity = Math.floor((height + 0.5) / cell);
    const rows = Math.min(maxRows, capacity);
    if (rows < 1) continue;
    const squares = rows * cols;
    const bestSquares = best ? best.rows * best.cols : -1;
    // more writing room wins; on a tie prefer the larger, easier square
    if (squares > bestSquares || (squares === bestSquares && cell > best!.cell)) {
      best = { cols, rows, cell, capacity };
    }
  }
  if (best) return best;

  // Nothing in the comfortable range fits: fall back to a single tight row.
  const cols = Math.max(8, Math.min(16, Math.round(width / minCell)));
  const cell = width / cols;
  const capacity = Math.floor(height / cell);
  return { cols, rows: Math.min(maxRows, capacity), cell, capacity };
}
