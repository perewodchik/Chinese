import type { Library } from '../../data/types';
import { alignPinyin } from '../../domain/reading';
import type { SheetOptions } from '../../domain/sheet';
import type { TeachCard } from '../../domain/teach';
import { genreLabel, isHanzi, levelLabel, type GeneratedText, type TextLine } from '../../domain/text';
import type { Sheet } from '../draw';
import { CELL } from '../layout/grid';
import { contentLeft, contentWidth } from '../layout/page';
import { T } from '../theme';

/**
 * The reading sheet.
 *
 * Set like a page of a good reader rather than a form: a large title, what is
 * new stated before you meet it, the reading sitting over each character it
 * belongs to, and the English out in a margin behind a dashed fold. Read the
 * passage once with the margin open, fold it under, read it again — the page
 * is its own second pass. What the passage was built to show comes after it,
 * and the questions are answered in characters, in squares.
 */

export interface Flow {
  /** the sheet being drawn on now */
  s: Sheet;
  /** current baseline, from the top of the page */
  y: number;
  /** starts a new page and resets `y` */
  page: () => void;
  /** the lowest y anything may be drawn at */
  bottom: number;
}

export interface ReadingCtx {
  /** the characters this passage introduces, with their readings */
  cards: TeachCard[];
  /** show the pinyin over each character */
  pinyin?: boolean;
  /** show the English in the margin */
  english?: boolean;
  /** for cutting word-grouped pinyin into one syllable per character */
  lib?: Library;
  /** where this text sits in a set, "Text 2 of 5" */
  place?: string;
}

/** Makes sure `need` points of room exist, breaking the page if they do not. */
function room(f: Flow, need: number) {
  if (f.y + need > f.bottom) f.page();
}

const firstSense = (s: string) => s.split(/[;,]/)[0].trim();

const PUNCT = /[，。！？、；：”’）》」』…,.!?;:)]/;

interface Glyph {
  ch: string;
  syl: string;
  w: number;
  marked: boolean;
}

/**
 * A sentence as characters with their syllables and marks, broken into lines
 * that fit `width`. Punctuation never starts a line.
 */
function setLine(
  s: Sheet,
  line: Pick<TextLine, 'zh' | 'py'>,
  size: number,
  width: number,
  marks: (zh: string) => boolean[],
  lib?: Library,
  rubySize = 0,
): Glyph[][] {
  const syl = alignPinyin(line, lib);
  const marked = marks(line.zh);
  let k = 0;
  // A syllable wider than its character (zhuàng over 状) widens the character's
  // step rather than running into its neighbour's reading.
  const glyphs: Glyph[] = [...line.zh].map((ch, i) => {
    const y = isHanzi(ch) ? (syl[k++] ?? '') : '';
    const w = s.measure(ch, size);
    return {
      ch,
      syl: y,
      w: rubySize && y ? Math.max(w, s.measure(y, rubySize) + 2.5) : w,
      marked: marked[i] ?? false,
    };
  });

  const lines: Glyph[][] = [[]];
  let used = 0;
  for (const g of glyphs) {
    const cur = lines[lines.length - 1];
    if (used + g.w > width && cur.length && !PUNCT.test(g.ch)) {
      lines.push([g]);
      used = g.w;
    } else {
      cur.push(g);
      used += g.w;
    }
  }
  return lines;
}

/**
 * Draws one set line. The marks go down first — a highlighter band across the
 * lower half of the character and a hairline under it — so the ink sits on top.
 */
function drawSetLine(
  s: Sheet,
  glyphs: Glyph[],
  x: number,
  top: number,
  size: number,
  rubySize: number,
  showPy: boolean,
) {
  const rubyH = showPy ? rubySize + 3 : 0;
  const base = top + rubyH + size * 0.86;
  let cx = x;
  for (const g of glyphs) {
    if (g.marked) {
      s.rect(cx, base - size * 0.36, g.w, size * 0.5, { fill: s.c.band });
      s.line(cx, base + size * 0.14, cx + g.w, base + size * 0.14, { width: 0.6, color: s.c.ink2 });
    }
    cx += g.w;
  }
  cx = x;
  for (const g of glyphs) {
    s.text(g.ch, cx + (g.w - s.measure(g.ch, size)) / 2, base, { size });
    if (showPy && g.syl) {
      s.textCentre(g.syl, cx + g.w / 2, top + rubySize, {
        size: rubySize,
        color: s.st.accentReading ? s.c.accent : s.c.ink2,
      });
    }
    cx += g.w;
  }
}

