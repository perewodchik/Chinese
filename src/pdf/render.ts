import { PDFDocument } from 'pdf-lib';
import { ensureStrokes } from '../data/load';
import type { CharacterEntry, Library } from '../data/types';
import type { Collection } from '../domain/collection';
import { charId, wordId, type ItemId } from '../domain/ids';
import { glyphsOf, itemsNoun, printItems, type PrintItem } from '../domain/printItems';
import { printSheet, type PaletteId, type SheetOptions } from '../domain/sheet';
import { cardsFor, textsChars, textsGlosses } from '../domain/teach';
import type { GeneratedText } from '../domain/text';
import { drawCharBlock } from './blocks/charBlock';
import { drawReading, type Flow } from './blocks/readingBlock';
import { drawWordBlock } from './blocks/wordBlock';
import {
  drawAnswerKey,
  drawRecallPrompt,
  recallLayout,
  type RecallPrompt,
  type RecallStyle,
} from './blocks/recallBlock';
import { Sheet } from './draw';
import { coreCovers, embedFonts, type Fonts } from './fonts';
import { describe, footer, header, separate } from './layout/furniture';
import { CELL, COLS } from './layout/grid';
import {
  blockSpacing,
  bodyHeight,
  bodyTop,
  contentLeft,
  contentRight,
  contentWidth,
  PAGE,
  slotHeight,
} from './layout/page';
import { themeOf, T, type SheetTheme } from './theme';

export interface RenderResult {
  bytes: Uint8Array;
  pages: number;
}

/* ------------------------------------------------------------- gathering */

/** Every character these blocks will draw from stroke outlines. */
function everyGlyph(items: PrintItem[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    const chars = it.kind === 'char' ? [it.e] : it.w.chars;
    out.push(...glyphsOf(it));
    for (const c of chars) {
      out.push(c.c, ...c.parts);
      if (c.rad) out.push(c.rad);
    }
  }
  return out.filter((x) => [...x].length === 1);
}

/** Every string these blocks will typeset, for choosing which face to embed. */
function everyString(
  lib: Library,
  items: PrintItem[],
  ...extra: Array<string | undefined>
): string[] {
  const out: string[] = extra.filter(Boolean) as string[];
  const gloss = (k: string) => {
    const g = lib.components[k];
    if (g) out.push(g.def, g.py);
    const e = lib.byChar.get(k);
    if (e) out.push(e.def, ...e.py);
  };
  const char = (c: CharacterEntry) => {
    out.push(c.c, c.def, ...c.py, c.trad ?? '', c.ids ?? '');
    c.parts.forEach((p) => (out.push(p), gloss(p)));
    if (c.rad) (out.push(c.rad), gloss(c.rad));
    for (const w of c.words) out.push(w.w, w.p, w.d);
    if (c.sent) out.push(c.sent.zh, c.sent.en, c.sent.py ?? '');
    if (c.ety) out.push(c.ety.hint ?? '', c.ety.phonetic ?? '', c.ety.semantic ?? '');
  };
  for (const it of items) {
    if (it.kind === 'char') {
      char(it.e);
      continue;
    }
    const w = it.w;
    out.push(w.w, w.py, w.d, ...w.cl, ...w.also.flatMap((a) => [a.w, a.d]));
    for (const ex of w.ex) out.push(ex.zh, ex.py, ex.en);
    w.chars.forEach(char);
  }
  // The small print every block has: labels, facts, tags.
  out.push('CHARACTER WORD HSK 0123456789 · – measure word also strokes stroke radical traditional most common #');
  return out;
}

function drawItem(s: Sheet, lib: Library, it: PrintItem, o: SheetOptions, top: number, height: number) {
  if (it.kind === 'char') drawCharBlock(s, it.e, o, { components: lib.components }, top, height);
  else drawWordBlock(s, it.w, o, top, height);
}

/* ----------------------------------------------------------- worksheets */

/**
 * Draws one collection's worksheet, for exactly the items it is given.
 *
 * Which items those are — all of them, the ones not yet learned, a range — is
 * the collection's business, not this function's: it renders a list.
 */
