import type { Library } from '../../../data/types';
import { pinyinOf } from '../../../domain/ownText';
import { alignPinyin } from '../../../domain/reading';
import { segment } from '../../../domain/segment';
import { isHanzi, type GeneratedText, type TextLine } from '../../../domain/text';
import { breakAtCommas, speakerOf, type VideoLook, type VideoMoment, type VideoPlan } from '../../../domain/textVideo';

/**
 * One frame of a text's video, drawn on a 1080×1920 canvas — the same drawing
 * for the studio's preview and for the recording, so what is seen is what is
 * made.
 *
 * Upright video is watched inside other apps that draw over it: their top
 * bar, the caption and buttons along the bottom, likes down the right. So
 * nothing that must be read goes there (`SAFE`): the chapter's name starts
 * below the top bar, and the subtitles end above the bottom and keep left of
 * the buttons.
 */

export interface Geometry {
  w: number;
  h: number;
  /** what may be read stays between `top` and `bottom`, and left of `right` from `buttonsFrom` down */
  safe: { top: number; bottom: number; right: number; buttonsFrom: number };
  /** left-aligned text starts here and is `textW` wide */
  left: number;
  textW: number;
  /** centred text is centred here and at most `centredW` wide */
  cx: number;
  centredW: number;
}

/**
 * The frame for each shape. Upright (9:16) is watched in apps that draw over
 * it, so it keeps clear of their bars and buttons; wide (16:9) is watched on
 * a screen of its own, with only a margin.
 */
export function geometry(shape: VideoLook['shape']): Geometry {
  if (shape === '16:9') {
    const w = 1920;
    const h = 1080;
    return { w, h, safe: { top: 0, bottom: h - 40, right: 0, buttonsFrom: h }, left: 140, textW: w - 280, cx: w / 2, centredW: 1500 };
  }
  const w = 1080;
  const h = 1920;
  const safe = { top: 230, bottom: 1536, right: 162, buttonsFrom: 576 };
  return { w, h, safe, left: 60, textW: w - safe.right - 60, cx: w / 2, centredW: w - 2 * safe.right };
}

/** The frame being drawn: set as each one begins. */
let G = geometry('9:16');

const SIZES = { s: 64, m: 80, l: 96, xl: 112 } as const;

export interface FrameInput {
  text: GeneratedText;
  /** the shelf's name, for "Book and chapter" */
  book: string;
  plan: VideoPlan;
  moment: VideoMoment;
  look: VideoLook;
  pictures: Map<string, HTMLImageElement>;
  lib: Library;
}

interface Ink {
  bg: string;
  ink: string;
  py: string;
  lit: string;
  right: string;
  accent: string;
  /** light writing on a dark ground */
  dark: boolean;
  /** the title band over the top */
  band: string;
}

const PAPER: Ink = { bg: '#fbf8f1', ink: '#18202b', py: '#4a5464', lit: 'rgba(255, 212, 60, 0.5)', right: '#1f7a55', accent: '#1e4a8a', dark: false, band: 'rgba(251, 248, 241, 0.92)' };
const NIGHT: Ink = { bg: '#1b2027', ink: '#eef1f4', py: '#b4bcc6', lit: 'rgba(255, 212, 60, 0.3)', right: '#6fc39a', accent: '#9db8e8', dark: true, band: 'rgba(27, 32, 39, 0.88)' };
/** A green chalkboard, chalk on it, the line being read under yellow chalk. */
const BOARD: Ink = { bg: '#2e4a3c', ink: '#f3f1e7', py: '#c7d6c9', lit: 'rgba(255, 236, 140, 0.26)', right: '#bfe6a8', accent: '#f2d16b', dark: true, band: 'rgba(38, 61, 50, 0.92)' };
/** Old book paper: warm, brown ink. */
const SEPIA: Ink = { bg: '#f2e6cc', ink: '#3b2b1c', py: '#6e5a42', lit: 'rgba(230, 170, 70, 0.4)', right: '#5d7a2e', accent: '#8a5a2b', dark: false, band: 'rgba(242, 230, 204, 0.93)' };
const THEMES = { paper: PAPER, night: NIGHT, board: BOARD, sepia: SEPIA } as const;