/** Which characters of a sentence are new: the new words where they fall, and any new character. */
function marker(text: GeneratedText) {
  const words = text.vocab
    .filter((v) => v.isNew && [...v.w].length > 1)
    .map((v) => v.w)
    .sort((a, b) => b.length - a.length);
  const teach = new Set(text.teach);
  return (zh: string): boolean[] => {
    const chars = [...zh];
    const out = chars.map((c) => teach.has(c));
    const joined = chars.join('');
    for (const w of words) {
      let at = joined.indexOf(w);
      while (at >= 0) {
        // indexOf counts UTF-16 units; the passage is BMP hanzi, so they agree.
        for (let i = 0; i < [...w].length; i++) out[at + i] = true;
        at = joined.indexOf(w, at + w.length);
      }
    }
    return out;
  };
}

function pill(s: Sheet, text: string, right: number, y: number, accent = false): number {
  const w = s.measure(text, 6.6) + 12;
  s.roundRect(right - w, y - 8, w, 12, 6, {
    border: accent ? s.c.accent : s.c.hair,
    borderWidth: 0.5,
  });
  s.text(text, right - w + 6, y + 0.4, { size: 6.6, color: accent ? s.c.accent : s.c.ink2 });
  return w;
}

/**
 * What is new, before you meet it: a row of cards, four across, each a glyph
 * in its square with the reading, the meaning and the word it comes in.
 */
function drawTeachStrip(f: Flow, cards: TeachCard[]) {
  if (!cards.length) return;
  const x0 = contentLeft;
  const gap = 8;
  const perRow = 4;
  const w = (contentWidth - gap * (perRow - 1)) / perRow;
  const h = 40;
  const rows = Math.ceil(cards.length / perRow);

  room(f, 16 + rows * (h + gap));
  f.s.label('NEW IN THIS TEXT', x0, f.y, contentWidth, `${cards.length}`);
  f.y += 8;
  const top = f.y;
  const s = f.s;
  cards.forEach((card, i) => {
    const x = x0 + (i % perRow) * (w + gap);
    const y = top + Math.floor(i / perRow) * (h + gap);
    s.roundRect(x, y, w, h, 4, { fill: s.c.panel });
    const box = 28;
    s.rect(x + 6, y + 6, box, box, { fill: s.c.white, border: s.c.grid, borderWidth: 0.4 });
    s.glyphOrText(card.c, x + 7, y + 7, box - 2);
    const tx = x + 6 + box + 7;
    const tw = x + w - tx - 5;
    s.text(card.py, tx, y + 14, {
      size: 8.4,
      color: s.st.accentReading ? s.c.accent : s.c.ink2,
      maxWidth: tw,
    });
    s.text(firstSense(card.def), tx, y + 24, { size: 7.2, maxWidth: tw });
    const word = card.words[0];
    if (word) s.text(`${word.w}  ${word.py}`, tx, y + 33.5, { size: 6.6, color: s.c.ink3, maxWidth: tw });
  });
  f.y = top + rows * (h + gap) + 8;
}

