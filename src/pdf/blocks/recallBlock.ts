import type { SheetOptions } from '../../domain/sheet';
import type { Sheet } from '../draw';
import { gridFit, minCellFor } from '../layout/grid';
import { bodyHeight, contentLeft, contentRight, contentWidth } from '../layout/page';
import { T } from '../theme';

/**
 * A sheet with the answers left out.
 *
 * Every other page this app prints has the character standing at the top of
 * the block, which makes the squares underneath a copying exercise: pleasant,
 * good for the hand, and close to worthless as memory. This one gives the
 * reading and the meaning and an empty square, and the only way to fill it is
 * to remember.
 *
 * The answers are printed on the same sheet of paper, below a fold line, so
 * that testing yourself costs one sheet and no second print — and so that the
 * marking happens while you can still remember what you were thinking.
 */

export interface RecallPrompt {
  /** the number printed beside it, which is also its number in the key */
  n: number;
  char: string;
  py: string;
  gloss: string;
  strokes: number;
}

export interface RecallLayout {
  cols: number;
  cell: number;
  rows: number;
  promptH: number;
  gap: number;
  itemH: number;
  spacing: number;
  perPage: number;
  keyH: number;
}

export interface RecallStyle {
  /** rows of empty squares under each prompt */
  rows: number;
  /** print the stroke count — how many, without which */
  strokeHint: boolean;
  /** reserve the foot of every page for the answers */
  keyOnPage: boolean;
}

const PROMPT_H = 15;
const PROMPT_GAP = 4;
const ITEM_SPACING = 9;

/**
 * How many prompts fit, and how big the squares are.
 *
 * Same discipline as the worksheet profiles: the page is measured before
 * anything is drawn, so a sheet never discovers at the bottom that it has run
 * out of room. Here it is simpler, because a recall block has no sections to
 * give up — only a count per page to arrive at.
 */
export function recallLayout(sheet: SheetOptions, style: RecallStyle): RecallLayout {
  const rows = Math.max(1, Math.min(4, style.rows));
  const min = minCellFor(sheet.squareSize);
  const { cols, cell } = gridFit(contentWidth, 9999, rows, min, min + 15);

  const itemH = PROMPT_H + PROMPT_GAP + rows * cell;
  // The key needs a fold line, a line of glyphs and a little air. Two lines of
  // glyphs if the page is holding a lot of prompts.
  const keyH = style.keyOnPage ? 54 : 0;
  const room = bodyHeight - keyH;
  const perPage = Math.max(1, Math.floor((room + ITEM_SPACING) / (itemH + ITEM_SPACING)));

  return {
    cols,
    cell,
    rows,
    promptH: PROMPT_H,
    gap: PROMPT_GAP,
    itemH,
    spacing: ITEM_SPACING,
    perPage,
    keyH,
  };
}

/**
 * One prompt and the empty squares under it.
 *
 * The stroke count is the one hint on the page, and it earns its place: it
 * tells you how much character you are looking for without telling you any of
 * it, which turns "no idea" into "seven strokes, so not the simple one".
 */
export function drawRecallPrompt(
  s: Sheet,
  p: RecallPrompt,
  top: number,
  layout: RecallLayout,
  sheet: SheetOptions,
  style: RecallStyle,
) {
  const baseline = top + 10;

  s.text(String(p.n).padStart(2, '0'), contentLeft, baseline, {
    size: T.micro,
    color: s.c.ink3,
    tracking: 0.3,
  });

  const readingX = contentLeft + 22;
  const w = s.text(p.py, readingX, baseline, {
    size: 11,
    color: s.st.accentReading ? s.c.accent : s.c.ink,
  });

  const glossLeft = readingX + w + 10;
  const glossRight = contentRight - (style.strokeHint ? 54 : 0);
  s.text(p.gloss, glossLeft, baseline, {
    size: T.body,
    color: s.c.ink2,
    maxWidth: Math.max(40, glossRight - glossLeft - 6),
  });

  if (style.strokeHint && p.strokes > 0) {
    s.textRight(`${p.strokes} strokes`, contentRight, baseline, {
      size: T.micro,
      color: s.c.ink3,
      tracking: 0.25,
    });
  }

  const gridTop = top + layout.promptH + layout.gap;
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      s.cell(
        contentLeft + c * layout.cell,
        gridTop + r * layout.cell,
        layout.cell,
        sheet.gridStyle,
      );
    }
  }
}

/**
 * The answers, at the foot of the page, under a line you fold along.
 *
 * Printed small and in the tertiary grey: it has to be legible when you go
 * looking for it and easy not to read when you are not. Folding is a request,
 * not a guarantee — but a key you have to turn the paper over for is a key you
 * mark from the next morning, by which time you have forgotten what you meant.
 */
export function drawAnswerKey(
  s: Sheet,
  prompts: RecallPrompt[],
  top: number,
  label = 'FOLD HERE — ANSWERS',
) {
  s.line(contentLeft - 8, top, contentRight + 8, top, {
    width: 0.5,
    color: s.c.hair,
    dash: [2, 3],
  });

  s.text(label, contentLeft, top + 11, {
    size: T.micro,
    color: s.c.ink3,
    tracking: 0.5,
    bold: true,
  });

  let x = contentLeft;
  let y = top + 32;
  for (const p of prompts) {
    const width = 34;
    if (x + width > contentRight) {
      x = contentLeft;
      y += 22;
    }
    s.text(String(p.n).padStart(2, '0'), x, y - 8, {
      size: 5.6,
      color: s.c.ink3,
    });
    if (!s.glyph(p.char, x + 10, y - 15, 17, { inset: 0.02 })) {
      s.text(p.char, x + 10, y, { size: 14 });
    }
    x += width;
  }
}