export async function renderCollection(
  lib: Library,
  collection: Collection,
  items: ItemId[],
  opts: {
    footerNote?: string;
    title?: string;
    /**
     * The real size of the run when only its first pages are being drawn, so a
     * three-page preview still says "1-2 of 40" rather than "1-2 of 6".
     */
    total?: number;
    pages?: number;
    /** the colour in Settings, for a collection that has none of its own */
    palette?: PaletteId;
  } = {},
): Promise<RenderResult> {
  const doc = await PDFDocument.create();
  const title = opts.title ?? collection.name;
  describe(doc, title);

  const blocks = printItems(lib, items, collection.words);
  const o = printSheet(collection.sheet, opts.palette ?? 'cinnabar');
  const theme = themeOf(o);

  // Outlines for the higher HSK bands are fetched on demand, so make sure
  // every character on this sheet has one before drawing anything.
  await ensureStrokes(lib, everyGlyph(blocks));

  const fonts = await embedFonts(doc, {
    core: await coreCovers(everyString(lib, blocks, title, opts.footerNote)),
  });
  const perPage = Math.max(1, o.perPage);
  const noun = itemsNoun(blocks);

  const total = opts.total ?? blocks.length;
  const drawn = Math.max(1, Math.ceil(blocks.length / perPage));
  const pageCount = opts.pages ?? drawn;
  const slotH = slotHeight(perPage);
  const spacing = blockSpacing(perPage);

  for (let p = 0; p < drawn; p++) {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    const s = new Sheet(page, fonts, lib.strokes, theme);

    const slice = blocks.slice(p * perPage, (p + 1) * perPage);
    const first = p * perPage + 1;
    const last = p * perPage + slice.length;

    header(s, title, total ? `${noun} ${first}–${last} of ${total}` : '');

    slice.forEach((it, i) => {
      const top = bodyTop + i * (slotH + spacing);
      separate(s, top, slotH, spacing, i === 0);
      drawItem(s, lib, it, o, top, slotH);
    });

    footer(s, opts.footerNote?.trim() ?? '', `${p + 1} / ${pageCount}`);
  }

  return { bytes: await doc.save(), pages: drawn };
}

/* -------------------------------------------------------- reading sheets */

export interface ReadingOptions {
  footerNote?: string;
  /** Drill pages for the passage's new words and characters, behind the reading */
  practice?: boolean;
  pinyin?: boolean;
  english?: boolean;
}

/**
 * A document being built up page by page.
 *
 * A reading pack is a passage, then more passages, then practice sheets for
 * everything they taught — so pages are collected as they are drawn and the
 * footers are stamped at the end, when the total is finally known.
 */
interface Doc {
  doc: PDFDocument;
  fonts: Fonts;
  theme: SheetTheme;
  strokes: Library['strokes'];
  sheets: Sheet[];
}

function addPage(d: Doc, title: string, right: string): Sheet {
  const s = new Sheet(d.doc.addPage([PAGE.width, PAGE.height]), d.fonts, d.strokes, d.theme);
  header(s, title, right);
  d.sheets.push(s);
  return s;
}

const stampFooters = (d: Doc, note?: string) =>
  d.sheets.forEach((s, i) =>
    footer(s, note?.trim() ?? '', `${i + 1} / ${d.sheets.length}`),
  );

/** Every string one text will typeset. */
const textStrings = (t: GeneratedText): string[] =>
  [
    t.title,
    t.titleZh,
    t.topic,
    t.note,
    ...t.lines.flatMap((l) => [l.zh, l.py, l.en]),
    ...t.vocab.flatMap((v) => [v.w, v.py, v.d]),
    ...t.questions.flatMap((q) => [q.zh, q.py, q.en]),
    ...t.grammar.flatMap((g) => [g.point, g.zh, g.en]),
  ].filter(Boolean) as string[];

/** The furniture a reading page sets in type, whatever the text. */
const READING_FURNITURE =
  'NEW IN THIS TEXT FOLD BACK TO HIDE WORDS IN THE PATTERNS ANSWER CHARACTERS READING SET HSK sentences new texts READ ALOUD WRITE continued practice 0123456789 · – …';

/**
 * What a text taught, as practice blocks: its new words whole, then each new
 * character on its own.
 */
function taughtItems(lib: Library, texts: GeneratedText[]): PrintItem[] {
  const ids: ItemId[] = [];
  for (const t of texts) {
    for (const v of t.vocab) if (v.isNew && [...v.w].length > 1) ids.push(wordId(v.w));
  }
  for (const c of textsChars(texts)) ids.push(charId(c));
  return printItems(lib, ids);
}

