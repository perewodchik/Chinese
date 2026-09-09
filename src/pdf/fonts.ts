import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont } from 'pdf-lib';

export interface Fonts {
  sans: PDFFont;
  sansBold: PDFFont;
  /** LXGW WenKai - a Kai (regular script) face, for Chinese text */
  han: PDFFont;
}

type Buffers = {
  sans: ArrayBuffer;
  sansBold: ArrayBuffer;
  han: ArrayBuffer;
  hanCore: ArrayBuffer;
  coreSet: Set<number>;
};

let buffers: Promise<Buffers> | null = null;

function fetchFonts(): Promise<Buffers> {
  if (!buffers) {
    buffers = (async () => {
      const [sans, sansBold, han, hanCore, coreMeta] = await Promise.all([
        fetch('fonts/sans.ttf').then((r) => r.arrayBuffer()),
        fetch('fonts/sans-semibold.ttf').then((r) => r.arrayBuffer()),
        fetch('fonts/wenkai.ttf').then((r) => r.arrayBuffer()),
        fetch('fonts/wenkai-core.ttf').then((r) => r.arrayBuffer()),
        fetch('fonts/wenkai-core.json').then((r) => r.json()),
      ]);
      return {
        sans,
        sansBold,
        han,
        hanCore,
        coreSet: new Set<number>(coreMeta.codepoints ?? []),
      };
    })();
  }
  return buffers;
}

/** Warms the font cache so the first PDF is not noticeably slower. */
export const preloadFonts = () => fetchFonts().then(() => undefined);

/** True when the smaller face covers every character the document will draw. */
export async function coreCovers(text: Iterable<string>): Promise<boolean> {
  const { coreSet } = await fetchFonts();
  for (const s of text) {
    for (const ch of s) {
      const cp = ch.codePointAt(0)!;
      if (cp > 0x2e7f && !coreSet.has(cp)) return false;
    }
  }
  return true;
}

export async function embedFonts(
  doc: PDFDocument,
  opts: { core?: boolean } = {},
): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const b = await fetchFonts();
  // `subset: true` looks tempting but pdf-lib's subsetter mangles these files:
  // it keeps the text layer intact while dropping almost every CJK glyph, so
  // 一些 prints as 些 and 一样 prints as nothing. Everything embedded is
  // therefore carried whole, which is why the Chinese face comes in two sizes
  // and we pick the smaller one whenever it is enough.
  const [sans, sansBold, han] = await Promise.all([
    doc.embedFont(b.sans, { subset: false }),
    doc.embedFont(b.sansBold, { subset: false }),
    doc.embedFont(opts.core ? b.hanCore : b.han, { subset: false }),
  ]);
  return { sans, sansBold, han };
}

/**
 * Characters the Latin subset can actually draw: ASCII, Latin Extended (which
 * is where the pinyin tone marks live) and common typographic punctuation.
 * Anything else - Chinese, IDS operators, CJK punctuation - goes to WenKai.
 */
const LATIN =
  /^[ -~ -ɏʰ-˿‐-‟†-‧‰-⁞]$/;

export type Run = { font: PDFFont; text: string; latin: boolean };

/** Splits mixed English/Chinese text into runs, each drawable by one font. */
export function splitRuns(text: string, f: Fonts, bold = false): Run[] {
  const runs: Run[] = [];
  for (const ch of text) {
    const latin = LATIN.test(ch);
    const font = latin ? (bold ? f.sansBold : f.sans) : f.han;
    const last = runs[runs.length - 1];
    if (last && last.font === font) last.text += ch;
    else runs.push({ font, text: ch, latin });
  }
  return runs;
}
