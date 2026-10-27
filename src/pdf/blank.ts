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
import { LABEL_TRACKING, T, themeOf } from './theme';

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

export type BlankId = 'mizi' | 'tian' | 'pinyin' | 'newchar' | 'compose' | 'dictation';

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
    blurb: 'A big square for the model, lines for pinyin, meaning and words, then 22 goes.',
    holds: '5 characters a page',
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
  {
    id: 'pinyin',
    name: 'Pinyin and squares',
    zh: '拼音田字格',
    blurb: 'Every square with a box for its pinyin on top, four lines high, like a Chinese first-grade book.',
    holds: '10 rows, 120 squares',
  },
  {
    id: 'compose',
    name: 'Writing paper',
    zh: '作文纸',
    blurb: 'Plain squares with a gap between rows for notes. For copying out or writing a text.',
    holds: '156 characters a page',
  },
  {
    id: 'dictation',
    name: 'Dictation',
    zh: '听写',
    blurb: 'Twenty numbered words, each with a pinyin staff and four squares, and a score.',
    holds: '20 words a page',
  },
];

/** A pinyin staff: four lines, three spaces, like the one in a school book. */
const STAFF = 18;
const bodyBottom = bodyTop + bodyHeight;

function staff(s: Sheet, x: number, y: number, w: number) {
  const step = STAFF / 3;
  for (let i = 0; i < 4; i++) {
    const outer = i === 0 || i === 3;
    s.line(x, y + i * step, x + w, y + i * step, {
      width: outer ? 0.4 : 0.28,
      color: s.c.grid,
      dash: outer ? undefined : [1.2, 2.1],
    });
  }
}

/**
 * The pinyin box over a row of squares, as a first-grade book draws it: the
 * four lines of the staff, framed and divided column by column, so each
 * square has its own box for its reading right on top of it, sharing the
 * square's top edge.
 */
const PINYIN_BOX = 24;

function pinyinBoxes(s: Sheet, y: number) {
  const x0 = contentLeft;
  const x1 = contentLeft + COLS * CELL;
  const step = PINYIN_BOX / 3;
  const frame = { width: s.st.cellWeight, color: s.c.grid };
  s.line(x0, y, x1, y, frame);
  for (const i of [1, 2]) s.line(x0, y + i * step, x1, y + i * step, { width: 0.28, color: s.c.gridInner, dash: [1.2, 2.1] });
  for (let c = 0; c <= COLS; c++) s.line(x0 + c * CELL, y, x0 + c * CELL, y + PINYIN_BOX, frame);
}

function row(s: Sheet, y: number, guide: GridStyle, from = 0, to = COLS) {
  for (let i = from; i < to; i++) s.cell(contentLeft + i * CELL, y, CELL, guide);
}

/** A tracked label followed by a line to write on, up to `end`. */
function blank(s: Sheet, label: string, x: number, y: number, end: number): void {
  const w = s.text(label, x, y, { size: T.label, color: s.c.ink3, bold: true, tracking: LABEL_TRACKING });
  s.line(x + w + 6, y + 1.5, end, y + 1.5, { width: 0.4, color: s.c.rule });
}

/** As many rows of `h` as fit, with `gap` between them. */
const fits = (h: number, gap: number, height = bodyHeight) => Math.floor((height + gap + 0.5) / (h + gap));

const DRAW: Record<BlankId, (s: Sheet) => void> = {
  mizi: (s) => {
    const n = fits(CELL, 0);
    for (let r = 0; r < n; r++) row(s, bodyTop + r * CELL, 'mizi');
  },

  tian: (s) => {
    const n = fits(CELL, 0);
    for (let r = 0; r < n; r++) row(s, bodyTop + r * CELL, 'tian');
  },

  // As many rows as fit with a little air between them, and that air shared
  // out so the last row ends at the foot of the page, not above an empty band.
  pinyin: (s) => {
    const h = PINYIN_BOX + CELL;
    const n = fits(h, 4);
    const gap = n > 1 ? (bodyHeight - n * h) / (n - 1) : 0;
    for (let r = 0; r < n; r++) {
      const y = bodyTop + r * (h + gap);
      pinyinBoxes(s, y);
      row(s, y + PINYIN_BOX, 'tian');
    }
  },

  // A block per character: the model in a double square on the left, its
  // facts on lines to the right, ten goes under those and twelve more below.
  newchar: (s) => {
    const h = CELL * 3;
    const gap = 14;
    const n = fits(h, gap);
    const big = CELL * 2;
    for (let b = 0; b < n; b++) {
      const y = bodyTop + b * (h + gap);
      if (b > 0) s.line(contentLeft, y - gap / 2, contentRight, y - gap / 2, { width: 0.4, color: s.c.hair });
      s.cell(contentLeft, y, big, 'mizi');
      const x = contentLeft + big + 10;
      const mid = contentLeft + big + (contentWidth - big) * 0.52;
      blank(s, 'PINYIN', x, y + 15, mid - 12);
      blank(s, 'MEANING', mid, y + 15, contentRight);
      blank(s, 'STROKES', x, y + 34, mid - 12);
      blank(s, 'WORDS', mid, y + 34, contentRight);
      row(s, y + CELL, 'mizi', 2, COLS);
      row(s, y + big, 'mizi');
    }
  },

  compose: (s) => {
    blank(s, 'TITLE', contentLeft, bodyTop + 8, contentLeft + contentWidth * 0.62);
    blank(s, 'DATE', contentLeft + contentWidth * 0.68, bodyTop + 8, contentRight);
    const top = bodyTop + 22;
    const gap = 9;
    const n = fits(CELL, gap, bodyBottom - top);
    for (let r = 0; r < n; r++) row(s, top + r * (CELL + gap), 'blank');
  },

  // Two columns of ten. Each word gets a number, a staff for its pinyin and
  // four squares, which holds anything up to 出租汽车 and leaves the sixth
  // column clear for the tick or the correction.
  dictation: (s) => {
    const h = STAFF + CELL;
    const gap = 8;
    const n = fits(h, gap);
    const half = COLS / 2;
    for (let r = 0; r < n; r++) {
      const y = bodyTop + r * (h + gap);
      for (let c = 0; c < 2; c++) {
        const x0 = contentLeft + c * half * CELL;
        const no = String(c * n + r + 1);
        s.textRight(no, x0 + CELL - 8, y + STAFF + CELL / 2 + 3, { size: T.lead, color: s.c.ink3 });
        staff(s, x0 + CELL, y, CELL * 4);
        for (let i = 1; i <= 4; i++) s.cell(x0 + i * CELL, y + STAFF, CELL, 'tian');
      }
    }
  },
};

/**
 * The page's own facts, written in by hand: its number among the pages of
 * the exercise book (a printed "3 / 10" says nothing once the pages are
 * spread across weeks and folders), and the date.
 */
function rightOf(id: BlankId): string {
  if (id === 'dictation') return 'score ______ / 20      page ______      date ____________';
  if (id === 'compose') return 'page ______';
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
