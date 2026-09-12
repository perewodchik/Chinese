import { PDFDocument } from 'pdf-lib';
import type { RadicalEntry, RadicalLibrary } from '../../data/radicals';
import { radicalPartsLostAt, type RadicalSheet } from '../../domain/radicals/sheet';
import { Sheet } from '../draw';
import { coreCovers, embedFonts } from '../fonts';
import { describe, footer, header, separate } from '../layout/furniture';
import { blockSpacing, bodyTop, PAGE, slotHeight } from '../layout/page';
import type { RenderResult } from '../render';
import { themeOf } from '../theme';
import { drawRadicalBlock, radicalPlan } from './block';

/**
 * Radical sheets, built the same way as the worksheets and out of nothing they
 * share: the radical data carries its own outlines, its own readings and its
 * own examples, so this never reaches into the character library.
 */

/** Every string these blocks will typeset, for choosing which face to embed. */
function everyString(radicals: RadicalEntry[], ...extra: Array<string | undefined>): string[] {
  const out: string[] = extra.filter(Boolean) as string[];
  for (const r of radicals) {
    out.push(r.r, r.kangxi, r.word, r.py, r.mean, r.about ?? '', r.note ?? '');
    for (const f of r.forms) {
      out.push(f.g, f.name ?? '', f.namePy ?? '', f.tip ?? '');
      for (const e of f.ex) out.push(e.c, e.py, e.d);
    }
  }
  return out;
}

export interface RadicalRenderOptions {
  title: string;
  footerNote?: string;
  /**
   * The real size of the run when only its first pages are being drawn, so a
   * three-page preview still says "1-3 of 50" rather than "1-3 of 3".
   */
  total?: number;
  pages?: number;
}

export async function renderRadicals(
  rlib: RadicalLibrary,
  radicals: RadicalEntry[],
  o: RadicalSheet,
  opts: RadicalRenderOptions,
): Promise<RenderResult> {
  const doc = await PDFDocument.create();
  describe(doc, opts.title);
  const theme = themeOf(o);
  const fonts = await embedFonts(doc, {
    core: await coreCovers(everyString(radicals, opts.title, opts.footerNote)),
  });

  const perPage = Math.max(1, o.perPage);
  const total = opts.total ?? radicals.length;
  const drawn = Math.max(1, Math.ceil(radicals.length / perPage));
  const pageCount = opts.pages ?? drawn;
  const slotH = slotHeight(perPage);
  const spacing = blockSpacing(perPage);

  for (let p = 0; p < drawn; p++) {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    const s = new Sheet(page, fonts, rlib.strokes, theme);
    const slice = radicals.slice(p * perPage, (p + 1) * perPage);
    const first = p * perPage + 1;
    const last = p * perPage + slice.length;

    header(s, opts.title, total ? `Radicals ${first}–${last} of ${total}` : '');
    slice.forEach((r, i) => {
      const top = bodyTop + i * (slotH + spacing);
      separate(s, top, slotH, spacing, i === 0);
      drawRadicalBlock(s, r, o, top, slotH);
    });
    footer(s, opts.footerNote?.trim() ?? '', `${p + 1} / ${pageCount}`);
  }

  return { bytes: await doc.save(), pages: drawn };
}

export interface RadicalFitReport {
  /** rows of squares under the tightest of these radicals */
  rows: number;
  cols: number;
  /** the most rows worth asking for: past this, nothing changes */
  maxRows: number;
  /** how many of them have forms sharing a row at this size */
  shared: number;
  /** what a roomier sheet would say that this one has no room for */
  lost: string[];
}

/**
 * What the chosen size actually leaves room for, so the designer can say it
 * before the download rather than after.
 */
export function radicalFit(radicals: RadicalEntry[], o: RadicalSheet): RadicalFitReport {
  const slotH = slotHeight(Math.max(1, o.perPage));
  const lost = radicalPartsLostAt(o.perPage);
  if (!radicals.length) {
    return { rows: o.practiceRows, cols: 0, maxRows: 8, shared: 0, lost };
  }

  let rows = Infinity;
  let cols = 0;
  let maxRows = Infinity;
  let shared = 0;
  for (const r of radicals) {
    const plan = radicalPlan(r, o, slotH);
    rows = Math.min(rows, plan.rows.length + plan.free);
    cols = plan.cols;
    if (plan.shared) shared++;
    const most = radicalPlan(r, { ...o, practiceRows: 99 }, slotH);
    maxRows = Math.min(maxRows, most.rows.length + most.free);
  }
  return { rows, cols, maxRows: Math.max(1, maxRows), shared, lost };
}