/** Each speaker's own colour, in the order they first speak. */
const SPEAKER_COLOURS = ['#c2410c', '#1d4ed8', '#7e22ce', '#0f766e', '#a16207'];
const ON_PICTURE: Ink = { ...NIGHT, ink: '#ffffff', py: '#d7dde4' };

const hanFont = (look: VideoLook, px: number) =>
  look.type === 'kai' ? `${px}px WenKai, "Kaiti SC", STKaiti, serif` : `${px}px "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif`;
const pyFont = (px: number) => `500 ${px}px "Fira Sans", -apple-system, sans-serif`;
const enFont = (px: number) => `${px}px Literata, Georgia, serif`;

/* ------------------------------------------------------------ the text */

interface Cell {
  c: string;
  py: string;
  w: number;
}
interface Row {
  cells: Cell[];
  w: number;
  /** its width without the punctuation at its end, which hangs: what it is centred by */
  seen: number;
  /** pinyin over this row */
  py: boolean;
}
interface Block {
  rows: Row[];
  /** which row each of the block's sentences starts at, and ends before */
  spans: Array<[number, number]>;
  w: number;
  h: number;
  zh: number;
  py: number;
}

const OPENING = /[“‘「『（《【(]/;
const HANGING = /[，。！？、；：,.!?;:”’」』）》】)\s]/;

const unitsCache = new Map<string, Array<Array<{ c: string; py: string }>>>();

/** A sentence as words, each its characters with the pinyin over them; punctuation held to the word before it. */
function unitsOf(line: Pick<TextLine, 'zh' | 'py'>, lib: Library) {
  const id = `${line.zh}\n${line.py}`;
  const hit = unitsCache.get(id);
  if (hit) return hit;
  const syllables = alignPinyin(line, lib);
  let k = 0;
  const units: Array<Array<{ c: string; py: string }>> = [];
  // An opening quote or bracket goes with the word after it, never at the end of a row.
  let opening: Array<{ c: string; py: string }> = [];
  for (const t of segment(line.zh, lib)) {
    const chars = [...t.text].map((c) => ({ c, py: isHanzi(c) ? (syllables[k++] ?? '') : '' }));
    if (t.word) {
      units.push([...opening, ...chars]);
      opening = [];
      continue;
    }
    // Other punctuation is held to the word before it; a space stays a space (第一章 森林里的苹果).
    for (const ch of chars) {
      if (OPENING.test(ch.c)) opening.push(ch);
      else if (opening.length) opening.push(ch);
      else if (units.length) units[units.length - 1]!.push(ch);
      else if (ch.c.trim()) units.push([ch]);
    }
  }
  if (opening.length) units.push(opening);
  unitsCache.set(id, units);
  return units;
}

/** Lines laid out as rows no wider than `maxW`, a sentence starting a new row; broken at commas when asked. */
type Said = Pick<TextLine, 'zh' | 'py'> & { noPinyin?: boolean };

function layout(
  ctx: CanvasRenderingContext2D,
  lines: Said[],
  o: { look: VideoLook; zh: number; maxW: number; commas: boolean; lib: Library },
): Block {
  const py = o.look.pinyin ? Math.round(o.zh * 0.4) : 0;
  const rows: Row[] = [];
  const spans: Array<[number, number]> = [];
  for (const line of lines) {
    const start = rows.length;
    const withPy = Boolean(py) && !line.noPinyin;
    const pieces = o.commas ? breakAtCommas(line.zh) : [line.zh];
    const units = unitsOf(line, o.lib);
    // The units belong to the whole line; the pieces say where rows must break.
    const breaks = new Set<number>();
    let acc = 0;
    for (const piece of pieces.slice(0, -1)) {
      acc += [...piece].length;
      breaks.add(acc);
    }
    let row: Row = { cells: [], w: 0, seen: 0, py: withPy };
    let at = 0;
    for (const unit of units) {
      const cells = unit.map(({ c, py: s }) => {
        ctx.font = hanFont(o.look, o.zh);
        const cw = ctx.measureText(c).width;
        ctx.font = pyFont(py || 1);
        const pw = s && withPy ? ctx.measureText(s).width + py * 0.3 : 0;
        return { c, py: s, w: Math.max(cw, pw) };
      });
      const w = cells.reduce((n, c) => n + c.w, 0);
      if (row.cells.length && row.w + w > o.maxW) {
        rows.push(row);
        row = { cells: [], w: 0, seen: 0, py: withPy };
      }
      row.cells.push(...cells);
      row.w += w;
      at += unit.length;
      if (breaks.has(at) || [...breaks].some((b) => b > at - unit.length && b < at)) {
        rows.push(row);
        row = { cells: [], w: 0, seen: 0, py: withPy };
      }
    }
    if (row.cells.length) rows.push(row);
    spans.push([start, rows.length]);
  }
  for (const r of rows) {
    let hang = 0;
    for (let i = r.cells.length - 1; i >= 0 && HANGING.test(r.cells[i]!.c); i--) hang += r.cells[i]!.w;
    r.seen = r.w - hang;
  }
  const b: Block = { rows, spans, w: Math.max(0, ...rows.map((r) => r.w)), h: 0, zh: o.zh, py };
  b.h = rows.reduce((n, r) => n + rowHeight(b, r), 0);
  return b;
}