function drawText(
  d: Doc,
  lib: Library,
  text: GeneratedText,
  sheet: SheetOptions,
  o: ReadingOptions,
  place?: string,
) {
  const cards = cardsFor(lib, text.teach, new Set(text.basis), text.glosses);
  const flow: Flow = {
    s: addPage(d, text.title, place ?? (text.topic || 'reading')),
    y: bodyTop,
    bottom: bodyTop + bodyHeight,
    page() {
      flow.s = addPage(d, text.title, 'continued');
      flow.y = bodyTop;
    },
  };
  drawReading(text, sheet, flow, {
    cards,
    pinyin: o.pinyin,
    english: o.english,
    lib,
    place,
  });
}

/**
 * Practice pages for what a text taught, in the Drill layout.
 *
 * The same blocks a worksheet uses, on purpose: a word met in a sentence and a
 * word practised in a grid should be the same word, laid out the same way, or
 * the pack is two things stapled together instead of one.
 */
function drawTaught(d: Doc, lib: Library, items: PrintItem[], o: SheetOptions, title: string) {
  const perPage = Math.max(1, o.perPage);
  const slotH = slotHeight(perPage);
  const spacing = blockSpacing(perPage);
  const pages = Math.ceil(items.length / perPage);

  for (let p = 0; p < pages; p++) {
    const slice = items.slice(p * perPage, (p + 1) * perPage);
    const first = p * perPage + 1;
    const last = p * perPage + slice.length;
    const s = addPage(
      d,
      title,
      items.length > slice.length ? `New ${first}–${last} of ${items.length}` : `${items.length} new`,
    );
    slice.forEach((it, i) => {
      const top = bodyTop + i * (slotH + spacing);
      separate(s, top, slotH, spacing, i === 0);
      drawItem(s, lib, it, o, top, slotH);
    });
  }
}

/**
 * The cover of a set: what it is, what is in it, every new character in the
 * same squares the practice pages use, and how to work through the booklet.
 */
function drawCover(d: Doc, name: string, texts: GeneratedText[], chars: string[], practice: boolean) {
  const s = addPage(d, name, `${texts.length} texts`);
  const x0 = contentLeft;
  const x1 = contentRight;
  const bottom = bodyTop + bodyHeight;
  let y = bodyTop + 26;

  const bands = [...new Set(texts.map((t) => t.hsk).filter((h): h is number => !!h))];
  s.text(`READING SET  ·  ${texts.length} TEXTS`, x0, y, {
    size: T.label,
    color: s.c.ink3,
    bold: true,
    tracking: 1,
  });
  y += 36;
  s.text(name, x0, y, { size: 30, maxWidth: contentWidth - 90 });
  y += 22;
  s.text(`${chars.length} new characters, ${texts.reduce((n, t) => n + t.lines.length, 0)} sentences`, x0, y, {
    size: 11,
    color: s.c.ink2,
  });

  if (bands.length === 1) {
    // A seal in the corner: the level, stamped.
    const size = 58;
    const sx = x1 - size;
    const sy = bodyTop + 22;
    s.roundRect(sx, sy, size, size, 6, { border: s.c.accent, borderWidth: 1.5 });
    s.textCentre('HSK', sx + size / 2, sy + 22, { size: 8, color: s.c.accent, bold: true, tracking: 1 });
    s.textCentre(String(bands[0]), sx + size / 2, sy + 46, { size: 22, color: s.c.accent, bold: true });
  }

  // ------------------------------------------------------------- contents
  y += 26;
  s.line(x0, y, x1, y, { width: 0.7, color: s.c.ink });
  const howTop = bottom - 62;
  const rowH = 26;
  const mosaicMin = 30 + CELL * 2;
  const listed = texts.slice(0, Math.max(1, Math.floor((howTop - mosaicMin - y) / rowH)));
  listed.forEach((t, i) => {
    const base = y + 17;
    s.text(String(i + 1).padStart(2, '0'), x0, base, { size: T.small, color: s.c.ink3 });
    const zw = s.text(t.titleZh || t.title, x0 + 26, base, { size: 14, maxWidth: 200 });
    if (t.titleZh) {
      s.text(t.title, x0 + 26 + zw + 10, base, {
        size: T.small,
        color: s.c.ink2,
        maxWidth: x1 - 120 - (x0 + 36 + zw),
      });
    }
    const newW = s.textRight(`${t.teach.length} new`, x1, base, { size: T.small, color: s.c.accent });
    s.textRight(`${t.lines.length} sentences  ·  `, x1 - newW, base, { size: T.small, color: s.c.ink3 });
    y += rowH;
    s.line(x0, y, x1, y, { width: 0.4, color: s.c.hair });
  });
  if (listed.length < texts.length) {
    y += 14;
    s.text(`…and ${texts.length - listed.length} more`, x0 + 26, y, { size: T.small, color: s.c.ink3 });
  }

  // --------------------------------------------------------------- mosaic
  if (chars.length) {
    y += 28;
    s.label('EVERY NEW CHARACTER IN THIS SET', x0, y, contentWidth, practice ? 'practice pages at the back' : undefined);
    y += 8;
    const rows = Math.max(1, Math.min(Math.ceil(chars.length / COLS), Math.floor((howTop - 14 - y) / CELL)));
    const shown = chars.slice(0, rows * COLS);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const cx = x0 + c * CELL;
        const cy = y + r * CELL;
        s.cell(cx, cy, CELL, 'mizi');
        const ch = shown[r * COLS + c];
        if (ch) s.glyphOrText(ch, cx + CELL * 0.1, cy + CELL * 0.1, CELL * 0.8);
      }
    }
    s.rect(x0, y, COLS * CELL, rows * CELL, { border: s.c.grid, borderWidth: s.st.frameWeight });
    if (shown.length < chars.length) {
      s.textRight(`and ${chars.length - shown.length} more`, x1, y + rows * CELL + 10, {
        size: T.small,
        color: s.c.ink3,
      });
    }
  }

  // ------------------------------------------------------------ how to use
  const steps: Array<[string, string, string]> = [
    ['READ', 'Aloud, with the pinyin', 'Once through each text. The new words are marked, and their meanings are at the top of the page.'],
    ['FOLD', 'The English back', 'Read it again with the margin folded under. Mark any line you had to unfold for.'],
  ];
  if (practice) steps.push(['WRITE', 'The new ones', 'Practice pages at the back: every new word and character, two rows each.']);
  const gap = 12;
  const w = (contentWidth - gap * 2) / 3;
  steps.forEach(([k, head, body], i) => {
    const x = x0 + i * (w + gap);
    s.line(x, howTop, x + w, howTop, { width: 0.7, color: s.c.ink });
    s.text(k, x, howTop + 11, { size: T.label, color: s.c.accent, bold: true, tracking: 1 });
    s.text(head, x, howTop + 23, { size: 8.6, bold: true, maxWidth: w });
    s.paragraph(body, x, howTop + 34, w, { size: 7.2, lineHeight: 9.6, maxLines: 3, color: s.c.ink2 });
  });
}

