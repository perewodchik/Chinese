import { LAYOUTS, type LayoutId } from '../../domain/sheet';
import { T } from '../theme';
import { CELL } from './grid';

/**
 * The two layouts, in points.
 *
 * Every block of a layout is cut the same way: a heading, a notes zone (Study
 * only), then the practice rows. The zones are fixed rather than measured from
 * what a character has to say — measuring is what gave one character three
 * rows and the one under it two. A section a character does not have leaves
 * its place empty; nothing moves up to fill it.
 */
export interface ItemScale {
  /** the square each glyph of the heading sits in */
  box: number;
  /** widest the row of heading boxes may get, for long words */
  boxesMax: number;
  boxGap: number;
  /** baselines inside the heading, measured from the top of the block */
  pyY: number;
  defY: number;
  ruleY: number;
  factY: number;

  hero: number;
  lead: number;
  body: number;
  small: number;

  partGlyph: number;
  soBox: number;
  wordRow: number;

  /** label baseline to the first content baseline under it */
  labelDrop: number;
  /** space between two sections in a column */
  blockGap: number;
  /** the heading or notes to the practice grid */
  gridGap: number;
  /** fixed heading height; Drill's is whatever the slot leaves */
  headH: number;
}

const SCALE: Record<LayoutId, ItemScale> = {
  study: {
    box: 70,
    boxesMax: 250,
    boxGap: 20,
    pyY: 18,
    defY: 34,
    ruleY: 48,
    factY: 62,
    hero: T.hero,
    lead: T.lead,
    body: T.body,
    small: T.small,
    partGlyph: 17,
    soBox: 22,
    wordRow: 23,
    labelDrop: 13,
    blockGap: 10,
    gridGap: 14,
    headH: 80,
  },
  drill: {
    box: 58,
    boxesMax: 200,
    boxGap: 16,
    pyY: 18,
    defY: 33,
    ruleY: 40,
    factY: 51,
    hero: 13.5,
    lead: 9.2,
    body: 7.8,
    small: 7.2,
    partGlyph: 13,
    soBox: 17,
    wordRow: 20,
    labelDrop: 10.5,
    blockGap: 8,
    gridGap: 12,
    headH: 0,
  },
};

export const itemScale = (layout: LayoutId): ItemScale => SCALE[layout];

export interface ItemFrame {
  S: ItemScale;
  head: number;
  /** the notes zone between heading and grid; 0 in Drill */
  info: number;
  rows: number;
  /** from the top of the block to the top of the grid */
  gridTop: number;
}

/** Where a block's zones fall in a slot of this height. */
export function itemFrame(layout: LayoutId, slot: number): ItemFrame {
  const S = SCALE[layout];
  const rows = LAYOUTS[layout].rows;
  const grid = rows * CELL;
  const head = layout === 'study' ? S.headH : slot - S.gridGap - grid;
  const info = layout === 'study' ? Math.max(0, slot - head - S.gridGap - grid) : 0;
  return { S, head, info, rows, gridTop: head + info + S.gridGap };
}
