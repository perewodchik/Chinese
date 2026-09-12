import { PDFDocument } from 'pdf-lib';
import { ensureStrokes } from '../data/load';
import type { CharacterEntry, Library } from '../data/types';
import type { Collection } from '../domain/collection';
import type { ItemId } from '../domain/ids';
import type { SheetOptions } from '../domain/sheet';
import { cardsFor, textsChars, textsGlosses } from '../domain/teach';
import type { GeneratedText } from '../domain/text';
import {
  charInfoHeight,
  charPlan,
  drawCharBlock,
} from './blocks/charBlock';
import { drawReading, type Flow } from './blocks/readingBlock';
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
import { gridFit, minCellFor } from './layout/grid';
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

/** The characters an id list names, in order, skipping any the library has never heard of. */
function resolve(lib: Library, ids: ItemId[]): CharacterEntry[] {
  const out: CharacterEntry[] = [];
  for (const id of ids) {
    const c = lib.byChar.get(id.slice(1));
    if (c) out.push(c);
  }
  return out;
}

/** Every character these blocks will draw from stroke outlines. */
function everyGlyph(chars: CharacterEntry[]): string[] {
  const out: string[] = [];
  for (const c of chars) {
    out.push(c.c, ...c.parts, ...c.conf);
    if (c.rad) out.push(c.rad);
  }
  return out.filter((x) => [...x].length === 1);
}

/** Every string these blocks will typeset, for choosing which face to embed. */
function everyString(
  lib: Library,
  chars: CharacterEntry[],
  ...extra: Array<string | undefined>
): string[] {
  const out: string[] = extra.filter(Boolean) as string[];
  const gloss = (k: string) => {
    const g = lib.components[k];
    if (g) out.push(g.def, g.py);
    const e = lib.byChar.get(k);
    if (e) out.push(e.def, ...e.py);
  };
  for (const c of chars) {
    out.push(c.c, c.def, ...c.py, c.trad ?? '', c.ids ?? '');
    c.parts.forEach((p) => (out.push(p), gloss(p)));
    c.conf.forEach((d) => (out.push(d), gloss(d)));
    if (c.rad) (out.push(c.rad), gloss(c.rad));
    for (const w of c.words) out.push(w.w, w.p, w.d);
    if (c.sent) out.push(c.sent.zh, c.sent.en);
    if (c.ety) out.push(c.ety.hint ?? '', c.ety.phonetic ?? '', c.ety.semantic ?? '');
  }
  return out;
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
  } = {},
): Promise<RenderResult> {
  const doc = await PDFDocument.create();
  const title = opts.title ?? collection.name;
  describe(doc, title);

  const chars = resolve(lib, items);
  const o = collection.sheet;
  const theme = themeOf(o);

  // Outlines for the higher HSK bands are fetched on demand, so make sure
  // every character on this sheet has one before drawing anything.
  await ensureStrokes(lib, everyGlyph(chars));

  const fonts = await embedFonts(doc, {
    core: await coreCovers(everyString(lib, chars, title, opts.footerNote)),
  });
  const perPage = Math.max(1, o.perPage);

  const total = opts.total ?? chars.length;
  const drawn = Math.max(1, Math.ceil(chars.length / perPage));
  const pageCount = opts.pages ?? drawn;
  const slotH = slotHeight(perPage);
  const spacing = blockSpacing(perPage);

  for (let p = 0; p < drawn; p++) {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    const s = new Sheet(page, fonts, lib.strokes, theme);

    const slice = chars.slice(p * perPage, (p + 1) * perPage);
    const first = p * perPage + 1;
    const last = p * perPage + slice.length;

    header(s, title, total ? `Characters ${first}–${last} of ${total}` : '');

    slice.forEach((c, i) => {
      const top = bodyTop + i * (slotH + spacing);
      separate(s, top, slotH, spacing, i === 0);
      drawCharBlock(s, c, o, { components: lib.components }, top, slotH);
    });

    footer(s, opts.footerNote?.trim() ?? '', `${p + 1} / ${pageCount}`);
  }

  return { bytes: await doc.save(), pages: drawn };
}

/* -------------------------------------------------------- reading sheets */