/** One passage, with Drill pages for what it taught if asked for. */
export async function renderReading(
  lib: Library,
  text: GeneratedText,
  sheet: SheetOptions,
  opts: ReadingOptions = {},
): Promise<RenderResult> {
  const doc = await PDFDocument.create();
  describe(doc, text.title);
  const theme: SheetTheme = themeOf(sheet);

  const taught = opts.practice ? taughtItems(lib, [text]) : [];
  await ensureStrokes(lib, [...text.teach, ...everyGlyph(taught)]);

  const fonts: Fonts = await embedFonts(doc, {
    core: await coreCovers([
      READING_FURNITURE,
      ...textStrings(text),
      ...Object.values(text.glosses ?? {}).flatMap((g) => [g.py, g.d]),
      ...everyString(lib, taught, opts.footerNote),
    ]),
  });

  const d: Doc = { doc, fonts, theme, strokes: lib.strokes, sheets: [] };
  drawText(d, lib, text, sheet, opts);
  if (taught.length) drawTaught(d, lib, taught, sheet, `${text.title} — practice`);
  stampFooters(d, opts.footerNote);

  return { bytes: await doc.save(), pages: d.sheets.length };
}

/**
 * A whole session in one file: a cover, every passage, then one run of
 * practice pages covering everything the session taught.
 *
 * Printed as a booklet this is a week of study, which is the unit the reader
 * actually works in — not one passage at a time.
 */
export async function renderTextSet(
  lib: Library,
  name: string,
  texts: GeneratedText[],
  sheet: SheetOptions,
  opts: ReadingOptions = {},
): Promise<RenderResult> {
  const doc = await PDFDocument.create();
  describe(doc, name);
  const theme: SheetTheme = themeOf(sheet);

  const chars = textsChars(texts);
  const taught = opts.practice ? taughtItems(lib, texts) : [];
  const glosses = textsGlosses(texts);
  await ensureStrokes(lib, [...chars, ...everyGlyph(taught)]);

  const fonts: Fonts = await embedFonts(doc, {
    core: await coreCovers([
      READING_FURNITURE,
      name,
      ...texts.flatMap(textStrings),
      ...Object.values(glosses).flatMap((g) => [g.py, g.d]),
      ...everyString(lib, taught, opts.footerNote),
    ]),
  });

  const d: Doc = { doc, fonts, theme, strokes: lib.strokes, sheets: [] };
  if (texts.length > 1) drawCover(d, name, texts, chars, taught.length > 0);
  texts.forEach((t, i) =>
    drawText(d, lib, t, sheet, opts, texts.length > 1 ? `Text ${i + 1} of ${texts.length}` : undefined),
  );
  if (taught.length) drawTaught(d, lib, taught, sheet, `${name} — practice`);
  stampFooters(d, opts.footerNote);

  return { bytes: await doc.save(), pages: d.sheets.length };
}