export function drawReading(
  text: GeneratedText,
  o: SheetOptions,
  f: Flow,
  ctx: ReadingCtx = { cards: [] },
) {
  const x0 = contentLeft;
  const x1 = contentLeft + contentWidth;
  const width = contentWidth;
  const showPy = ctx.pinyin !== false;
  const showEn = ctx.english !== false;
  const marks = marker(text);

  // ------------------------------------------------------------------ title
  {
    const s = f.s;
    const eyebrow = [
      ctx.place,
      genreLabel(text.genre),
      text.hsk ? `HSK ${text.hsk}` : levelLabel(text.level),
    ]
      .filter(Boolean)
      .join('  ·  ')
      .toUpperCase();
    s.text(eyebrow, x0, f.y + 10, { size: T.label, color: s.c.ink3, bold: true, tracking: 1 });
    s.text(text.titleZh || text.title, x0, f.y + 44, { size: 30, maxWidth: width - 150 });
    if (text.titleZh) {
      s.text(text.title, x0, f.y + 62, {
        size: 11,
        color: s.c.ink2,
        maxWidth: width - 150,
      });
    }
    let right = x1;
    if (text.teach.length) right -= pill(s, `${text.teach.length} new`, right, f.y + 60, true) + 5;
    pill(s, `${text.lines.length} sentences`, right, f.y + 60);
    f.y += text.titleZh ? 84 : 66;
  }

  drawTeachStrip(f, ctx.cards);

  // --------------------------------------------------------------- passage
  const size = 17;
  const rubySize = 6.2;
  const lineH = (showPy ? rubySize + 3 : 0) + size + 6;
  const foldX = x1 - 134;
  const mainL = x0 + 22;
  const mainR = showEn ? foldX - 12 : x1;
  const enL = foldX + 10;
  const enW = x1 - enL;

  f.y += 6;
  room(f, lineH + 20);
  if (showEn) f.s.label('FOLD BACK TO HIDE', enL, f.y, enW);
  f.y += 10;

  text.lines.forEach((line, i) => {
    const s0 = f.s;
    const set = setLine(s0, line, size, mainR - mainL, marks, ctx.lib, showPy ? rubySize : 0);
    const enH =
      showEn && line.en
        ? s0.paragraph(line.en, enL, 0, enW, { size: 7.6, lineHeight: 10, maxLines: 6, dry: true })
        : 0;
    const h = Math.max(set.length * lineH, enH + 10) + 8;
    room(f, h);
    const s = f.s;
    const top = f.y;

    s.textRight(String(i + 1), x0 + 12, top + (showPy ? rubySize + 3 : 0) + size * 0.8, {
      size: T.micro,
      color: s.c.ink3,
    });
    set.forEach((g, k) => drawSetLine(s, g, mainL, top + k * lineH, size, rubySize, showPy));
    if (showEn) {
      s.line(foldX, top - 4, foldX, top + h - 4, { width: 0.5, color: s.c.grid, dash: [2, 2.5] });
      if (line.en) {
        s.paragraph(line.en, enL, top + (showPy ? rubySize + 3 : 0) + 8, enW, {
          size: 7.6,
          lineHeight: 10,
          maxLines: 6,
          color: s.c.ink2,
        });
      }
    }
    f.y += h;
  });

  // ------------------------------------------------ words and the pattern
  drawCards(f, text);

  // ------------------------------------------------------------------- note
  if (text.note.trim()) {
    const h = f.s.paragraph(text.note.trim(), x0 + 10, f.y + 8, width - 14, {
      size: T.small,
      color: f.s.c.ink2,
      maxLines: 4,
      dry: true,
    });
    room(f, h + 22);
    f.y += 12;
    f.s.note(x0, f.y, width - 4, h);
    f.s.paragraph(text.note.trim(), x0 + 10, f.y + 6, width - 14, {
      size: T.small,
      color: f.s.c.ink2,
      maxLines: 4,
    });
    f.y += h + 12;
  }

  // -------------------------------------------------------------- questions
  if (text.questions.length) {
    const half = CELL / 2;
    const qSize = 12.5;
    const qRuby = 5.6;
    const qLineH = (showPy ? qRuby + 3 : 0) + qSize + 5;
    room(f, 40 + qLineH + half);
    f.y += 14;
    f.s.label('ANSWER IN CHARACTERS', x0, f.y, width);
    f.y += 10;
    text.questions.forEach((q, i) => {
      const set = setLine(f.s, q, qSize, width - 22, () => [], ctx.lib, showPy ? qRuby : 0);
      const h = set.length * qLineH + (showEn && q.en ? 11 : 0) + 4 + half + 12;
      room(f, h);
      const s = f.s;
      const top = f.y;
      s.textRight(String(i + 1), x0 + 12, top + (showPy ? qRuby + 3 : 0) + qSize * 0.8, {
        size: T.micro,
        color: s.c.ink3,
      });
      set.forEach((g, k) => drawSetLine(s, g, mainL, top + k * qLineH, qSize, qRuby, showPy));
      let y = top + set.length * qLineH;
      if (showEn && q.en) {
        s.text(q.en, mainL, y + 5, { size: 7, color: s.c.ink3, maxWidth: width - 22 });
        y += 11;
      }
      y += 4;
      const cols = Math.floor((x1 - mainL) / half);
      for (let c = 0; c < cols; c++) s.cell(mainL + c * half, y, half, o.gridStyle);
      f.y += h;
    });
  }
}

