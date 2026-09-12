import type { PDFPage, RGB } from 'pdf-lib';
import { FIT_FLOOR, strokeBounds } from '../data/bounds';
import type { GridStyle } from '../domain/sheet';
import type { StrokeData, StrokeMap } from '../data/types';
import { splitRuns, type Fonts } from './fonts';
import { PAGE } from './layout/page';
import { LABEL_TRACKING, T, type Colours, type SheetStyle, type SheetTheme } from './theme';

/**
 * hanzi-writer stores outlines with the y axis pointing up, the glyph body
 * spanning roughly y = -124..900. pdf-lib's drawSvgPath expects SVG
 * conventions (y down) and flips them back, so the data has to be mirrored
 * first or every character comes out upside down. Verified empirically: 上
 * renders as 下 without this.
 */
const NUM = /-?\d+(?:\.\d+)?/g;
const flipCache = new Map<string, string>();

export function toSvgPath(d: string): string {
  const hit = flipCache.get(d);
  if (hit) return hit;
  let i = 0;
  // Every command in this dataset (M, L, Q, C, Z) takes coordinate pairs, so
  // odd-indexed numbers across the whole string are y values.
  const out = d.replace(NUM, (n) => (i++ % 2 === 1 ? String(900 - Number(n)) : n));
  flipCache.set(d, out);
  return out;
}

interface TextOpts {
  size?: number;
  color?: RGB;
  bold?: boolean;
  /** shrink-to-fit, then ellipsise, if the text is wider than this */
  maxWidth?: number;
  opacity?: number;
  /**
   * Extra space between characters. Small caps set at label size close up and
   * turn into a smudge without it; this is the one typographic control the
   * page really needs.
   */
  tracking?: number;
}

/** Air a tinted panel keeps around its text, and clear of the label above it. */
const PANEL_AIR = 6;
const LABEL_CLEAR = 1.5;

const GUIDE_DASH: Record<SheetStyle['guide'], number[] | undefined> = {
  dash: [1.2, 2.1],
  dot: [0.35, 2.3],
  solid: undefined,
};

/**
 * A page addressed from the top-left corner, like every other layout system,
 * instead of PDF's bottom-left origin — and the one place that knows what the
 * chosen theme means in ink.
 *
 * Blocks ask for `s.label(...)`, `s.note(...)`, `s.cell(...)` rather than for
 * a colour and a line width, which is what keeps a design variant from being
 * able to move anything: it can only change how these draw, never where.
 */
export class Sheet {
  readonly c: Colours;
  readonly st: SheetStyle;

  constructor(
    readonly page: PDFPage,
    readonly fonts: Fonts,
    readonly strokes: StrokeMap,
    theme: SheetTheme,
  ) {
    this.c = theme.c;
    this.st = theme.s;
  }

  private up(y: number) {
    return PAGE.height - y;
  }

  measure(s: string, size = 9, bold = false, tracking = 0): number {
    let w = 0;
    for (const r of splitRuns(s, this.fonts, bold)) {
      try {
        w += r.font.widthOfTextAtSize(r.text, size);
      } catch {
        /* unmappable glyph - treat as zero width rather than fail the page */
      }
    }
    return w + (tracking ? tracking * Math.max(0, [...s].length - 1) : 0);
  }