/* ------------------------------------------------------------ recall sheets */

export interface RecallOptions {
  footerNote?: string;
  title?: string;
  /** rows of empty squares under each prompt */
  rows?: number;
  /** print how many strokes the answer has */
  strokeHint?: boolean;
  /** at the foot of each page behind a fold, on a page of their own, or not */
  answers?: 'foot' | 'end' | 'none';
}

/**
 * A test, on paper.
 *
 * The one sheet the app could not print. Everything else it makes shows you
 * the character and asks you to copy it; this gives you the reading and the
 * meaning and an empty square, which is the only arrangement of those three
 * things that measures anything. What comes back from it — which ones you
 * could not produce — is what the review schedule has no other way of learning,
 * because handwriting is the one thing that happens away from the screen.
 */
export async function renderRecall(
  lib: Library,
  items: ItemId[],
  sheet: SheetOptions,
  opts: RecallOptions = {},
): Promise<RenderResult> {
  const doc = await PDFDocument.create();
  const title = opts.title ?? 'Recall';
  describe(doc, title);
  const theme = themeOf(sheet);

  // Numbered by place in the list printed, which is the numbering the marking
  // page uses too.
  const prompts: RecallPrompt[] = printItems(lib, items).map((it) =>
    it.kind === 'char'
      ? { n: items.indexOf(it.id) + 1, char: it.e.c, py: it.e.py[0] ?? '', gloss: it.e.def, strokes: it.e.sc ?? 0 }
      : {
          n: items.indexOf(it.id) + 1,
          char: it.w.w,
          py: it.w.py,
          gloss: it.w.d,
          strokes: it.w.chars.reduce((n, c) => n + (c.sc ?? 0), 0),
        },
  );

  const answers = opts.answers ?? 'foot';
  const style: RecallStyle = {
    rows: opts.rows ?? 1,
    strokeHint: opts.strokeHint !== false,
    keyOnPage: answers === 'foot',
  };

  await ensureStrokes(lib, prompts.flatMap((p) => [...p.char]));
  const fonts = await embedFonts(doc, {
    core: await coreCovers([
      title,
      opts.footerNote ?? '',
      'FOLD HERE — ANSWERS characters strokes from memory of 0123456789 –',
      ...prompts.flatMap((p) => [p.char, p.py, p.gloss]),
    ]),
  });

  const layout = recallLayout(style);
  const pages = Math.max(1, Math.ceil(prompts.length / layout.perPage));

  for (let p = 0; p < pages; p++) {
    const slice = prompts.slice(p * layout.perPage, (p + 1) * layout.perPage);
    const page = doc.addPage([PAGE.width, PAGE.height]);
    const s = new Sheet(page, fonts, lib.strokes, theme);

    header(
      s,
      title,
      prompts.length > slice.length
        ? slice.length > 1
          ? `${slice[0].n}–${slice[slice.length - 1].n} of ${prompts.length}`
          : `${slice[0].n} of ${prompts.length}`
        : `${prompts.length} from memory`,
    );

    slice.forEach((prompt, i) => {
      drawRecallPrompt(
        s,
        prompt,
        bodyTop + i * (layout.itemH + layout.spacing),
        layout,
        sheet,
        style,
      );
    });

    if (answers === 'foot') {
      drawAnswerKey(s, slice, bodyTop + bodyHeight - layout.keyH + 8);
    }
    footer(s, opts.footerNote?.trim() ?? '', `${p + 1} / ${pages + (answers === 'end' ? 1 : 0)}`);
  }

  if (answers === 'end') {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    const s = new Sheet(page, fonts, lib.strokes, theme);
    header(s, title, 'answers');
    drawAnswerKey(s, prompts, bodyTop, 'ANSWERS');
    footer(s, opts.footerNote?.trim() ?? '', `${pages + 1} / ${pages + 1}`);
  }

  return { bytes: await doc.save(), pages: pages + (answers === 'end' ? 1 : 0) };
}
