import { PDFDocument } from 'pdf-lib';
import { ensureStrokes } from '../data/load';
import type { CharacterEntry, Library, RadicalEntry } from '../data/types';
import { idKind, type ItemId, type Template } from '../store/types';
import { BAND_NAMES, charInfoHeight, charPlan, drawCharBlock } from './charSheet';
import { Sheet } from './draw';
import { gridFit, minCellFor } from './grid';
import { coreCovers, embedFonts } from './fonts';
import { drawRadicalBlock, radicalInfoHeight } from './radicalSheet';
import { C, PAGE, contentLeft, contentRight, contentWidth } from './theme';

const HEADER = 26;
const FOOTER = 18;

export interface RenderResult {
  bytes: Uint8Array;
  pages: number;
}

function resolve(lib: Library, ids: ItemId[]) {
  const chars: CharacterEntry[] = [];
  const rads: RadicalEntry[] = [];
  const byNum = new Map(lib.radicals.map((r) => [r.n, r]));
  for (const id of ids) {
    if (idKind(id) === 'radical') {
      const r = byNum.get(Number(id.slice(1)));
      if (r) rads.push(r);
    } else {
      const c = lib.byChar.get(id.slice(1));
      if (c) chars.push(c);
    }
  }
  return { chars, rads };
}

/** Every character these blocks will draw from stroke outlines. */
function everyGlyph(
  chars: CharacterEntry[],
  rads: RadicalEntry[],
): string[] {
  const out: string[] = [];
  for (const c of chars) {
    out.push(c.c, ...c.parts, ...c.conf);
    if (c.rad) out.push(c.rad);
  }
  for (const r of rads) out.push(r.r, ...r.variants, ...r.ex);
  return out.filter((x) => [...x].length === 1);
}

