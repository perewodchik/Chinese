import type { CharacterEntry, ComponentGloss } from '../../data/types';
import { firstSense, partGloss } from '../../domain/library';
import { layoutFor, type SheetOptions } from '../../domain/sheet';
import type { Sheet } from '../draw';
import { contentLeft, contentWidth } from '../layout/page';
import { itemFrame } from '../layout/profile';
import { drawHeading, drawPractice, drawStrokeStrip, practiceFor } from './item';

/** How the parts of a character sit together, in words rather than symbols. */
const IDC_NAME: Record<string, string> = {
  '⿰': 'side by side',
  '⿱': 'one above the other',
  '⿲': 'three side by side',
  '⿳': 'three stacked',
  '⿴': 'one enclosing the other',
  '⿵': 'open at the bottom',
  '⿶': 'open at the top',
  '⿷': 'open at the right',
  '⿸': 'wrapped from the upper left',
  '⿹': 'wrapped from the upper right',
  '⿺': 'wrapped from the lower left',
  '⿻': 'overlapping',
};

export interface CharBlockCtx {
  components: Record<string, ComponentGloss>;
}

/** Two columns of equal width with a 22pt gutter. */
export const COL_GAP = 22;
export const colWidth = () => (contentWidth - COL_GAP) / 2;

function etymologyText(e: CharacterEntry): string {
  const ety = e.ety;
  if (!ety) return '';
  const hint = ety.hint ?? '';
  if (ety.type === 'pictophonetic' && ety.semantic && ety.phonetic) {
    return `${ety.semantic} carries the meaning${hint ? ` (${hint})` : ''}; ${ety.phonetic} carries the sound.`;
  }
  return hint;
}

const hasParts = (e: CharacterEntry) =>
  Boolean(e.ids && e.parts.length > 1 && !e.parts.some((p) => p.includes('？')));

function facts(e: CharacterEntry, ctx: CharBlockCtx, partsShown: boolean): string[] {
  // The radical is named only when the page shows it nowhere else: it is one
  // of the parts listed under "built from" most of the time.
  const out: string[] = [];
  if (e.sc) out.push(`${e.sc} stroke${e.sc === 1 ? '' : 's'}`);
  if (e.rad && e.rad !== e.c && !(partsShown && e.parts.includes(e.rad))) {
    const gloss = partGloss(ctx.components, e, e.rad);
    out.push(`radical ${e.rad}${gloss ? ` ${firstSense(gloss)}` : ''}`);
  }
  if (e.trad) out.push(`${e.trad} traditional`);
  if (e.freq < 6000) out.push(`#${e.freq} most common`);
  return out;
}

/**
 * One character: heading, notes, squares.
 *
 * In Study the notes are two fixed columns — how to write it on the left
 * (stroke order, then what it is built from), how it is used on the right
 * (two words, then a sentence). Each section has its place whether or not this
 * character has anything to put there, so every block on every page lines up
 * and every one gets the same three rows. Drill has no notes: the stroke strip
 * moves into the heading and the rows follow straight on.
 */
