import type { ComponentGloss, RadicalEntry } from '../data/types';
import type { SheetOptions } from '../store/types';
import { planBands, type Band } from './bands';
import { Sheet } from './draw';
import { gridFit, minCellFor } from './grid';
import { C, contentLeft, contentWidth } from './theme';

const HEIGHTS = {
  comfortable: { head: 52, examples: 16, strokeOrder: 22, gap: 6 },
  compact: { head: 40, examples: 14, strokeOrder: 19, gap: 5 },
} as const;

const h = (o: SheetOptions) => HEIGHTS[o.density ?? 'comfortable'];

/** Least essential first, so these are what give way when space is short. */
function bandsFor(r: RadicalEntry, o: SheetOptions): Band[] {
  return [
    { id: 'examples', height: h(o).examples, available: r.ex.length > 0 },
    { id: 'strokeOrder', height: h(o).strokeOrder, available: o.strokeOrder },
  ];
}

/** Must match the smallest square the grid will actually draw. */
const reserveFor = (o: SheetOptions) => Math.max(30, minCellFor(o.squareSize) - 4) + 2;

export function radicalPlan(r: RadicalEntry, o: SheetOptions, slot: number) {
  return planBands(h(o).head, h(o).gap, bandsFor(r, o), slot, reserveFor(o));
}

export function radicalInfoHeight(r: RadicalEntry, o: SheetOptions, slot = Infinity): number {
  return radicalPlan(r, o, slot).used;
}

function label(s: Sheet, text: string, x: number, y: number) {
  s.text(text, x, y, { size: 5.8, color: C.faint, bold: true });
}

const firstSense = (s: string) => s.split(/[;,]/)[0].trim();

export function drawRadicalBlock(
  s: Sheet,
  r: RadicalEntry,
  o: SheetOptions,
  components: Record<string, ComponentGloss>,
  top: number,
  height: number,
) {
  const compact = (o.density ?? 'comfortable') === 'compact';
  const H = h(o);
  const x0 = contentLeft;
  const x1 = contentLeft + contentWidth;
  const { keep } = radicalPlan(r, o, height);
  let y = top;

  // ---------------------------------------------------------------- heading
  const boxSize = compact ? 38 : 48;
  s.cell(x0, y, boxSize, o.gridStyle);
  s.glyph(r.r, x0, y, boxSize, { color: C.ink, inset: 0.12 });

  const tx = x0 + boxSize + 16;
  let hx = tx;
  hx += s.text(firstSense(r.mean), hx, y + 12, { size: 12.5 }) + 8;
  hx += s.text(r.py, hx, y + 12, { size: 10, color: C.accent }) + 10;
  if (r.cn) {
    hx += s.text(r.cn, hx, y + 12, { size: 10 }) + 4;
    s.text(r.cnPy ?? '', hx, y + 11.5, { size: 6.8, color: C.muted });
  }
  s.textRight(`#${r.n} · top ${r.rank}`, x1, y + 11, {
    size: 7,
    color: C.faint,
    bold: true,
  });
  s.line(tx, y + 19, x1, y + 19, { width: 0.5, color: C.rule });

  let vx = tx;
  if (r.variants.length) {
    label(s, 'ALSO WRITTEN', vx, y + 31);
    vx += s.measure('ALSO WRITTEN', 5.8, true) + 6;
    for (const v of r.variants.slice(0, 3)) {
      if (s.hasGlyph(v)) {
        s.glyph(v, vx - 1, y + 20, 13, { color: C.ink, inset: 0.02 });
        vx += 15;
      } else {
        vx += s.text(v, vx, y + 32, { size: 11 }) + 5;
      }
    }
    vx += 6;
  }
  if (r.sc) {
    label(s, 'STROKES', vx, y + 31);
    vx += s.measure('STROKES', 5.8, true) + 5;
    vx += s.text(String(r.sc), vx, y + 32, { size: 9.5 }) + 14;
  }
  label(s, 'USED IN', vx, y + 31);
  vx += s.measure('USED IN', 5.8, true) + 5;
  s.text(`${r.count} characters`, vx, y + 32, { size: 9.5 });

  const aside = (o.confusables && r.note) || (/[;,]/.test(r.mean) ? r.mean : '');
  if (aside) {
    s.text(aside, tx, y + 44, { size: 7.3, color: C.muted, maxWidth: x1 - tx });
  }
  y += H.head;

  // --------------------------------------------------------------- examples
  if (keep.has('examples')) {
    label(s, 'APPEARS IN', x0, y + 11);
    let ex = x0 + s.measure('APPEARS IN', 5.8, true) + 10;
    for (const c of r.ex.slice(0, 8)) {
      if (ex + 40 > x1) break;
      if (s.hasGlyph(c)) {
        s.glyph(c, ex, y, 14, { color: C.ink, inset: 0.02 });
        ex += 15;
      } else {
        ex += s.text(c, ex, y + 12, { size: 11 }) + 3;
      }
      const g = components[c];
      ex += g?.py ? s.text(g.py, ex, y + 12, { size: 6.6, color: C.muted }) + 9 : 6;
    }
    y += H.examples;
  }

  // ----------------------------------------------------------- stroke order
  if (keep.has('strokeOrder')) {
    label(s, 'STROKE ORDER', x0, y + 4);
    const n = s.strokeCount(r.r);
    const size = 17;
    let bx = x0 + s.measure('STROKE ORDER', 5.8, true) + 10;
    for (let i = 0; i < n && bx + size <= x1; i++) {
      s.rect(bx, y - 1, size, size, { border: C.rule, borderWidth: 0.4 });
      s.glyph(r.r, bx, y - 1, size, {
        upto: i + 1,
        color: C.trace,
        highlight: C.accent,
        inset: 0.1,
      });
      bx += size + 2;
    }
    y += H.strokeOrder;
  }

  // ----------------------------------------------------------- practice box
  y += H.gap;
  // Radicals are simpler shapes than whole characters, so a slightly smaller
  // square is still comfortable and fits more repetitions in the band.
  const { cols, rows, cell } = gridFit(
    contentWidth,
    top + height - y,
    o.practiceRows,
    Math.max(30, minCellFor(o.squareSize) - 4),
    48,
  );
  const left = x0 + (contentWidth - cols * cell) / 2;

  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      const cx = left + c * cell;
      const cy = y + row * cell;
      s.cell(cx, cy, cell, o.gridStyle);
      if (row === 0) {
        if (c < o.traceCount) {
          s.glyph(r.r, cx, cy, cell, { color: C.trace, inset: 0.12 });
        } else if (c < o.traceCount + o.fadeCount) {
          s.glyph(r.r, cx, cy, cell, { color: C.fade, inset: 0.12 });
        }
      }
    }
  }
}
