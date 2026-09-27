import type { SheetOptions } from '../../domain/sheet';
import type { Sheet } from '../draw';
import { CELL, COLS } from '../layout/grid';
import { contentLeft, contentWidth } from '../layout/page';
import type { ItemScale } from '../layout/profile';
import { T } from '../theme';

/**
 * What a character block and a word block share: the heading and the squares.
 *
 * The two differ only in the notes between them. Drawing the ends the same
 * way is what lets a page mix 好 and 朋友 and still read as one sheet — the
 * reading in the same place, the grid the same width, the first go traced.
 */

export interface Heading {
  glyphs: string[];
  py: string;
  def: string;
  /** "character" or "word", set small beside the facts */
  kind: string;
  facts: string[];
  tag: string;
}

/** Width the heading's boxes take, and so where its text starts. */
export function headingBoxes(S: ItemScale, n: number) {
  const box = Math.min(S.box, S.boxesMax / Math.max(1, n));
  return { box, width: box * n };
}

/** A glyph from its outline, or from the font when there is none. */
export function glyphIn(
  s: Sheet,
  ch: string,
  x: number,
  y: number,
  size: number,
  o: { color?: Sheet['c']['ink']; inset?: number; groups?: boolean } = {},
) {
  const inset = o.inset ?? 0.1;
  if (s.glyph(ch, x, y, size, { color: o.color, inset, groups: o.groups })) return;
  const fs = size * (1 - inset * 2) * 0.95;
  s.textCentre(ch, x + size / 2, y + size / 2 + fs * 0.36, { size: fs, color: o.color });
}

/**
 * Draws the heading and returns the x its text column starts at.
 *
 * `rightReserve` keeps the reading and definition clear of whatever the
 * layout puts at the right-hand end (Drill's stroke strip).
 */
export function drawHeading(
  s: Sheet,
  h: Heading,
  S: ItemScale,
  o: SheetOptions,
  top: number,
  opts: { rule: boolean; rightReserve?: number },
): number {
  const x0 = contentLeft;
  const x1 = contentLeft + contentWidth;
  const { box, width } = headingBoxes(S, h.glyphs.length);

  h.glyphs.forEach((g, i) => {
    s.headBox(x0 + i * box, top, box, o.gridStyle);
    glyphIn(s, g, x0 + i * box, top, box, { color: s.c.ink, groups: h.glyphs.length === 1 });
  });
  if (h.glyphs.length > 1) {
    // One word, so one frame: a firmer line round the whole row of boxes.
    s.rect(x0, top, width, box, { border: s.c.ink2, borderWidth: 0.6 });
  }

  const tx = x0 + width + S.boxGap;
  const reserve = opts.rightReserve ?? 0;
  const tagW = s.measure(h.tag, T.micro, false, 0.3);
  s.textRight(h.tag, x1, top + (reserve ? 7 : S.pyY), {
    size: T.micro,
    color: s.st.accentFurniture ? s.c.accent : s.c.ink3,
    tracking: 0.3,
  });

  const textRight = x1 - Math.max(reserve, reserve ? 0 : tagW + 12);
  s.text(h.py, tx, top + S.pyY, {
    size: S.hero,
    color: s.st.accentReading ? s.c.accent : s.c.ink,
    maxWidth: textRight - tx - 6,
  });
  s.text(h.def, tx, top + S.defY, { size: S.lead, maxWidth: x1 - reserve - tx - 8 });

  if (opts.rule) s.line(tx, top + S.ruleY, x1, top + S.ruleY, { width: 0.4, color: s.c.hair });

  // The kind, as a small outlined tag, then one quiet line of facts.
  const fx = tx + kindTag(s, h.kind, tx, top + S.factY) + 8;
  s.text(h.facts.filter(Boolean).join('   ·   '), fx, top + S.factY, {
    size: S.body,
    color: s.c.ink2,
    maxWidth: x1 - reserve - fx - 6,
  });
  return tx;
}

