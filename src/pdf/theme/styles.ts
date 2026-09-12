import type { StyleId } from '../../domain/sheet';

/**
 * Design variants.
 *
 * Every one of these describes decoration only: how the page header is set,
 * how one character is divided from the next, how a label announces itself,
 * how the practice guides are drawn. None of them moves anything. The block
 * geometry — where the heading sits, how tall each section is, where the grid
 * starts — comes from `layout/`, identically for all four, so switching style
 * can never push a section off the bottom of a page or shift a square.
 *
 * That constraint is the whole design: a variant may only spend the space that
 * is already spare, which is why the framed one draws its box in the gutter
 * between blocks rather than insetting the block.
 */
export interface SheetStyle {
  id: StyleId;
  name: string;
  blurb: string;

  /** the strip at the top of every page */
  header: 'bar' | 'band' | 'rule' | 'plain';
  /** what comes between one character and the next */
  separator: 'hairline' | 'none' | 'frame' | 'topRule';
  /** how a section announces itself */
  label: 'caps' | 'capsRule' | 'capsAccent' | 'quiet';
  /** the treatment behind a prose note */
  panel: 'rule' | 'tint' | 'plain';
  /** the guides inside a practice square */
  guide: 'dash' | 'dot' | 'solid';
  /** a tint behind the heading of each block */
  headBand: boolean;
  /** the box the big glyph sits in */
  headBox: 'cell' | 'tint' | 'outline' | 'none';
  /** boxes around the thumbnails in the stroke-order strip */
  soFrames: boolean;
  /** the firmer rule around the whole writing area */
  gridFrame: boolean;
  /** practice square outline weight */
  cellWeight: number;
  /** weight of the frame around the whole writing area */
  frameWeight: number;
  /** whether the reading is set in the accent colour */
  accentReading: boolean;
  /** page furniture in the accent rather than grey */
  accentFurniture: boolean;
}

export const STYLES: SheetStyle[] = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'An accent tab, hairline dividers, dashed guides. Quiet and dense.',
    header: 'bar',
    separator: 'hairline',
    label: 'caps',
    panel: 'rule',
    guide: 'dash',
    headBand: false,
    headBox: 'cell',
    soFrames: true,
    gridFrame: true,
    cellWeight: 0.4,
    frameWeight: 0.7,
    accentReading: true,
    accentFurniture: false,
  },
  {
    id: 'workbook',
    name: 'Workbook',
    blurb: 'A tinted band per character and ruled labels, like a 练习本.',
    header: 'band',
    separator: 'topRule',
    label: 'capsRule',
    panel: 'tint',
    guide: 'solid',
    headBand: true,
    headBox: 'tint',
    soFrames: true,
    gridFrame: true,
    cellWeight: 0.5,
    frameWeight: 0.9,
    accentReading: true,
    accentFurniture: true,
  },
  {
    id: 'quiet',
    name: 'Quiet',
    blurb: 'No boxes, no rules, no colour. Type and squares, nothing else.',
    // The one design that takes things away rather than adding them: the
    // glyph sits on the paper instead of in a square, the stroke strip loses
    // its frames, the writing area loses its border, and nothing is set in
    // the accent. What is left is the character and the room to write it.
    header: 'plain',
    separator: 'none',
    label: 'quiet',
    panel: 'plain',
    guide: 'dot',
    headBand: false,
    headBox: 'none',
    soFrames: false,
    gridFrame: false,
    cellWeight: 0.34,
    frameWeight: 0,
    accentReading: false,
    accentFurniture: false,
  },
  {
    id: 'card',
    name: 'Card',
    blurb: 'Each character in its own frame. Easiest to cut up and shuffle.',
    header: 'plain',
    separator: 'frame',
    label: 'capsAccent',
    panel: 'tint',
    guide: 'dash',
    headBand: false,
    headBox: 'cell',
    soFrames: true,
    gridFrame: true,
    cellWeight: 0.45,
    frameWeight: 0.8,
    accentReading: true,
    accentFurniture: true,
  },
];

export const style = (id: StyleId): SheetStyle =>
  STYLES.find((s) => s.id === id) ?? STYLES[0];