  /** Draws mixed English/Chinese text; `y` is the baseline. Returns its width. */
  text(s: string, x: number, y: number, o: TextOpts = {}): number {
    if (!s) return 0;
    let size = o.size ?? 9;
    let str = s;
    if (o.maxWidth) {
      // Shrink a little before resorting to an ellipsis: worksheets read
      // better with a whole phrase set slightly smaller than a clipped one.
      let w = this.measure(str, size, o.bold);
      if (w > o.maxWidth) {
        const shrunk = Math.max(size * 0.82, o.maxWidth / (w / size));
        size = Math.max(5.2, Math.min(size, shrunk));
        w = this.measure(str, size, o.bold);
      }
      while (str.length > 1 && w > o.maxWidth) {
        str = str.slice(0, -1);
        w = this.measure(str + '…', size, o.bold);
      }
      if (str !== s) str += '…';
    }

    const track = o.tracking ?? 0;
    let cx = x;
    for (const r of splitRuns(str, this.fonts, o.bold)) {
      // Tracked text has to go a character at a time; there is no letter-space
      // parameter in a PDF text-showing operator that pdf-lib exposes.
      const atoms = track ? [...r.text] : [r.text];
      for (const a of atoms) {
        try {
          this.page.drawText(a, {
            x: cx,
            y: this.up(y),
            size,
            font: r.font,
            color: o.color ?? this.c.ink,
            opacity: o.opacity,
          });
          cx += r.font.widthOfTextAtSize(a, size) + track;
        } catch {
          /* skip anything the subset cannot draw */
        }
      }
    }
    return cx - x - (track ? track : 0);
  }

  /**
   * Draws wrapped text and returns the height it used. Breaks on spaces for
   * Latin and between characters for Chinese, which has no spaces to break on.
   *
   * `dry` measures without drawing, which is how a tinted panel learns how
   * tall to be before the text that decides it goes on top.
   */
  paragraph(
    text: string,
    x: number,
    y: number,
    width: number,
    o: TextOpts & { lineHeight?: number; maxLines?: number; dry?: boolean } = {},
  ): number {
    const size = o.size ?? 8;
    const lh = o.lineHeight ?? size * 1.32;
    const maxLines = o.maxLines ?? 4;
    const words = text.split(/(\s+)/).filter((w) => w !== '');

    const lines: string[] = [];
    let line = '';
    const push = () => {
      if (line.trim()) lines.push(line.trim());
      line = '';
    };
    for (const w of words) {
      // A long CJK run has no spaces, so measure it character by character.
      const atoms = /[　-鿿]/.test(w) ? [...w] : [w];
      for (const a of atoms) {
        const next = line + a;
        if (line && this.measure(next, size, o.bold) > width) {
          push();
          line = a.trimStart();
        } else {
          line = next;
        }
        if (lines.length >= maxLines) break;
      }
      if (lines.length >= maxLines) break;
    }
    push();

    const shown = lines.slice(0, maxLines);
    if (lines.length > maxLines) shown[maxLines - 1] += '…';
    if (!o.dry) {
      shown.forEach((l, i) => this.text(l, x, y + i * lh, { ...o, size, maxWidth: width }));
    }
    return shown.length * lh;
  }

  textRight(s: string, right: number, y: number, o: TextOpts = {}) {
    return this.text(s, right - this.measure(s, o.size ?? 9, o.bold, o.tracking), y, o);
  }

