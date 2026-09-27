import { firstSense } from '../../domain/library';
import type { WordInfo } from '../../domain/printItems';
import { layoutFor, type SheetOptions } from '../../domain/sheet';
import type { Sheet } from '../draw';
import { contentLeft, contentWidth } from '../layout/page';
import { itemFrame } from '../layout/profile';
import { COL_GAP, colWidth } from './charBlock';
import { drawHeading, drawPractice, drawStrokeStrip, glyphIn, practiceFor } from './item';

/**
 * One word, practised whole.
 *
 * The heading is the word in joined boxes with the syllabus reading and sense —
 * 东西 is dōngxi, "thing", not east and west. In Study the left column takes
 * the word apart, a line per character with its own reading and stroke order,
 * and the right column puts it back together in sentences. The squares go in
 * whole goes: 朋友 six times a row, 出租车 four.
 */
export function drawWordBlock(s: Sheet, w: WordInfo, o: SheetOptions, top: number, height: number) {
  const layout = layoutFor(o.perPage);
  const F = itemFrame(layout, height);
  const S = F.S;
  const x0 = contentLeft;
  const x1 = contentLeft + contentWidth;
  const glyphs = [...w.w];
  const study = layout === 'study';

  const facts: string[] = [];
  if (w.cl.length) facts.push(`measure word ${w.cl.slice(0, 2).join(' / ')}`);
  if (study && w.also.length) facts.push(`also ${w.also.map((a) => `${a.w} ${a.d}`).join(', ')}`);
  if (!study && w.ex[0]) facts.push(`${w.ex[0].zh} ${w.ex[0].en}`);

  const heading = {
    glyphs,
    py: w.py,
    def: w.d,
    kind: 'word',
    facts,
    tag: w.hsk ? `HSK ${w.hsk === 7 ? '7–9' : w.hsk} · word` : 'word',
  };

  if (!study) {
    // Each character's reading at the right, where a character's stroke strip goes.
    const size = S.partGlyph;
    const pieces = w.chars.map((c) => ({
      c: c.c,
      py: c.py[0] ?? '',
      width: size + 3 + s.measure(c.py[0] ?? '', S.small) + 12,
    }));
    const reserve = pieces.reduce((n, p) => n + p.width, 0) + 8;
    drawHeading(s, heading, S, o, top, { rule: false, rightReserve: Math.max(120, reserve) });
    let cx = x1 - reserve + 8;
    for (const p of pieces) {
      glyphIn(s, p.c, cx, top + 20, size, { color: s.c.ink, inset: 0.02 });
      s.text(p.py, cx + size + 3, top + 20 + size * 0.7, {
        size: S.small,
        color: s.st.accentReading ? s.c.accent : s.c.ink2,
      });
      cx += p.width;
    }
    drawPractice(s, glyphs, top + F.gridTop, F.rows, practiceFor(o, glyphs.length));
    return;
  }

  drawHeading(s, heading, S, o, top, { rule: true });

  const cw = colWidth();
  const y = top + F.head + 2;
  const rx = x0 + cw + COL_GAP;

  // ------------------------------------------------ left: the characters
  s.label('THE CHARACTERS', x0, y, cw);
  const chars = w.chars.slice(0, 4);
  const rowH = Math.min(24, (F.info - S.labelDrop) / Math.max(1, chars.length));
  const g = Math.min(18, rowH - 4);
  const strip = 13;
  const stripX = x0 + g + 80;
  chars.forEach((c, i) => {
    const cy = y + S.labelDrop - 6 + i * rowH;
    glyphIn(s, c.c, x0, cy, g, { color: s.c.ink, inset: 0.02 });
    s.text(c.py[0] ?? '', x0 + g + 6, cy + g * 0.42, {
      size: S.small,
      color: s.st.accentReading ? s.c.accent : s.c.ink2,
    });
    s.text(firstSense(c.def), x0 + g + 6, cy + g * 0.42 + S.small + 1.5, {
      size: S.small - 0.4,
      color: s.c.ink2,
      maxWidth: stripX - (x0 + g + 6) - 6,
    });
    const perRow = Math.max(1, Math.floor((x0 + cw - stripX) / (strip + 3)));
    drawStrokeStrip(s, c.c, stripX, cy + (g - strip) / 2, strip, perRow, 1);
  });

  // ------------------------------------------------ right: in use
  if (w.ex.length) {
    s.label(w.ex.length > 1 ? 'IN SENTENCES' : 'IN A SENTENCE', rx, y, cw);
    w.ex.slice(0, 2).forEach((ex, i) => {
      const py = y + S.labelDrop + i * 44;
      if (ex.py) {
        s.text(ex.py, rx + 0.5, py, {
          size: S.small,
          color: s.st.accentReading ? s.c.accent : s.c.ink2,
          maxWidth: cw,
        });
      }
      const zhBase = py + S.lead + 3.5;
      s.text(ex.zh, rx, zhBase, { size: S.lead + 1.4, maxWidth: cw });
      s.text(ex.en, rx, zhBase + S.small * 1.6, { size: S.small, color: s.c.ink2, maxWidth: cw });
    });
  }

  drawPractice(s, glyphs, top + F.gridTop, F.rows, practiceFor(o, glyphs.length));
}