export interface ReadingOptions {
  footerNote?: string;
  /** practice squares for the passage's new characters, behind the reading */
  practice?: boolean;
  /** how many of those characters share a page */
  perPage?: number;
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

const entriesFor = (lib: Library, chars: string[]): CharacterEntry[] =>
  chars.map((c) => lib.byChar.get(c)).filter((e): e is CharacterEntry => !!e);

function drawText(
  d: Doc,
  lib: Library,
  text: GeneratedText,
  sheet: SheetOptions,
  o: ReadingOptions,
) {
  const cards = cardsFor(lib, text.teach, new Set(text.basis), text.glosses);
  const flow: Flow = {
    s: addPage(d, text.title, text.topic || 'reading'),
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
  });
}

/**
 * Practice sheets for the characters a text taught.
 *
 * The same block a worksheet uses, on purpose: a character met in a sentence
 * and a character practised in a grid should be the same character, laid out
 * the same way, or the pack is two things stapled together instead of one.
 */
function drawPractice(
  d: Doc,
  lib: Library,
  chars: CharacterEntry[],
  o: SheetOptions,
  title: string,
) {
  const perPage = Math.max(1, o.perPage);
  const slotH = slotHeight(perPage);
  const spacing = blockSpacing(perPage);
  const pages = Math.ceil(chars.length / perPage);

  for (let p = 0; p < pages; p++) {
    const slice = chars.slice(p * perPage, (p + 1) * perPage);
    const first = p * perPage + 1;
    const last = p * perPage + slice.length;
    const s = addPage(
      d,
      title,
      chars.length > slice.length
        ? `New characters ${first}–${last} of ${chars.length}`
        : `${chars.length} new characters`,
    );
    slice.forEach((c, i) => {
      const top = bodyTop + i * (slotH + spacing);
      separate(s, top, slotH, spacing, i === 0);
      drawCharBlock(s, c, o, { components: lib.components }, top, slotH);
    });
  }
}

/** The first page of a set: what is in it, and what it will teach you. */
function drawContents(d: Doc, name: string, texts: GeneratedText[], chars: string[]) {
  const s = addPage(d, name, `${texts.length} texts`);
  let y = bodyTop + 6;
  s.text('In this set', contentLeft, y, { size: 15, bold: true });
  y += 22;

  // One page, always: a contents page that spills onto a second one is not a
  // contents page. A long set says how many it could not list.
  const room = bodyTop + bodyHeight - 90;
  const listed = texts.slice(0, Math.max(1, Math.floor((room - y) / 30)));

  listed.forEach((t, i) => {
    s.text(String(i + 1).padStart(2, '0'), contentLeft, y, {
      size: T.small,
      color: s.c.ink3,
    });
    s.text(t.titleZh || t.title, contentLeft + 22, y, { size: 13 });
    s.text(t.title, contentLeft + 22, y + 13, {
      size: T.small,
      color: s.st.accentReading ? s.c.accent : s.c.ink2,
      maxWidth: contentWidth - 130,
    });
    s.textRight(
      `${t.lines.length} sentences · ${t.teach.length} new`,
      contentRight,
      y,
      { size: T.small, color: s.c.ink3 },
    );
    s.line(contentLeft, y + 20, contentRight, y + 20, {
      width: 0.35,
      color: s.c.hair,
    });
    y += 30;
  });

  if (listed.length < texts.length) {
    s.text(`…and ${texts.length - listed.length} more`, contentLeft + 22, y + 2, {
      size: T.small,
      color: s.c.ink3,
    });
    y += 20;
  }

  if (chars.length) {
    y += 14;
    s.label('EVERY NEW CHARACTER IN THIS SET', contentLeft, y, contentWidth, `${chars.length}`);
    y += 14;
    let x = contentLeft;
    for (const c of chars) {
      if (x + 26 > contentRight) {
        x = contentLeft;
        y += 30;
      }
      if (y > bodyTop + bodyHeight - 26) break;
      s.glyphOrText(c, x, y, 24);
      x += 28;
    }
  }
}