const rowHeight = (b: Block, r: Row) => (r.py && b.py ? b.py * 1.3 : 0) + b.zh * 1.28;
/** Where each row starts, from the block's top. */
const rowTops = (b: Block) => {
  let y = 0;
  return b.rows.map((r) => {
    const top = y;
    y += rowHeight(b, r);
    return top;
  });
};

/**
 * A sentence wrapped into rows of about the same length, not a full row and
 * a scrap (他们坐在树下吃 | 苹果。): the narrowest width that needs no more
 * rows than the full width did.
 */
function balanced(ctx: CanvasRenderingContext2D, lines: Said[], o: Parameters<typeof layout>[2]): Block {
  const b = layout(ctx, lines, o);
  if (lines.length !== 1 || b.rows.length < 2) return b;
  const total = b.rows.reduce((n, r) => n + r.w, 0);
  for (let w = total / b.rows.length; w < o.maxW; w *= 1.05) {
    const tried = layout(ctx, lines, { ...o, maxW: w });
    if (tried.rows.length <= b.rows.length) return tried;
  }
  return b;
}

/** The largest layout up to `zh` that fits `maxH`. */
function fitted(ctx: CanvasRenderingContext2D, lines: Said[], o: Parameters<typeof layout>[2], maxH: number): Block {
  let zh = o.zh;
  let b = balanced(ctx, lines, { ...o, zh });
  while (b.h > maxH && zh > o.zh * 0.45) {
    zh = Math.round(zh * 0.9);
    b = balanced(ctx, lines, { ...o, zh });
  }
  return b;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  b: Block,
  x: number,
  top: number,
  o: { look: VideoLook; ink: Ink; align: 'center' | 'left'; outline?: boolean; lit?: number },
) {
  const tops = rowTops(b);
  if (o.lit !== undefined && b.spans[o.lit]) {
    const [from, to] = b.spans[o.lit]!;
    ctx.fillStyle = o.ink.lit;
    for (let r = from; r < to; r++) {
      const row = b.rows[r]!;
      const left = o.align === 'center' ? x - row.seen / 2 : x;
      roundRect(ctx, left - 10, top + tops[r]! + (row.py && b.py ? b.py * 1.1 : 0) + b.zh * 0.04, row.w + 20, b.zh * 1.2, 12);
      ctx.fill();
    }
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  b.rows.forEach((row, r) => {
    let cx = o.align === 'center' ? x - row.seen / 2 : x;
    const y = top + tops[r]!;
    const pyH = row.py && b.py ? b.py * 1.3 : 0;
    for (const cell of row.cells) {
      const mid = cx + cell.w / 2;
      if (pyH && cell.py) {
        ctx.font = pyFont(b.py);
        text(ctx, cell.py, mid, y + b.py, o.ink.py, o.outline ? b.py * 0.22 : 0);
      }
      ctx.font = hanFont(o.look, b.zh);
      text(ctx, cell.c, mid, y + pyH + b.zh * 0.98, o.ink.ink, o.outline ? b.zh * 0.12 : 0);
      cx += cell.w;
    }
  });
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, colour: string, outline: number) {
  if (outline) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = outline;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = colour;
  ctx.fillText(s, x, y);
}

/** English, wrapped to `maxW`, centred on x; returns its height. */
function english(ctx: CanvasRenderingContext2D, s: string, x: number, top: number, px: number, maxW: number, colour: string, outline = 0) {
  ctx.font = enFont(px);
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(next).width > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  ctx.textAlign = 'center';
  lines.forEach((l, i) => text(ctx, l, x, top + px * (1 + i * 1.3), colour, outline));
  return lines.length * px * 1.3;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ------------------------------------------------------------ speakers */

/** A speaker's colour: the same one all through the text, in the order they first speak. */
function speakerColour(text: GeneratedText, name: string): string {
  const order: string[] = [];
  for (const l of text.lines) {
    const who = speakerOf(l);
    if (who && !order.includes(who)) order.push(who);
  }
  return SPEAKER_COLOURS[Math.max(0, order.indexOf(name)) % SPEAKER_COLOURS.length]!;
}

const NAME_H = 74;

/** A speaker's name in their colour, as a tab over the line they say. */
function nameTab(ctx: CanvasRenderingContext2D, f: FrameInput, name: string, x: number, y: number, align: 'center' | 'left') {
  ctx.font = hanFont(f.look, 44);
  const w = ctx.measureText(name).width + 44;
  const left = align === 'center' ? x - w / 2 : x;
  ctx.fillStyle = speakerColour(f.text, name);
  roundRect(ctx, left, y, w, 60, 14);
  ctx.fill();
  ctx.textAlign = 'center';
  text(ctx, name, left + w / 2, y + 45, '#ffffff', 0);
}

/* ------------------------------------------------------------ pictures */

/** A picture filling the box, cropped to it, a little larger by `zoom` (1 = as it is). */
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, zoom = 1, alpha = 1) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const iw = img.naturalWidth * s;
  const ih = img.naturalHeight * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

/** The paragraph's picture in a box, fading from the last paragraph's as it begins, slowly zooming while it is up. */
function picture(ctx: CanvasRenderingContext2D, f: FrameInput, para: number, box: [number, number, number, number], fit: 'cover' | 'width' = 'cover') {
  const step = f.moment.step;
  const key = f.plan.pictureOf[para];
  const img = key ? f.pictures.get(key) : undefined;
  if (!img?.naturalWidth) return;
  // How far through the paragraph, its pause included, for the zoom.
  const span = f.plan.steps.filter((s) => (s.kind === 'para' || s.kind === 'pause') && s.para === para);
  const from = span[0]?.at ?? step.at;
  const len = span.reduce((n, s) => n + s.dur, 0) || 1;
  const t = Math.min(1, Math.max(0, (step.at + f.moment.into - from) / len));
  const zoom = f.look.zoom ? 1 + 0.06 * t : 1;
  const [x, y, w, h] = fit === 'width' ? [box[0], box[1] + (box[3] - (box[2] * img.naturalHeight) / img.naturalWidth) / 2, box[2], (box[2] * img.naturalHeight) / img.naturalWidth] : box;
  const prevKey = para > 0 ? f.plan.pictureOf[para - 1] : null;
  const prev = prevKey && prevKey !== key ? f.pictures.get(prevKey) : undefined;
  const fading = f.look.fade && prev?.naturalWidth && step.kind === 'para' && f.moment.into < 500;
  if (fading) {
    cover(ctx, prev!, x, y, w, h, f.look.zoom ? 1.06 : 1);
    cover(ctx, img, x, y, w, h, zoom, f.moment.into / 500);
  } else cover(ctx, img, x, y, w, h, zoom);
}

/* ------------------------------------------------------------ the frame */

export function drawFrame(ctx: CanvasRenderingContext2D, f: FrameInput) {
  const { look, moment, text: t } = f;
  G = geometry(look.shape);
  const wide = look.shape === '16:9';
  const ink = THEMES[look.background];
  const zh = SIZES[look.size];
  ctx.save();
  ctx.fillStyle = ink.bg;
  ctx.fillRect(0, 0, G.w, G.h);

  const step = moment.step;
  const over = look.layout === 'over' && (step.kind === 'para' || step.kind === 'pause');
  const titleH = look.title === 'off' ? 0 : look.title === 'book' ? (wide ? 130 : 150) : wide ? 96 : 112;
  const below = G.safe.top + titleH;

  if (step.kind === 'hook') {
    // The opening: the cover picture filling the screen, darkened, and the question over it.
    const img = f.plan.cover ? f.pictures.get(f.plan.cover) : undefined;
    if (img?.naturalWidth) {
      cover(ctx, img, 0, 0, G.w, G.h, look.zoom ? 1.04 + (0.04 * moment.into) / step.dur : 1.04);
      ctx.fillStyle = 'rgba(12, 15, 19, 0.45)';
      ctx.fillRect(0, 0, G.w, G.h);
    }
    const ask = f.plan.hook ?? '';
    const b = fitted(ctx, [{ zh: ask, py: pinyinOf(ask, f.lib) }], { look, zh: Math.round(zh * 1.45), maxW: wide ? 1100 : G.textW, commas: true, lib: f.lib }, wide ? 640 : 700);
    drawBlock(ctx, b, G.left, wide ? (G.h - b.h) / 2 : G.safe.top + 260, { look, ink: img?.naturalWidth ? ON_PICTURE : ink, align: 'left', outline: Boolean(img?.naturalWidth) });
  } else if (step.kind === 'title' && wide) {
    // Wide: the cover on the left half, the book and the chapter on the right.
    const img = f.plan.cover ? f.pictures.get(f.plan.cover) : undefined;
    if (img?.naturalWidth) cover(ctx, img, 0, 0, G.w / 2, G.h, look.zoom ? 1 + (0.04 * moment.into) / step.dur : 1);
    const x = (G.w * 3) / 4;
    const title = fitted(ctx, [{ zh: t.titleZh || t.title, py: '' }], { look: { ...look, pinyin: false }, zh: 80, maxW: G.w / 2 - 100, commas: false, lib: f.lib }, 420);
    const en = t.title && t.titleZh && t.title !== t.titleZh;
    const h = (f.book ? 70 : 0) + title.h + (en ? 70 : 0);
    let y = (G.h - h) / 2;
    if (f.book) {
      ctx.font = hanFont(look, 44);
      ctx.textAlign = 'center';
      text(ctx, f.book, x, y + 44, ink.py, 0);
      y += 70;
    }
    drawBlock(ctx, title, x, y, { look, ink, align: 'center' });
    if (en) english(ctx, t.title, x, y + title.h + 10, 40, G.w / 2 - 200, ink.py);
  } else if (step.kind === 'title') {
    const img = f.plan.cover ? f.pictures.get(f.plan.cover) : undefined;
    if (img?.naturalWidth) cover(ctx, img, 0, G.safe.top - 60, G.w, 760, look.zoom ? 1 + (0.04 * moment.into) / step.dur : 1);
    let y = G.safe.top + 760;
    if (f.book) {
      ctx.font = hanFont(look, 44);
      ctx.textAlign = 'center';
      text(ctx, f.book, G.w / 2, y + 30, ink.py, 0);
      y += 40;
    }
    const title = fitted(ctx, [{ zh: t.titleZh || t.title, py: '' }], { look: { ...look, pinyin: false }, zh: 104, maxW: G.w - 160, commas: false, lib: f.lib }, 360);
    drawBlock(ctx, title, G.w / 2, y + 30, { look, ink, align: 'center' });
    y += 30 + title.h + 10;
    if (t.title && t.titleZh && t.title !== t.titleZh) english(ctx, t.title, G.w / 2, y, 40, G.w - 200, ink.py);
  } else if (step.kind === 'para' || step.kind === 'pause') {
    const para = step.para;
    const lines = f.plan.paras[para]!;
    const current = moment.line ?? lines[0]!;
    const line = t.lines[current]!;
    const from = look.title === 'off' ? G.safe.top : below;
    if (wide && look.layout === 'above') {
      // Wide: the picture as drawn, centred, the line under it.
      const picH = Math.round((G.h - from) * 0.64);
      const picW = Math.round((picH * 4) / 3);
      picture(ctx, f, para, [(G.w - picW) / 2, from + 16, picW, picH]);
      subtitle(ctx, f, line, ink, zh, [from + 16 + picH + 10, G.safe.bottom]);
    } else if (wide && look.layout === 'over') {
      // Wide: the picture fills the screen; the line sits on it at the bottom.
      picture(ctx, f, para, [0, 0, G.w, G.h]);
      subtitle(ctx, f, line, ON_PICTURE, zh, [Math.round(G.h * 0.55), G.safe.bottom], true);
    } else if (wide && look.layout === 'side') {
      // Wide: the picture on the left half, the paragraph on the right, the line being read lit.
      picture(ctx, f, para, [0, from, G.w / 2, G.h - from]);
      const all = lines.map((i) => ({ ...t.lines[i]!, noPinyin: i !== current }));
      const x = G.w / 2 + 70;
      const b = fitted(ctx, all, { look, zh: Math.round(zh * 0.8), maxW: G.w / 2 - 140, commas: false, lib: f.lib }, G.safe.bottom - from - 60);
      const y = from + (G.safe.bottom - from - b.h) / 2;
      speakerOver(ctx, f, line, b, x, y);
      drawBlock(ctx, b, x, y, { look, ink, align: 'left', lit: lines.indexOf(current) });
    } else if (wide) {
      const all = lines.map((i) => ({ ...t.lines[i]!, noPinyin: i !== current }));
      const b = fitted(ctx, all, { look, zh: Math.round(zh * 0.9), maxW: 1400, commas: false, lib: f.lib }, G.safe.bottom - from - 60);
      const x = (G.w - Math.min(b.w, 1400)) / 2;
      const y = from + (G.safe.bottom - from - b.h) / 2;
      speakerOver(ctx, f, line, b, x, y);
      drawBlock(ctx, b, x, y, { look, ink, align: 'left', lit: lines.indexOf(current) });
    } else if (look.layout === 'above') {
      const picBottom = 1110;
      picture(ctx, f, para, [0, look.title === 'off' ? G.safe.top : below, G.w, picBottom - (look.title === 'off' ? G.safe.top : below)]);
      subtitle(ctx, f, line, ink, zh, [picBottom + 30, G.safe.bottom]);
    } else if (look.layout === 'over') {
      const img = f.plan.pictureOf[para] ? f.pictures.get(f.plan.pictureOf[para]!) : undefined;
      if (img?.naturalWidth) {
        cover(ctx, img, 0, 0, G.w, G.h, 1.02);
        ctx.fillStyle = 'rgba(12, 15, 19, 0.55)';
        ctx.fillRect(0, 0, G.w, G.h);
      }
      picture(ctx, f, para, [0, below, G.w, 810], 'width');
      subtitle(ctx, f, line, ON_PICTURE, zh, [below + 830, G.safe.bottom], true);
    } else {
      const side = look.layout === 'side';
      const picH = side ? 520 : 0;
      if (side) picture(ctx, f, para, [0, look.title === 'off' ? G.safe.top : below, G.w, picH]);
      const top = (look.title === 'off' ? G.safe.top : below) + picH + 40;
      // Pinyin over the line being read only: over a whole paragraph it would crowd it out.
      const all = lines.map((i) => ({ ...t.lines[i]!, noPinyin: i !== current }));
      const b = fitted(ctx, all, { look, zh: Math.round(zh * (side ? 0.78 : 0.9)), maxW: G.textW, commas: false, lib: f.lib }, G.safe.bottom - top);
      const y = side ? top : top + (G.safe.bottom - top - b.h) / 2;
      speakerOver(ctx, f, line, b, G.left, y);
      drawBlock(ctx, b, G.left, y, { look, ink, align: 'left', lit: lines.indexOf(current) });
    }
  } else {
    const q = t.questions[step.q]!;
    ctx.font = pyFont(38);
    ctx.textAlign = 'center';
    text(ctx, `Question ${step.q + 1} of ${t.questions.length}`, G.cx, below + (wide ? 70 : 90), ink.py, 0);
    if (step.kind === 'question') {
      const b = fitted(ctx, [q], { look, zh: Math.round(zh * 1.15), maxW: G.centredW, commas: look.breakLines, lib: f.lib }, wide ? 360 : 520);
      const top = wide ? below + 150 : 640;
      drawBlock(ctx, b, G.cx, top, { look, ink, align: 'center' });
      let y = top + b.h + 20;
      if (look.english && q.en) y += english(ctx, q.en, G.cx, y, Math.round(zh * 0.45), G.centredW, ink.py) + 20;
      ring(ctx, G.cx, wide ? Math.min(G.h - 110, y + 110) : Math.max(y + 140, 1240), 74, step, moment.into, look, ink);
    } else {
      const ask = fitted(ctx, [q], { look: { ...look, pinyin: false }, zh: Math.round(zh * 0.75), maxW: G.centredW, commas: false, lib: f.lib }, 300);
      const askTop = wide ? below + 130 : 520;
      drawBlock(ctx, ask, G.cx, askTop, { look, ink: { ...ink, ink: ink.py }, align: 'center' });
      const answer = q.a ?? '';
      if (answer) {
        const a = fitted(ctx, [{ zh: answer, py: pinyinOf(answer, f.lib) }], { look, zh: Math.round(zh * 1.3), maxW: G.centredW, commas: look.breakLines, lib: f.lib }, 600);
        const top = askTop + 40 + ask.h + 80;
        drawBlock(ctx, a, G.cx, top, { look, ink: { ...ink, ink: ink.right }, align: 'center' });
        ctx.fillStyle = ink.right;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(G.cx - a.rows[a.rows.length - 1]!.seen / 2, top + a.h + 6, a.rows[a.rows.length - 1]!.seen, 8);
        ctx.globalAlpha = 1;
      }
    }
  }

  if (look.title !== 'off' && step.kind !== 'title' && step.kind !== 'hook') titleBand(ctx, f, over ? ON_PICTURE : ink, titleH, over);

  if (moment.of > 1) {
    // Which part, in the corner under the title, clear of the buttons further down.
    const label = `Part ${moment.part + 1} of ${moment.of}`;
    ctx.font = pyFont(32);
    const w = ctx.measureText(label).width + 36;
    const y = step.kind === 'hook' || step.kind === 'title' || look.title === 'off' ? G.safe.top + 20 : below + 20;
    ctx.fillStyle = 'rgba(20, 24, 29, 0.72)';
    roundRect(ctx, G.w - 40 - w, y, w, 52, 16);
    ctx.fill();
    ctx.textAlign = 'center';
    text(ctx, label, G.w - 40 - w / 2, y + 37, '#ffffff', 0);
  }

  if (look.mark.trim()) {
    // The learner's signature: top left under the title upright (the bottom and right are the apps'), bottom right wide.
    ctx.save();
    ctx.font = pyFont(wide ? 30 : 32);
    ctx.globalAlpha = 0.75;
    const onDark = ink.dark || over || step.kind === 'hook';
    if (wide) {
      ctx.textAlign = 'right';
      text(ctx, look.mark.trim(), G.w - 48, G.h - 40, onDark ? '#ffffff' : ink.ink, onDark ? 4 : 0);
    } else {
      ctx.textAlign = 'left';
      const y = step.kind === 'hook' || step.kind === 'title' || look.title === 'off' ? G.safe.top + 50 : below + 50;
      text(ctx, look.mark.trim(), G.left, y, onDark ? '#ffffff' : ink.ink, onDark ? 4 : 0);
    }
    ctx.restore();
  }

  if (look.progress) {
    ctx.fillStyle = ink.dark || over ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, G.h - 12, G.w, 12);
    ctx.fillStyle = ink.accent;
    ctx.fillRect(0, G.h - 12, G.w * moment.progress, 12);
  }
  ctx.restore();
}

