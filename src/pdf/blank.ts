import { PDFDocument } from 'pdf-lib';
import type { StrokeMap } from '../data/types';
import type { GridStyle, PaletteId } from '../domain/sheet';
import { printSheet } from '../domain/sheet';
import { Sheet } from './draw';
import { coreCovers, embedFonts } from './fonts';
import { describe, footer, header } from './layout/furniture';
import { CELL, COLS } from './layout/grid';
import { bodyHeight, bodyTop, contentLeft, contentRight, contentWidth, PAGE } from './layout/page';
import type { RenderResult } from './render';
import { T, themeOf } from './theme';

/**
 * Blank paper: sheets with nothing printed in the squares, for characters and
 * texts the app does not know about yet — a character from a menu, a sentence
 * you want to copy out, a dictation somebody reads to you.
 *
 * Every template is built from the same 15 mm square as the worksheets, so a
 * blank page and a printed one can sit in the same folder and look like two
 * pages of one exercise book. What differs is only what goes around the
 * squares: a pinyin staff, a box for the model, a number.
 */

export type BlankId = 'newchar' | 'text' | 'compose' | 'pinyin' | 'dictation' | 'mizi' | 'tian';

export interface BlankTemplate {
  id: BlankId;
  name: string;
  /** what the paper is called in a Chinese stationery shop */
  zh: string;
  blurb: string;
  /** how much writing one page holds, in words */
  holds: string;
}

export const BLANKS: BlankTemplate[] = [
  {
    id: 'newchar',
    name: 'New characters',
    zh: '生字',
    blurb: 'The model in a big square, its pinyin, meaning and words, its stroke order in small squares, then 22 goes.',
    holds: '5 characters a page',
  },
  {
    id: 'text',
    name: 'Copy a text',
    zh: '抄写',
    blurb: 'Smaller squares for a text, each with a box for its pinyin, and a line under every row for the English.',
    holds: '10 rows, 160 characters',
  },
  {
    id: 'compose',
    name: 'Writing paper',
    zh: '作文纸',
    blurb: 'Rows of plain squares with room between them for notes, and the count in the margin, like a Chinese composition book.',
    holds: '17 rows, 272 characters',
  },
  {
    id: 'pinyin',
    name: 'Pinyin and squares',
    zh: '拼音田字格',
    blurb: 'Every square with a box for its pinyin on top, four lines high, like a Chinese first-grade book.',
    holds: '10 rows, 120 squares',
  },
  {
    id: 'dictation',
    name: 'Dictation',
    zh: '听写',
    blurb: 'Twenty numbered words, each with four squares and a pinyin box over each, and a score.',
    holds: '20 words a page',
  },
  {
    id: 'mizi',
    name: 'Practice grid',
    zh: '米字格',
    blurb: 'Squares with the full 米 guide, edge to edge. For drilling anything.',
    holds: '192 squares a page',
  },
  {
    id: 'tian',
    name: 'Four-square grid',
    zh: '田字格',
    blurb: 'Just the cross, which is easier on the eye once proportions come naturally.',
    holds: '192 squares a page',
  },
];

const bodyBottom = bodyTop + bodyHeight;

/** The smaller square of a text: sixteen to the line, about 11 mm. */
const SMALL = contentWidth / 16;

/**
 * Pinyin boxes over a row of squares, as a first-grade book draws them: the
 * four lines of the staff, framed and divided square by square, so each
 * square has its own box for its reading, sharing the square's top edge.
 */
function pinyinBoxes(s: Sheet, x0: number, y: number, n: number, size: number, h: number) {
  const x1 = x0 + n * size;
  const frame = { width: s.st.cellWeight, color: s.c.grid };
  s.line(x0, y, x1, y, frame);
  for (const i of [1, 2]) s.line(x0, y + (i * h) / 3, x1, y + (i * h) / 3, { width: 0.28, color: s.c.gridInner, dash: [1.2, 2.1] });
  for (let c = 0; c <= n; c++) s.line(x0 + c * size, y, x0 + c * size, y + h, frame);
}

function row(s: Sheet, y: number, guide: GridStyle, from = 0, to = COLS, size = CELL, x0 = contentLeft) {
  for (let i = from; i < to; i++) s.cell(x0 + i * size, y, size, guide);
}

/** A label in sentence case and a line to write on after it, up to `end`; `y` is the baseline. */
function field(s: Sheet, label: string, x: number, y: number, end: number): void {
  const w = s.text(label, x, y, { size: T.small, color: s.c.ink3 });
  s.line(x + w + 5, y + 1.5, end, y + 1.5, { width: 0.4, color: s.c.rule });
}

/** As many rows of `h` as fit with at least `gap` between them. */
const fits = (h: number, gap: number, height = bodyHeight) => Math.max(1, Math.floor((height + gap + 0.5) / (h + gap)));

/**
 * The tops of `n` rows of `h`, the air between them shared out so the last
 * row ends at the foot of the page: no band of empty paper under the last.
 */
function spread(n: number, h: number, top = bodyTop, height = bodyBottom - top): number[] {
  const gap = n > 1 ? (height - n * h) / (n - 1) : 0;
  return Array.from({ length: n }, (_, r) => top + r * (h + gap));
}