  textCentre(s: string, centre: number, y: number, o: TextOpts = {}) {
    return this.text(s, centre - this.measure(s, o.size ?? 9, o.bold, o.tracking) / 2, y, o);
  }

  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    o: { width?: number; color?: RGB; dash?: number[]; opacity?: number } = {},
  ) {
    this.page.drawLine({
      start: { x: x1, y: this.up(y1) },
      end: { x: x2, y: this.up(y2) },
      thickness: o.width ?? 0.5,
      color: o.color ?? this.c.rule,
      dashArray: o.dash,
      opacity: o.opacity,
    });
  }

  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    o: { fill?: RGB; border?: RGB; borderWidth?: number; opacity?: number } = {},
  ) {
    this.page.drawRectangle({
      x,
      y: this.up(y + h),
      width: w,
      height: h,
      color: o.fill,
      borderColor: o.border,
      borderWidth: o.borderWidth ?? (o.border ? 0.5 : 0),
      opacity: o.opacity,
    });
  }

  /** A rectangle with soft corners, for the framed style. */
  roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    o: { fill?: RGB; border?: RGB; borderWidth?: number } = {},
  ) {
    const k = Math.min(r, w / 2, h / 2);
    const d =
      `M ${k} 0 H ${w - k} A ${k} ${k} 0 0 1 ${w} ${k} V ${h - k}` +
      ` A ${k} ${k} 0 0 1 ${w - k} ${h} H ${k}` +
      ` A ${k} ${k} 0 0 1 0 ${h - k} V ${k} A ${k} ${k} 0 0 1 ${k} 0 Z`;
    this.page.drawSvgPath(d, {
      x,
      y: this.up(y),
      color: o.fill,
      borderColor: o.border,
      borderWidth: o.borderWidth ?? (o.border ? 0.5 : 0),
    });
  }

  // ------------------------------------------------------------- furniture

  /**
   * A section label: tracked small caps in the tertiary grey, present and
   * never loud. The design variant decides whether it also carries a rule
   * across the column, an accent, or nothing at all.
   */
  label(text: string, x: number, y: number, width: number, note?: string): void {
    const accent = this.st.label === 'capsAccent';
    const quiet = this.st.label === 'quiet';
    const w = this.text(text, x, y, {
      size: T.label,
      color: accent ? this.c.accent : this.c.ink3,
      bold: !quiet,
      tracking: quiet ? LABEL_TRACKING + 0.35 : LABEL_TRACKING,
    });
    let end = x + w;
    if (note) {
      end +=
        8 +
        this.text(note, end + 8, y, {
          size: T.label,
          color: this.c.ink3,
          tracking: 0.2,
        });
    }
    if (this.st.label === 'capsRule' && end + 10 < x + width) {
      this.line(end + 6, y - 2, x + width, y - 2, {
        width: 0.35,
        color: this.c.hair,
      });
    }
  }

  /**
   * A prose note — an etymology, a look-alike warning. Classic marks it with a
   * rule in the accent, Workbook and Card sit it on a tint, Quiet leaves it
   * alone and lets the indent do the work.
   *
   * Draw it *before* the text: the tint is a background, and a rectangle
   * painted afterwards would bury the note it is meant to hold. `height` comes
   * from measuring the text first, so the mark can never run past the last
   * line it belongs to.
   *
   * `labelBaseline` is where the section label above sits, when there is one.
   * The tint may not take its air out of that label: the label is drawn first,
   * and a background that reaches past its baseline paints over the foot of
   * every letter — which is what buried the bottom third of WHERE IT COMES
   * FROM. It takes what is left instead, and the same amount underneath, so a
   * squeezed panel stays centred on its text rather than sliding down it.
   */
  note(x: number, y: number, width: number, height: number, labelBaseline?: number): void {
    if (this.st.panel === 'rule') {
      this.rect(x, y, 1.6, height, { fill: this.c.accent });
    } else if (this.st.panel === 'tint') {
      // Room to breathe on all four sides. A tint drawn tight to the text
      // reads as a highlighter pen; one with air around it reads as a panel.
      const ceiling = labelBaseline === undefined ? -Infinity : labelBaseline + LABEL_CLEAR;
      const air = Math.max(0, Math.min(PANEL_AIR, y - ceiling));
      this.roundRect(x - 5, y - air, width + 10, height + air * 2, 3, { fill: this.c.panel });
    }
  }

  /**
   * The band behind a block's heading, in the designs that use one.
   *
   * A step deeper than `panel`, because in Workbook a prose panel sits a few
   * points below this band: at the same tint the two read as one interrupted
   * heading rather than as a heading and a note inside it.
   */
  headBand(x: number, y: number, width: number, height: number) {
    if (this.st.headBand) this.roundRect(x, y, width, height, 3, { fill: this.c.band });
  }

  /** One practice square: 米字格, 田字格 or plain. */
  cell(x: number, y: number, size: number, gridStyle: GridStyle = 'mizi') {
    this.rect(x, y, size, size, {
      border: this.c.grid,
      borderWidth: this.st.cellWeight,
    });
    if (gridStyle === 'blank') return;
    const dash = GUIDE_DASH[this.st.guide];
    const width = this.st.guide === 'solid' ? 0.22 : 0.28;
    const mid = size / 2;
    const o = { width, color: this.c.gridInner, dash };
    this.line(x, y + mid, x + size, y + mid, o);
    this.line(x + mid, y, x + mid, y + size, o);
    if (gridStyle === 'mizi') {
      this.line(x, y, x + size, y + size, o);
      this.line(x + size, y, x, y + size, o);
    }
  }

  /**
   * The box the big glyph sits in at the top of a block. A practice square in
   * most styles — it is the shape you are about to write into — a plain tint
   * in Workbook, a hairline outline in Quiet.
   */
  headBox(x: number, y: number, size: number, gridStyle: GridStyle) {
    if (this.st.headBox === 'none') return;
    if (this.st.headBand) {
      // The block already sits on a tint, so the box has to come back the
      // other way to read as a box at all.
      this.rect(x, y, size, size, {
        fill: this.c.white,
        border: this.c.hair,
        borderWidth: 0.4,
      });
    } else if (this.st.headBox === 'tint') {
      this.rect(x, y, size, size, { fill: this.c.panel });
    } else if (this.st.headBox === 'outline') {
      this.rect(x, y, size, size, { border: this.c.hair, borderWidth: 0.4 });
    } else {
      this.cell(x, y, size, gridStyle);
    }
  }

  // ---------------------------------------------------------------- glyphs

  /**
   * Draws a character from its stroke outlines.
   *
   * `upto` limits how many strokes appear, which is what builds the stroke
   * order strip. `highlight` tints the last drawn stroke. `groups` colours each
   * stroke by which component of the character it belongs to.
   *
   * `fit` scales the outline to its own extent rather than to the character
   * square. A radical form is stored in the place it takes inside a real
   * character — 忄 a narrow strip on the left — which is what a practice
   * square should show and what a stroke-order box a centimetre wide cannot.
   */
  glyph(
    char: string,
    x: number,
    y: number,
    size: number,
    o: {
      upto?: number;
      color?: RGB;
      highlight?: RGB;
      groups?: boolean;
      inset?: number;
      opacity?: number;
      fit?: boolean;
    } = {},
  ): boolean {
    const data: StrokeData | undefined = this.strokes[char];
    if (!data) return false;

    const inset = o.inset ?? 0.08;
    const inner = size * (1 - inset * 2);
    let s = inner / 1024;
    let left = x + size * inset;
    let top = y + size * inset;
    if (o.fit) {
      const b = strokeBounds(data);
      s = inner / Math.max(b.w, b.h, FIT_FLOOR);
      left += (inner - b.w * s) / 2 - b.x * s;
      top += (inner - b.h * s) / 2 - b.y * s;
    }
    const upto = o.upto ?? data.s.length;
    const base = o.color ?? this.c.ink;
    // Tinting by component only says something when there is more than one
    // component; otherwise every stroke would just come out the same accent.
    const tint = o.groups && data.g && new Set(data.g).size > 1 ? data.g : null;

    for (let i = 0; i < Math.min(upto, data.s.length); i++) {
      let color = base;
      if (tint) color = this.c.components[tint[i] % this.c.components.length];
      if (o.highlight && i === upto - 1) color = tint ? color : o.highlight;
      this.page.drawSvgPath(toSvgPath(data.s[i]), {
        x: left,
        y: this.up(top),
        scale: s,
        color,
        opacity: o.opacity,
        borderWidth: 0,
      });
    }
    return true;
  }

  /**
   * A glyph that falls back to the font when there is no outline for it, so a
   * rare component still prints instead of leaving a hole.
   */
  glyphOrText(char: string, x: number, y: number, size: number, color?: RGB) {
    if (this.glyph(char, x, y, size, { color, inset: 0.02 })) return size;
    return this.text(char, x, y + size * 0.8, { size: size * 0.8, color });
  }

  strokeCount(char: string): number {
    return this.strokes[char]?.s.length ?? 0;
  }

  hasGlyph(char: string): boolean {
    return !!this.strokes[char];
  }
}
