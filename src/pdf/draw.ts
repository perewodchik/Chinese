import type { PDFPage, RGB } from 'pdf-lib';
import type { StrokeData, StrokeMap } from '../data/types';
import { splitRuns, type Fonts } from './fonts';
import { C, COMPONENT_COLOURS, PAGE } from './theme';

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

export type CellStyle = 'mizi' | 'tian' | 'blank';

interface TextOpts {
  size?: number;
  color?: RGB;
  bold?: boolean;
  /** shrink-to-fit, then ellipsise, if the text is wider than this */
  maxWidth?: number;
  opacity?: number;
}

/**
 * A page addressed from the top-left corner, like every other layout system,
 * instead of PDF's bottom-left origin.
 */
export class Sheet {
  constructor(
    readonly page: PDFPage,
    readonly fonts: Fonts,
    readonly strokes: StrokeMap,
  ) {}

  private up(y: number) {
    return PAGE.height - y;
  }

  measure(s: string, size = 9, bold = false): number {
    let w = 0;
    for (const r of splitRuns(s, this.fonts, bold)) {
      try {
        w += r.font.widthOfTextAtSize(r.text, size);
      } catch {
        /* unmappable glyph - treat as zero width rather than fail the page */
      }
    }
    return w;
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

    let cx = x;
    for (const r of splitRuns(str, this.fonts, o.bold)) {
      try {
        this.page.drawText(r.text, {
          x: cx,
          y: this.up(y),
          size,
          font: r.font,
          color: o.color ?? C.ink,
          opacity: o.opacity,
        });
        cx += r.font.widthOfTextAtSize(r.text, size);
      } catch {
        /* skip anything the subset cannot draw */
      }
    }
    return cx - x;
  }

  /**
   * Draws wrapped text and returns the height it used. Breaks on spaces for
   * Latin and between characters for Chinese, which has no spaces to break on.
   */
  paragraph(
    text: string,
    x: number,
    y: number,
    width: number,
    o: TextOpts & { lineHeight?: number; maxLines?: number } = {},
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
    shown.forEach((l, i) => this.text(l, x, y + i * lh, { ...o, size, maxWidth: width }));
    return shown.length * lh;
  }

  textRight(s: string, right: number, y: number, o: TextOpts = {}) {
    return this.text(s, right - this.measure(s, o.size ?? 9, o.bold), y, o);
  }

  textCentre(s: string, centre: number, y: number, o: TextOpts = {}) {
    return this.text(s, centre - this.measure(s, o.size ?? 9, o.bold) / 2, y, o);
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
      color: o.color ?? C.rule,
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

  /** One practice square: 米字格, 田字格 or plain. */
  cell(x: number, y: number, size: number, style: CellStyle = 'mizi') {
    this.rect(x, y, size, size, { border: C.grid, borderWidth: 0.55 });
    if (style === 'blank') return;
    const dash = [1.3, 1.9];
    const mid = size / 2;
    this.line(x, y + mid, x + size, y + mid, { width: 0.32, color: C.gridInner, dash });
    this.line(x + mid, y, x + mid, y + size, { width: 0.32, color: C.gridInner, dash });
    if (style === 'mizi') {
      this.line(x, y, x + size, y + size, { width: 0.32, color: C.gridInner, dash });
      this.line(x + size, y, x, y + size, { width: 0.32, color: C.gridInner, dash });
    }
  }

  /**
   * Draws a character from its stroke outlines.
   *
   * `upto` limits how many strokes appear, which is what builds the stroke
   * order strip. `highlight` tints the last drawn stroke. `groups` colours each
   * stroke by which component of the character it belongs to.
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
    } = {},
  ): boolean {
    const data: StrokeData | undefined = this.strokes[char];
    if (!data) return false;

    const inset = o.inset ?? 0.08;
    const s = (size * (1 - inset * 2)) / 1024;
    const left = x + size * inset;
    const top = y + size * inset;
    const upto = o.upto ?? data.s.length;
    const base = o.color ?? C.ink;
    // Tinting by component only says something when there is more than one
    // component; otherwise every stroke would just come out the same accent.
    const tint = o.groups && data.g && new Set(data.g).size > 1 ? data.g : null;

    for (let i = 0; i < Math.min(upto, data.s.length); i++) {
      let color = base;
      if (tint) color = COMPONENT_COLOURS[tint[i] % COMPONENT_COLOURS.length];
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

  strokeCount(char: string): number {
    return this.strokes[char]?.s.length ?? 0;
  }

  hasGlyph(char: string): boolean {
    return !!this.strokes[char];
  }
}