const DRAW: Record<BlankId, (s: Sheet) => void> = {
  // A whole grid, centred on the page so the margins above and below match.
  mizi: (s) => {
    const n = fits(CELL, 0);
    const top = bodyTop + (bodyHeight - n * CELL) / 2;
    for (let r = 0; r < n; r++) row(s, top + r * CELL, 'mizi');
  },

  tian: (s) => {
    const n = fits(CELL, 0);
    const top = bodyTop + (bodyHeight - n * CELL) / 2;
    for (let r = 0; r < n; r++) row(s, top + r * CELL, 'tian');
  },

  pinyin: (s) => {
    const box = 24;
    const h = box + CELL;
    for (const y of spread(fits(h, 4), h)) {
      pinyinBoxes(s, contentLeft, y, COLS, CELL, box);
      row(s, y + box, 'tian');
    }
  },

  // A block per character. The model goes in the double square on the left;
  // beside it, a line for its pinyin, meaning and words, and under that a row
  // of half squares for its stroke order, one stroke to a square. Then ten
  // goes beside the model and twelve under it.
  newchar: (s) => {
    const h = CELL * 3;
    const big = CELL * 2;
    const half = CELL / 2;
    const ys = spread(fits(h, 16), h);
    ys.forEach((y, b) => {
      if (b > 0) {
        const mid = (ys[b - 1]! + h + y) / 2;
        s.line(contentLeft, mid, contentRight, mid, { width: 0.4, color: s.c.hair });
      }
      s.cell(contentLeft, y, big, 'mizi');
      const x = contentLeft + big;
      const w = contentRight - x;
      const base = y + half - 6;
      field(s, 'Pinyin', x + 8, base, x + w * 0.27);
      field(s, 'Meaning', x + w * 0.31, base, x + w * 0.62);
      field(s, 'Words', x + w * 0.66, base, contentRight);
      row(s, y + half, 'tian', 0, 20, half, x);
      row(s, y + CELL, 'mizi', 2, COLS);
      row(s, y + big, 'mizi');
    });
  },

  // A text to copy out: smaller squares, each with its pinyin box, and a
  // dotted line under the row for what it means.
  text: (s) => {
    const box = 15;
    const line = 15;
    const h = box + SMALL + line;
    for (const y of spread(fits(h, 6), h)) {
      pinyinBoxes(s, contentLeft, y, 16, SMALL, box);
      row(s, y + box, 'tian', 0, 16, SMALL);
      s.line(contentLeft, y + box + SMALL + line - 2, contentRight, y + box + SMALL + line - 2, {
        width: 0.35,
        color: s.c.gridInner,
        dash: [1.2, 2.1],
      });
    }
  },

  // A title, then rows of plain squares with room between them for a note or
  // a correction. The count of squares so far stands in the margin every five
  // rows, as a composition book's does, so a 200-character piece is easy to
  // measure.
  compose: (s) => {
    field(s, 'Title', contentLeft, bodyTop + 9, contentRight);
    const top = bodyTop + 22;
    const ys = spread(fits(SMALL, 8, bodyBottom - top), SMALL, top);
    ys.forEach((y, r) => {
      row(s, y, 'blank', 0, 16, SMALL);
      if ((r + 1) % 5 === 0) s.text(String((r + 1) * 16), contentRight + 4, y + SMALL - 2, { size: T.micro, color: s.c.ink3 });
    });
  },

  // Two columns of ten. Each word gets a number, four squares with a pinyin
  // box over each, which holds anything up to 出租汽车, and the sixth column
  // clear for the tick or the correction.
  dictation: (s) => {
    const box = 18;
    const h = box + CELL;
    const ys = spread(10, h);
    const half = COLS / 2;
    ys.forEach((y, r) => {
      for (let c = 0; c < 2; c++) {
        const x0 = contentLeft + c * half * CELL;
        s.textRight(String(c * 10 + r + 1), x0 + CELL - 8, y + box + CELL / 2 + 3, { size: T.lead, color: s.c.ink3 });
        pinyinBoxes(s, x0 + CELL, y, 4, CELL, box);
        row(s, y + box, 'tian', 0, 4, CELL, x0 + CELL);
      }
    });
  },
};

/**
 * The page's own facts, written in by hand: its number among the pages of
 * the exercise book (a printed "3 / 10" says nothing once the pages are
 * spread across weeks and folders), and the date.
 */
function rightOf(id: BlankId): string {
  if (id === 'dictation') return 'score ______ / 20      page ______      date ____________';
  return 'page ______      date ____________';
}

export async function renderBlank(
  id: BlankId,
  opts: { pages?: number; palette?: PaletteId; footerNote?: string } = {},
): Promise<RenderResult> {
  const t = BLANKS.find((b) => b.id === id) ?? BLANKS[0];
  const doc = await PDFDocument.create();
  const title = `${t.zh}  ${t.name}`;
  describe(doc, title);
  const theme = themeOf(printSheet('study', opts.palette ?? 'cinnabar'));
  const fonts = await embedFonts(doc, { core: await coreCovers([title]) });
  const strokes: StrokeMap = {};
  const pages = Math.max(1, opts.pages ?? 1);

  for (let p = 0; p < pages; p++) {
    const s = new Sheet(doc.addPage([PAGE.width, PAGE.height]), fonts, strokes, theme);
    header(s, title, rightOf(t.id));
    DRAW[t.id](s);
    footer(s, opts.footerNote?.trim() ?? '', '');
  }
  return { bytes: await doc.save(), pages };
}