/** In a whole paragraph, the name of who says the line being read, at the left of that line, just above it. */
function speakerOver(ctx: CanvasRenderingContext2D, f: FrameInput, line: TextLine, b: Block, x: number, y: number) {
  const name = f.look.speakers ? speakerOf(line) : null;
  if (!name) return;
  const i = f.text.lines.indexOf(line);
  const lines = f.plan.paras.find((p) => p.includes(i)) ?? [];
  const span = b.spans[lines.indexOf(i)];
  if (!span) return;
  ctx.save();
  ctx.globalAlpha = 0.95;
  // After the row's last mark, its closing quote included, at the height of its characters.
  const row = b.rows[span[1] - 1]!;
  const rowTop = y + rowTops(b)[span[1] - 1]!;
  nameTab(ctx, f, name, x + row.w + 24, rowTop + (row.py && b.py ? b.py * 1.3 : 0) + (b.zh * 1.28 - 60) / 2, 'left');
  ctx.restore();
}

/** The line being read, with its pinyin and English, in the band between `area`, nearer its bottom. */
function subtitle(ctx: CanvasRenderingContext2D, f: FrameInput, line: TextLine, ink: Ink, zh: number, area: [number, number], onPicture = false) {
  const { look } = f;
  const enPx = Math.round(zh * 0.42);
  ctx.font = enFont(enPx);
  const enH = look.english && line.en ? measureEnglish(ctx, line.en, G.centredW, enPx) : 0;
  // Breaking at commas is for the narrow upright frame; a wide one has the room for the line.
  const name = look.speakers ? speakerOf(line) : null;
  const nameH = name ? NAME_H : 0;
  const b = fitted(ctx, [line], { look, zh, maxW: G.centredW, commas: look.breakLines && G.h > G.w, lib: f.lib }, area[1] - area[0] - (enH ? enH + 14 : 0) - (onPicture ? 60 : 0) - nameH);
  const h = b.h + (enH ? enH + 14 : 0);
  const top = (onPicture ? Math.max(area[0] + 22 + nameH, area[1] - h - 30) : area[0] + (area[1] - area[0] - h + nameH) / 2);
  if (name) nameTab(ctx, f, name, G.cx, top - nameH - (onPicture && look.overLook === 'box' ? 24 : 0), 'center');
  const box = onPicture && look.overLook === 'box';
  if (box) {
    ctx.fillStyle = 'rgba(20, 24, 29, 0.72)';
    const boxW = Math.max(200, ...b.rows.map((r) => r.seen));
    roundRect(ctx, G.cx - boxW / 2 - 30, top - 22, boxW + 60, h + 44, 24);
    ctx.fill();
  }
  const outline = onPicture && !box;
  drawBlock(ctx, b, G.cx, top, { look, ink, align: 'center', outline });
  if (enH) english(ctx, line.en, G.cx, top + b.h + 14, enPx, G.centredW, ink.py, outline ? 5 : 0);
}