/**
 * The words of the text and what it was written to show, side by side in two
 * framed cards — or one card across the page when there is only one of them.
 */
function drawCards(f: Flow, text: GeneratedText) {
  const hasWords = text.vocab.length > 0;
  const hasGrammar = text.grammar.length > 0;
  if (!hasWords && !hasGrammar) return;

  const x0 = contentLeft;
  const gap = 12;
  const both = hasWords && hasGrammar;
  const wordsW = both ? (contentWidth - gap) * 0.54 : contentWidth;
  const gramW = both ? contentWidth - gap - wordsW : contentWidth;
  const wordCols = both ? 2 : 3;
  const rowH = 22;
  const wordRows = Math.ceil(text.vocab.length / wordCols);
  const gramH = text.grammar.reduce((n, g) => n + 14 + (g.zh ? 15 : 0) + (g.en ? 11 : 0) + 6, 0);
  const inner = Math.max(hasWords ? wordRows * rowH : 0, hasGrammar ? gramH : 0);
  const h = 22 + inner + 6;

  f.y += 14;
  room(f, h);
  const s = f.s;
  const top = f.y;
  const pad = 11;

  if (hasWords) {
    s.roundRect(x0, top, wordsW, h, 6, { border: s.c.hair, borderWidth: 0.5 });
    s.label('WORDS IN THIS TEXT', x0 + pad, top + 14, wordsW - pad * 2);
    const colW = (wordsW - pad * 2 - 10 * (wordCols - 1)) / wordCols;
    text.vocab.forEach((w, i) => {
      const x = x0 + pad + Math.floor(i / wordRows) * (colW + 10);
      const y = top + 32 + (i % wordRows) * rowH;
      const zw = s.measure(w.w, 11.5);
      if (w.isNew) {
        s.rect(x, y - 4.5, zw, 5.8, { fill: s.c.band });
        s.line(x, y + 1.6, x + zw, y + 1.6, { width: 0.6, color: s.c.ink2 });
      }
      s.text(w.w, x, y, { size: 11.5, maxWidth: colW * 0.55 });
      s.text(w.py, x + Math.min(zw, colW * 0.55) + 5, y - 0.5, {
        size: 6.6,
        color: s.st.accentReading ? s.c.accent : s.c.ink2,
        maxWidth: colW * 0.45 - 5,
      });
      s.text(w.d, x, y + 9, { size: 6.8, color: s.c.ink2, maxWidth: colW });
    });
  }

  if (hasGrammar) {
    const gx = both ? x0 + wordsW + gap : x0;
    s.roundRect(gx, top, gramW, h, 6, { border: s.c.hair, borderWidth: 0.5 });
    s.label(text.grammar.length > 1 ? 'THE PATTERNS' : 'THE PATTERN', gx + pad, top + 14, gramW - pad * 2);
    let y = top + 32;
    for (const g of text.grammar) {
      s.text(g.point, gx + pad, y, { size: 8.4, bold: true, maxWidth: gramW - pad * 2 });
      y += 14;
      if (g.zh) {
        s.text(g.zh, gx + pad, y, { size: 11.5, maxWidth: gramW - pad * 2 });
        y += 11;
      }
      if (g.en) {
        s.text(g.en, gx + pad, y + 1, { size: 7, color: s.c.ink2, maxWidth: gramW - pad * 2 });
        y += 11;
      }
      y += 6;
    }
  }
  f.y = top + h;
}