/** One passage, with practice squares for what it taught if asked for. */
export async function renderReading(
  lib: Library,
  text: GeneratedText,
  sheet: SheetOptions,
  opts: ReadingOptions = {},
): Promise<RenderResult> {
  const doc = await PDFDocument.create();
  describe(doc, text.title);
  const theme: SheetTheme = themeOf(sheet);

  const taught = entriesFor(lib, text.teach);
  const practice = opts.practice ? taught : [];
  await ensureStrokes(lib, [...text.teach, ...everyGlyph(taught)]);

  const fonts: Fonts = await embedFonts(doc, {
    core: await coreCovers([
      ...textStrings(text),
      ...Object.values(text.glosses ?? {}).flatMap((g) => [g.py, g.d]),
      ...everyString(lib, taught, opts.footerNote),
    ]),
  });

  const d: Doc = { doc, fonts, theme, strokes: lib.strokes, sheets: [] };
  drawText(d, lib, text, sheet, opts);
  if (practice.length) {
    drawPractice(
      d,
      lib,
      practice,
      { ...sheet, perPage: opts.perPage ?? 3 },
      `${text.title} — practice`,
    );
  }
  stampFooters(d, opts.footerNote);

  return { bytes: await doc.save(), pages: d.sheets.length };
}

/**
 * A whole session in one file: contents, every passage, then one run of
 * practice sheets covering everything the session taught.
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
  const taught = entriesFor(lib, chars);
  const glosses = textsGlosses(texts);
  await ensureStrokes(lib, [...chars, ...everyGlyph(taught)]);

  const fonts: Fonts = await embedFonts(doc, {
    core: await coreCovers([
      name,
      ...texts.flatMap(textStrings),
      ...Object.values(glosses).flatMap((g) => [g.py, g.d]),
      ...everyString(lib, taught, opts.footerNote),
    ]),
  });

  const d: Doc = { doc, fonts, theme, strokes: lib.strokes, sheets: [] };
  if (texts.length > 1) drawContents(d, name, texts, chars);
  for (const t of texts) drawText(d, lib, t, sheet, opts);
  if (opts.practice && taught.length) {
    drawPractice(d, lib, taught, { ...sheet, perPage: opts.perPage ?? 3 }, `${name} — practice`);
  }
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

  const chars = resolve(lib, items);
  const prompts: RecallPrompt[] = chars.map((c, i) => ({
    n: i + 1,
    char: c.c,
    py: c.py[0] ?? '',
    gloss: c.def,
    strokes: c.sc ?? 0,
  }));

  const answers = opts.answers ?? 'foot';
  const style: RecallStyle = {
    rows: opts.rows ?? 1,
    strokeHint: opts.strokeHint !== false,
    keyOnPage: answers === 'foot',
  };

  await ensureStrokes(lib, prompts.map((p) => p.char));
  const fonts = await embedFonts(doc, {
    core: await coreCovers([
      title,
      opts.footerNote ?? '',
      ...prompts.flatMap((p) => [p.char, p.py, p.gloss]),
    ]),
  });

  const layout = recallLayout(sheet, style);
  const pages = Math.max(1, Math.ceil(prompts.length / layout.perPage));

  for (let p = 0; p < pages; p++) {
    const slice = prompts.slice(p * layout.perPage, (p + 1) * layout.perPage);
    const page = doc.addPage([PAGE.width, PAGE.height]);
    const s = new Sheet(page, fonts, lib.strokes, theme);

    header(
      s,
      title,
      prompts.length > slice.length
        ? `${slice[0].n}–${slice[slice.length - 1].n} of ${prompts.length}`
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

/* ---------------------------------------------------------------- fitting */

export interface FitReport {
  rows: number;
  cols: number;
  maxRows: number;
  squares: number;
  /** sections that could not be fitted even at this profile */
  dropped: string[];
}

/**
 * How much writing room a collection's settings actually leave, and whether
 * anything had to give. Surfaced in the editor so you find out while editing,
 * not after downloading.
 */
export function fitFor(lib: Library, c: Collection, items: ItemId[]): FitReport {
  const o = c.sheet;
  const perPage = Math.max(1, o.perPage);
  const slotH = slotHeight(perPage);
  const chars = resolve(lib, items);

  let worst = Infinity;
  for (const e of chars) worst = Math.min(worst, slotH - charInfoHeight(e, o, slotH));
  if (!Number.isFinite(worst)) worst = slotH;

  const fit = (maxRows: number) => gridFit(contentWidth, worst, maxRows, minCellFor(o.squareSize));

  const { rows, cols } = fit(o.practiceRows);
  // How many rows the page could hold at all, so the editor's slider can stop
  // where sliding further stops changing anything.
  const maxRows = Math.max(1, fit(99).rows);

  const dropped = new Set<string>();
  for (const e of chars) charPlan(e, o, slotH).dropped.forEach((d) => dropped.add(d));

  return { rows, cols, maxRows, squares: rows * cols, dropped: [...dropped] };
}