/** Every string these blocks will typeset, for choosing which face to embed. */
function everyString(
  lib: Library,
  chars: CharacterEntry[],
  rads: RadicalEntry[],
  ...extra: Array<string | undefined>
): string[] {
  const out: string[] = extra.filter(Boolean) as string[];
  const gloss = (k: string) => {
    const g = lib.components[k];
    if (g) out.push(g.def, g.py);
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
  for (const r of rads) {
    out.push(r.r, r.mean, r.py, r.cn ?? '', r.cnPy ?? '', r.note ?? '', ...r.variants);
    r.ex.forEach((e) => (out.push(e), gloss(e)));
  }
  return out;
}

function header(s: Sheet, title: string, right: string) {
  s.rect(contentLeft, PAGE.top - 9, 3, 12, { fill: C.accent });
  s.text(title, contentLeft + 10, PAGE.top, { size: 11, bold: true });
  s.textRight(right, contentRight, PAGE.top, { size: 8, color: C.muted });
  s.line(contentLeft, PAGE.top + 8, contentRight, PAGE.top + 8, {
    width: 0.7,
    color: C.ink,
  });
}

function footer(s: Sheet, left: string, right: string) {
  const y = PAGE.height - PAGE.bottom + 8;
  s.line(contentLeft, y - 10, contentRight, y - 10, { width: 0.4, color: C.rule });
  s.text(left, contentLeft, y, { size: 6.8, color: C.faint });
  s.textRight(right, contentRight, y, { size: 6.8, color: C.faint });
}

/** Vertical space available for blocks, once the header and footer are taken. */
const bodyTop = PAGE.top + HEADER;
const bodyHeight = PAGE.height - PAGE.bottom - FOOTER - bodyTop;

export async function renderTemplate(
  lib: Library,
  template: Template,
  opts: {
    footerNote?: string;
    /**
     * Real size of the template when only a sample of it is being drawn, so a
     * two-page preview still says "1-2 of 20" rather than "1-2 of 4".
     */
    totalItems?: number;
    totalPages?: number;
  } = {},
): Promise<RenderResult> {
  const doc = await PDFDocument.create();
  doc.setTitle(template.name);
  doc.setSubject('Chinese handwriting practice');
  doc.setCreator('Hanzi Workshop');
  doc.setProducer('Hanzi Workshop');

  const { chars, rads } = resolve(lib, template.items);
  const o = template.options;

  // Outlines for the higher HSK bands are fetched on demand, so make sure
  // every character on this sheet has one before drawing anything.
  await ensureStrokes(lib, everyGlyph(chars, rads));

  const fonts = await embedFonts(doc, {
    core: await coreCovers(everyString(lib, chars, rads, template.name, opts.footerNote)),
  });
  const perPage = Math.max(1, o.perPage);

  const units: Array<{ kind: 'char' | 'radical'; index: number }> = [
    ...chars.map((_, i) => ({ kind: 'char' as const, index: i })),
    ...rads.map((_, i) => ({ kind: 'radical' as const, index: i })),
  ];

  const total = opts.totalItems ?? units.length;
  const drawnPages = Math.max(1, Math.ceil(units.length / perPage));
  const pageCount = opts.totalPages ?? drawnPages;
  const stamp = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  for (let p = 0; p < drawnPages; p++) {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    const s = new Sheet(page, fonts, lib.strokes);

    const slice = units.slice(p * perPage, (p + 1) * perPage);
    const first = p * perPage + 1;
    const last = p * perPage + slice.length;

    header(
      s,
      template.name,
      total ? `${template.kind === 'char' ? 'Characters' : 'Radicals'} ${first}–${last} of ${total}` : '',
    );

    const gap = 14;
    const slotH = (bodyHeight - gap * (perPage - 1)) / perPage;

    slice.forEach((u, i) => {
      const top = bodyTop + i * (slotH + gap);
      if (i > 0) {
        s.line(contentLeft, top - gap / 2, contentRight, top - gap / 2, {
          width: 0.4,
          color: C.rule,
          dash: [2, 2],
        });
      }
      if (u.kind === 'char') {
        drawCharBlock(s, chars[u.index], o, { components: lib.components }, top, slotH);
      } else {
        drawRadicalBlock(s, rads[u.index], o, lib.components, top, slotH);
      }
    });

    const note = opts.footerNote?.trim();
    footer(
      s,
      note ? `${template.name} · ${note}` : template.name,
      `${stamp}   ${p + 1} / ${pageCount}`,
    );
  }

  return { bytes: await doc.save(), pages: drawnPages };
}

/** How many pages a template will produce, without building the document. */
export function pageEstimate(template: Template): number {
  return Math.max(1, Math.ceil(template.items.length / Math.max(1, template.options.perPage)));
}

/**
 * Rough check that a block's fixed bands leave room to write in. Surfaced in
 * the editor so you find out while editing, not after downloading.
 */
export function practiceRowsFor(lib: Library, template: Template) {
  const o = template.options;
  const perPage = Math.max(1, o.perPage);
  const gap = 14;
  const slotH = (bodyHeight - gap * (perPage - 1)) / perPage;
  let worst = Infinity;
  const { chars, rads } = resolve(lib, template.items);
  for (const c of chars) worst = Math.min(worst, slotH - charInfoHeight(c, o, slotH));
  for (const r of rads) worst = Math.min(worst, slotH - radicalInfoHeight(r, o, slotH));
  if (!Number.isFinite(worst)) worst = slotH;

  const fit = (maxRows: number) =>
    template.kind === 'char'
      ? gridFit(contentWidth, worst, maxRows, minCellFor(o.squareSize))
      : gridFit(contentWidth, worst, maxRows, Math.max(30, minCellFor(o.squareSize) - 4), 48);
  const { rows, cols } = fit(o.practiceRows);
  // How many rows the page could hold at all, so the editor's slider can stop
  // where sliding further stops changing anything.
  const maxRows = Math.max(1, fit(99).rows);

  // Which switched-on bands the page cannot actually fit, so the editor can
  // say so instead of silently leaving them out.
  const dropped = new Set<string>();
  for (const c of chars) charPlan(c, o, slotH).dropped.forEach((d) => dropped.add(d));
  return {
    rows,
    cols,
    maxRows,
    squares: rows * cols,
    tight: rows < 1,
    dropped: [...dropped].map((d) => BAND_NAMES[d] ?? d),
  };
}