export function drawCharBlock(
  s: Sheet,
  e: CharacterEntry,
  o: SheetOptions,
  ctx: CharBlockCtx,
  top: number,
  height: number,
) {
  const layout = layoutFor(o.perPage);
  const F = itemFrame(layout, height);
  const S = F.S;
  const x0 = contentLeft;
  const x1 = contentLeft + contentWidth;
  const study = layout === 'study';
  const parts = hasParts(e);

  const heading = {
    glyphs: [e.c],
    py: e.py.join(' / '),
    def: e.def,
    kind: 'character',
    facts: facts(e, ctx, study && parts),
    tag: `HSK ${e.hsk} · ${e.i}`,
  };

  if (!study) {
    const perRow = 10;
    const reserve = perRow * (S.soBox + 3) + 8;
    drawHeading(s, { ...heading, facts: heading.facts.slice(0, 2) }, S, o, top, { rule: false, rightReserve: reserve });
    drawStrokeStrip(s, e.c, 0, top + 20, S.soBox, perRow, 1, 'right', x1);
    drawPractice(s, [e.c], top + F.gridTop, F.rows, practiceFor(o, 1));
    return;
  }

  drawHeading(s, heading, S, o, top, { rule: true });

  const cw = colWidth();
  const y = top + F.head + 2;
  const rx = x0 + cw + COL_GAP;

  // ------------------------------------------------ left: how to write it
  s.label('STROKE ORDER', x0, y, cw);
  const perRow = Math.max(1, Math.floor(cw / (S.soBox + 3)));
  drawStrokeStrip(s, e.c, x0, y + S.labelDrop - 4, S.soBox, perRow, 2);

  const py2 = y + S.labelDrop - 4 + 2 * (S.soBox + 4) + S.blockGap;
  const ety = etymologyText(e);
  if (parts) {
    s.label('BUILT FROM', x0, py2, cw, e.ids ? IDC_NAME[e.ids[0]] : undefined);
    const gy = py2 + S.labelDrop - 6;
    let cx = x0;
    e.parts.slice(0, 3).forEach((part, i) => {
      if (i > 0) {
        s.text('+', cx + 2, gy + S.partGlyph * 0.66, { size: S.body, color: s.c.ink3 });
        cx += 14;
      }
      cx += s.glyphOrText(part, cx, gy, S.partGlyph, s.c.ink) + 4;
      const g = ctx.components[part];
      const base = gy + S.partGlyph * 0.66;
      if (g?.py) {
        cx +=
          s.text(g.py, cx, base, {
            size: S.small,
            color: s.st.accentReading ? s.c.accent : s.c.ink2,
          }) + 3;
      }
      const gloss = partGloss(ctx.components, e, part);
      if (gloss) {
        cx +=
          s.text(firstSense(gloss), cx, base, {
            size: S.small,
            color: s.c.ink2,
            maxWidth: Math.max(24, Math.min(70, x0 + cw - cx)),
          }) + 8;
      }
    });
    if (ety) {
      s.text(ety, x0, gy + S.partGlyph + 10, { size: S.small, color: s.c.ink2, maxWidth: cw });
    }
  } else if (ety) {
    s.label('WHERE IT COMES FROM', x0, py2, cw);
    s.paragraph(ety, x0, py2 + S.labelDrop, cw, {
      size: S.body,
      lineHeight: S.body * 1.36,
      maxLines: 2,
      color: s.c.ink,
    });
  }

  // ------------------------------------------------ right: how it is used
  const words = e.words.slice(0, 2);
  if (words.length) {
    s.label('COMMON WORDS', rx, y, cw);
    const glossCol = rx + 52;
    words.forEach((word, i) => {
      const wy = y + S.labelDrop + i * S.wordRow;
      const base = wy + S.lead + 3;
      s.text(word.p, rx + 0.5, wy, {
        size: S.small,
        color: s.st.accentReading ? s.c.accent : s.c.ink2,
        maxWidth: cw,
      });
      s.text(word.w, rx, base, { size: S.lead + 1.4, maxWidth: glossCol - rx - 4 });
      s.text(word.d, glossCol, base - 0.5, {
        size: S.small,
        color: s.c.ink2,
        maxWidth: rx + cw - glossCol,
      });
    });
  }

  if (e.sent) {
    const sy = y + S.labelDrop + 2 * S.wordRow + S.blockGap;
    s.label('IN A SENTENCE', rx, sy, cw);
    const py = sy + S.labelDrop;
    if (e.sent.py) {
      s.text(e.sent.py, rx + 0.5, py, {
        size: S.small,
        color: s.st.accentReading ? s.c.accent : s.c.ink2,
        maxWidth: cw,
      });
    }
    const zhBase = py + S.lead + 3.5;
    s.text(e.sent.zh, rx, zhBase, { size: S.lead + 1.4, maxWidth: cw });
    s.text(e.sent.en, rx, zhBase + S.small * 1.6, { size: S.small, color: s.c.ink2, maxWidth: cw });
  }

  drawPractice(s, [e.c], top + F.gridTop, F.rows, practiceFor(o, 1));
}