/**
 * "CHARACTER", "WORD", "RADICAL": a small outlined tag sat on `baseline`.
 * Returns its width.
 */
export function kindTag(s: Sheet, kind: string, x: number, baseline: number): number {
  const size = 5.4;
  const text = kind.toUpperCase();
  const w = s.measure(text, size, true, 0.6) + 7;
  s.roundRect(x, baseline - size - 1.6, w, size + 4, 1.5, { border: s.c.ink3, borderWidth: 0.45 });
  s.text(text, x + 3.5, baseline - 0.4, { size, color: s.c.ink2, bold: true, tracking: 0.6 });
  return w;
}

/**
 * The practice squares: twelve across, `rows` down, a word's characters kept
 * together.
 *
 * Every go of a word starts on a firmer line, so 朋友 reads as six pairs and
 * not as twelve squares that happen to alternate. The first go is solid enough
 * to trace; after it, a character gets three faint goes and a word one, since a
 * word's faint go already covers two or three squares.
 */
export function drawPractice(
  s: Sheet,
  glyphs: string[],
  y: number,
  rows: number,
  o: { gridStyle: SheetOptions['gridStyle']; trace: number; faint: number },
) {
  const x0 = contentLeft;
  const L = Math.max(1, glyphs.length);
  const per = Math.max(1, Math.floor(COLS / L));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = x0 + c * CELL;
      const cy = y + r * CELL;
      s.cell(cx, cy, CELL, o.gridStyle);
      if (r !== 0) continue;
      const go = Math.floor(c / L);
      if (go >= per) continue;
      const g = glyphs[c % L];
      if (go < o.trace) glyphIn(s, g, cx, cy, CELL, { color: s.c.trace, inset: 0.12 });
      else if (go < o.trace + o.faint) glyphIn(s, g, cx, cy, CELL, { color: s.c.fade, inset: 0.12 });
    }
  }

  if (L > 1) {
    for (let g = 1; g < per; g++) {
      const x = x0 + g * L * CELL;
      s.line(x, y, x, y + rows * CELL, { width: 1.1, color: s.c.grid });
    }
  }
  if (s.st.gridFrame) {
    s.rect(x0, y, COLS * CELL, rows * CELL, { border: s.c.grid, borderWidth: s.st.frameWeight });
  }
}

/** The trace pattern for a block of `n` glyphs. */
export const practiceFor = (o: SheetOptions, n: number) => ({
  gridStyle: o.gridStyle,
  trace: o.traceCount,
  faint: n > 1 ? 1 : o.fadeCount,
});

/** A stroke-order strip: frames 1…n of `ch`, stepping through long ones. */
export function drawStrokeStrip(
  s: Sheet,
  ch: string,
  x: number,
  y: number,
  size: number,
  perRow: number,
  maxRows: number,
  align: 'left' | 'right' = 'left',
  right = 0,
) {
  const n = s.strokeCount(ch);
  if (!n) return;
  const room = perRow * maxRows;
  const shown = Math.min(n, room);
  const step = n <= shown ? 1 : Math.ceil(n / shown);
  const frames: number[] = [];
  for (let i = step - 1; i < n; i += step) frames.push(i + 1);
  if (frames[frames.length - 1] !== n) frames.push(n);
  const list = frames.slice(-room);
  const inRow = Math.min(perRow, list.length);
  const left = align === 'right' ? right - inRow * (size + 3) + 3 : x;

  list.forEach((upto, i) => {
    const bx = left + (i % perRow) * (size + 3);
    const by = y + Math.floor(i / perRow) * (size + 4);
    if (s.st.soFrames) s.rect(bx, by, size, size, { border: s.c.hair, borderWidth: 0.35 });
    s.glyph(ch, bx, by, size, {
      upto,
      color: s.c.trace,
      highlight: s.c.accent,
      groups: true,
      inset: 0.1,
    });
  });
}