function measureEnglish(ctx: CanvasRenderingContext2D, s: string, maxW: number, px: number) {
  let lines = 1;
  let cur = '';
  for (const w of s.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(next).width > maxW) {
      lines++;
      cur = w;
    } else cur = next;
  }
  return lines * px * 1.3;
}

function titleBand(ctx: CanvasRenderingContext2D, f: FrameInput, ink: Ink, h: number, over: boolean) {
  const { look, text: t } = f;
  if (look.titleLook === 'band') {
    ctx.fillStyle = over ? NIGHT.band : THEMES[look.background].band;
    ctx.fillRect(0, G.safe.top, G.w, h);
  }
  const outline = look.titleLook === 'plain' && over ? 6 : 0;
  ctx.textAlign = 'center';
  let y = G.safe.top;
  if (look.title === 'book' && f.book) {
    ctx.font = hanFont(look, 34);
    text(ctx, f.book, G.w / 2, y + 50, ink.py, outline);
    y += 44;
  }
  let px = 54;
  ctx.font = hanFont(look, px);
  const name = t.titleZh || t.title;
  while (ctx.measureText(name).width > G.w - 120 && px > 30) ctx.font = hanFont(look, --px);
  text(ctx, name, G.w / 2, y + 76, ink.ink, outline);
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, step: { dur: number }, into: number, look: VideoLook, ink: Ink) {
  const ask = step.dur - look.think;
  const left = into < ask ? 1 : Math.max(0, 1 - (into - ask) / look.think);
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.strokeStyle = ink.dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = ink.accent;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
  ctx.stroke();
  ctx.font = pyFont(56);
  ctx.textAlign = 'center';
  text(ctx, String(Math.ceil((left * look.think) / 1000)), x, y + 20, ink.ink, 0);
}
