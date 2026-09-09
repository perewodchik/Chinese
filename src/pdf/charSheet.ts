import type { CharacterEntry, ComponentGloss } from '../data/types';
import type { SheetOptions } from '../store/types';
import { Sheet } from './draw';
import { gridFit, minCellFor } from './grid';
import { C, contentLeft, contentWidth } from './theme';

/** How the parts of a character are arranged, spelled out rather than drawn. */
const IDC_NAME: Record<string, string> = {
  '⿰': 'side by side',
  '⿱': 'one above the other',
  '⿲': 'three side by side',
  '⿳': 'three stacked',
  '⿴': 'one enclosing the other',
  '⿵': 'open at the bottom',
  '⿶': 'open at the top',
  '⿷': 'open at the right',
  '⿸': 'wrapped from the upper left',
  '⿹': 'wrapped from the upper right',
  '⿺': 'wrapped from the lower left',
  '⿻': 'overlapping',
};

export interface CharSheetCtx {
  components: Record<string, ComponentGloss>;
}

/**
 * Type sizes and spacing per density. Only the scale changes: both densities
 * use the same two-column arrangement.
 */
const SCALE = {
  comfortable: {
    headH: 74,
    box: 70,
    py: 15,
    def: 9.6,
    label: 6.2,
    body: 8.4,
    fact: 9.4,
    partGlyph: 17,
    partRow: 19,
    soBox: 25,
    wordRow: 23,
    labelH: 11,
    gap: 10,
    blockGap: 8,
  },
  compact: {
    headH: 50,
    box: 44,
    py: 12.5,
    def: 8.8,
    label: 5.8,
    body: 7.5,
    fact: 8.6,
    partGlyph: 13,
    partRow: 15,
    soBox: 19,
    wordRow: 21,
    labelH: 9.5,
    gap: 6,
    blockGap: 6,
  },
} as const;

const COL_GAP = 18;
/**
 * Left is the character itself - how it is written, what it is built from,
 * where it came from. Right is the character in use - the words it appears in
 * and a sentence, each with its pinyin set above the hanzi.
 *
 * The right column is the wider of the two because a word needs room for a
 * reading and a gloss; the stroke boxes and part rows on the left do not.
 */
const LEFT_SHARE = 0.46;

const leftWidth = () => (contentWidth - COL_GAP) * LEFT_SHARE;
const rightWidth = () => contentWidth - COL_GAP - leftWidth();

const scaleOf = (o: SheetOptions) => SCALE[o.density ?? 'comfortable'];

const firstSense = (s: string) => s.split(/[;,]/)[0].trim();

/** Long enough to be worth wrapping onto its own lines. */
function etymologyText(e: CharacterEntry): string {
  const ety = e.ety;
  if (!ety) return '';
  const hint = ety.hint ?? '';
  if (ety.type === 'pictophonetic' && ety.semantic && ety.phonetic) {
    return `${ety.semantic} carries the meaning${hint ? ` (${hint})` : ''}; ${ety.phonetic} carries the sound.`;
  }
  return hint;
}

function hasParts(e: CharacterEntry): boolean {
  return Boolean(e.ids && e.parts.length > 1);
}

// -------------------------------------------------------------- measuring

interface Blocks {
  strokeOrder: number;
  words: number;
  sentence: number;
  parts: number;
  origin: number;
  confusables: number;
}

/**
 * Heights are worked out from counts rather than by measuring text, so the
 * editor can predict a page without building one. They round up, so the
 * drawing always fits inside what was reserved.
 */
function blockHeights(e: CharacterEntry, o: SheetOptions): Blocks {
  const S = scaleOf(o);
  const perRow = Math.max(1, Math.floor(leftWidth() / (S.soBox + 2)));
  const strokes = Math.max(1, e.sc ?? 1);

  const text = etymologyText(e);
  const charsPerLine = Math.max(18, Math.floor(rightWidth() / (S.body * 0.62)));
  const originLines = Math.min(3, Math.max(1, Math.ceil(text.length / charsPerLine)));

  return {
    strokeOrder: S.labelH + Math.ceil(Math.min(strokes, perRow * 2) / perRow) * (S.soBox + 3),
    words:
      S.labelH +
      S.body +
      5 +
      Math.max(0, Math.min(3, e.words.length) - 1) * S.wordRow +
      S.def +
      4,
    sentence: S.labelH + S.body * 3.5 + S.def + 3,
    parts: hasParts(e) ? S.labelH + 10 + e.parts.length * S.partRow : 0,
    origin: text ? S.labelH + originLines * (S.body * 1.32) + 9 : 0,
    confusables: S.labelH + S.partRow,
  };
}

/** Least valuable first: the order things give way in when the page is full. */
const DROP_ORDER = ['sentence', 'confusables', 'origin', 'parts', 'words', 'strokeOrder'] as const;
type BandId = (typeof DROP_ORDER)[number];

export const BAND_NAMES: Record<string, string> = {
  sentence: 'Example sentence',
  confusables: "Don't confuse with",
  origin: 'Where it comes from',
  parts: 'Built from',
  words: 'Common words',
  strokeOrder: 'Stroke order strip',
};

const LEFT_BANDS: BandId[] = ['strokeOrder', 'parts', 'origin'];
const RIGHT_BANDS: BandId[] = ['words', 'sentence', 'confusables'];

function available(e: CharacterEntry, o: SheetOptions): Set<BandId> {
  const on = new Set<BandId>();
  if (o.strokeOrder) on.add('strokeOrder');
  if (o.words && e.words.length) on.add('words');
  if (o.sentence && e.sent) on.add('sentence');
  if (o.memoryAids && hasParts(e)) on.add('parts');
  if (o.memoryAids && etymologyText(e)) on.add('origin');
  if (o.confusables && e.conf.length) on.add('confusables');
  return on;
}

export interface CharPlan {
  keep: Set<BandId>;
  dropped: string[];
  /** height of the two-column zone under the heading */
  infoH: number;
  /** everything above the practice grid */
  used: number;
}

/** Room held back for the practice grid: a whole square, or it cannot fit one. */
const reserveFor = (o: SheetOptions) => minCellFor(o.squareSize) + 2;

export function charPlan(e: CharacterEntry, o: SheetOptions, slot: number): CharPlan {
  const S = scaleOf(o);
  const h = blockHeights(e, o);
  const keep = available(e, o);
  const dropped: string[] = [];

  // Blocks in a column are separated, so a column is taller than the sum of
  // its parts.
  const col = (ids: BandId[]) => {
    const on = ids.filter((id) => keep.has(id));
    return on.reduce((n, id) => n + h[id], 0) + Math.max(0, on.length - 1) * S.blockGap;
  };
  const zone = () => Math.max(col(LEFT_BANDS), col(RIGHT_BANDS));

  let infoH = zone();
  const total = () => S.headH + (infoH > 0 ? infoH + S.gap : 0);

  // The zone is as tall as its taller column, so dropping something from the
  // shorter one frees nothing while still costing you the content. Always take
  // the least valuable block from whichever column is currently setting the
  // height.
  while (total() + reserveFor(o) > slot) {
    const taller = col(LEFT_BANDS) >= col(RIGHT_BANDS) ? LEFT_BANDS : RIGHT_BANDS;
    const victim =
      DROP_ORDER.find((id) => keep.has(id) && taller.includes(id)) ??
      DROP_ORDER.find((id) => keep.has(id));
    if (!victim) break;
    keep.delete(victim);
    dropped.push(victim);
    infoH = zone();
  }

  return { keep, dropped: dropped.map((d) => BAND_NAMES[d] ?? d), infoH, used: total() };
}

/** Space a block needs before the practice grid takes whatever is left. */
export function charInfoHeight(e: CharacterEntry, o: SheetOptions, slot = Infinity): number {
  return charPlan(e, o, slot).used;
}

// --------------------------------------------------------------- drawing

function label(s: Sheet, text: string, x: number, y: number, size: number) {
  s.text(text, x, y, { size, color: C.faint, bold: true });
}

export function drawCharBlock(
  s: Sheet,
  e: CharacterEntry,
  o: SheetOptions,
  ctx: CharSheetCtx,
  top: number,
  height: number,
) {
  const S = scaleOf(o);
  const compact = (o.density ?? 'comfortable') === 'compact';
  const x0 = contentLeft;
  const x1 = contentLeft + contentWidth;
  const plan = charPlan(e, o, height);
  const { keep } = plan;

  // ---------------------------------------------------------------- heading
  s.cell(x0, top, S.box, o.gridStyle);
  s.glyph(e.c, x0, top, S.box, {
    color: C.ink,
    groups: o.componentColours,
    inset: 0.1,
  });

  const tx = x0 + S.box + (compact ? 14 : 18);
  const tag = `${e.i}   HSK ${e.hsk}`;
  const tagW = s.measure(tag, S.label + 0.6, true);
  s.textRight(tag, x1, top + (compact ? 10 : 12), {
    size: S.label + 0.6,
    color: C.faint,
    bold: true,
  });

  const pyY = compact ? 12 : 15;
  const pyW = s.text(e.py.join(' / '), tx, top + pyY, { size: S.py, color: C.accent });
  // The meaning sits beside the pinyin when there is room for it, which keeps
  // the heading to two lines instead of three.
  const defX = tx + pyW + 12;
  const defRoom = x1 - defX - tagW - 12;
  if (defRoom > 150) {
    s.text(e.def, defX, top + pyY, { size: S.def, maxWidth: defRoom });
  } else {
    s.text(e.def, tx, top + pyY + S.def + 6, {
      size: S.def,
      maxWidth: x1 - tx - 8,
    });
  }

  const ruleY = top + (compact ? 19 : 40);
  s.line(tx, ruleY, x1, ruleY, { width: 0.4, color: C.rule });

  // facts strip - the things you glance at, spread across the full width
  let fx = tx;
  const factY = ruleY + (compact ? 13 : 15);
  const fact = (name: string, value: string, big = false) => {
    if (!value) return;
    label(s, name, fx, factY - 1, S.label);
    fx += s.measure(name, S.label, true) + 5;
    fx += s.text(value, fx, factY, { size: big ? S.fact + 1.5 : S.fact }) + 4;
  };
  if (e.rad) {
    fact('RADICAL', e.rad, true);
    const g = ctx.components[e.rad];
    if (g?.def) fx += s.text(firstSense(g.def), fx, factY, { size: S.body - 0.6, color: C.muted });
    fx += 14;
  }
  if (e.sc) {
    fact('STROKES', String(e.sc));
    fx += 10;
  }
  if (o.traditional && e.trad) {
    fact('TRADITIONAL', e.trad, true);
    fx += 10;
  }
  if (e.freq < 6000) {
    label(s, 'FREQUENCY', fx, factY - 1, S.label);
    fx += s.measure('FREQUENCY', S.label, true) + 5;
    s.text(`#${e.freq}`, fx, factY, { size: S.fact });
  }

  let y = top + S.headH;

  // ------------------------------------------------------------- info zone
  const lw = leftWidth();
  const rw = rightWidth();
  const lx = x0;
  const rx = x0 + lw + COL_GAP;
  let ly = y;
  let ry = y;

  const rightUsed = RIGHT_BANDS.some((b) => keep.has(b));
  const leftUsed = LEFT_BANDS.some((b) => keep.has(b));
  if (rightUsed && leftUsed && plan.infoH > 10) {
    const dx = x0 + lw + COL_GAP / 2;
    s.line(dx, y + 2, dx, y + plan.infoH - 2, { width: 0.4, color: C.rule });
  }

  // ---- left: stroke order
  if (keep.has('strokeOrder')) {
    label(s, 'STROKE ORDER', lx, ly + S.labelH - 4, S.label);
    const n = s.strokeCount(e.c);
    const size = S.soBox;
    const perRow = Math.max(1, Math.floor(lw / (size + 3)));
    // Two rows at most; a long character shows every other step instead.
    const shown = Math.min(n, perRow * 2);
    const step = n <= shown ? 1 : Math.ceil(n / shown);
    const frames: number[] = [];
    for (let i = step - 1; i < n; i += step) frames.push(i + 1);
    if (frames[frames.length - 1] !== n) frames.push(n);

    frames.slice(0, perRow * 2).forEach((upto, i) => {
      const bx = lx + (i % perRow) * (size + 3);
      const by = ly + S.labelH + Math.floor(i / perRow) * (size + 3);
      s.rect(bx, by, size, size, { border: C.rule, borderWidth: 0.4 });
      s.glyph(e.c, bx, by, size, {
        upto,
        color: C.trace,
        highlight: C.accent,
        groups: o.componentColours,
        inset: 0.1,
      });
    });
    ly += blockHeights(e, o).strokeOrder + S.blockGap;
  }

  // ---- right: words, reading set above the hanzi as a textbook would
  if (keep.has('words')) {
    label(s, 'COMMON WORDS', rx, ry + S.labelH - 4, S.label);
    let wy = ry + S.labelH + S.body + 2;
    for (const w of e.words.slice(0, 3)) {
      s.text(w.p, rx + 1, wy, { size: S.body - 0.6, color: C.accent, maxWidth: rw });
      const zw = s.text(w.w, rx, wy + S.def + 3, { size: S.def + 2 });
      s.text(w.d, rx + zw + 8, wy + S.def + 2, {
        size: S.body - 0.6,
        color: C.muted,
        maxWidth: Math.max(40, rw - zw - 8),
      });
      wy += S.wordRow;
    }
    ry += blockHeights(e, o).words + S.blockGap;
  }

  // ---- right: sentence, same treatment
  if (keep.has('sentence') && e.sent) {
    label(s, 'IN A SENTENCE', rx, ry + S.labelH - 4, S.label);
    let sy = ry + S.labelH + S.body;
    if (e.sent.py) {
      s.text(e.sent.py, rx + 1, sy, {
        size: S.body - 0.9,
        color: C.accent,
        maxWidth: rw,
      });
      sy += S.body * 1.15;
    }
    s.text(e.sent.zh, rx, sy + S.def - 2, { size: S.def, maxWidth: rw });
    s.text(e.sent.en, rx, sy + S.def + S.body * 1.3 - 2, {
      size: S.body - 0.9,
      color: C.muted,
      maxWidth: rw,
    });
    ry += blockHeights(e, o).sentence + S.blockGap;
  }

  // ---- left: what the character is built from
  if (keep.has('parts')) {
    const idc = e.ids ? IDC_NAME[e.ids[0]] : '';
    label(s, 'BUILT FROM', lx, ly + S.labelH - 4, S.label);
    if (idc) {
      s.text(idc, lx + s.measure('BUILT FROM', S.label, true) + 7, ly + S.labelH - 4, {
        size: S.label,
        color: C.faint,
      });
    }
    let py = ly + S.labelH + 4;
    e.parts.forEach((p, i) => {
      if (i) {
        s.text('+', lx + S.partGlyph / 2 - 2, py + S.partGlyph * 0.5, {
          size: S.body,
          color: C.faint,
        });
      }
      const gy = py + (i ? 6 : 0);
      if ([...p].length === 1 && s.hasGlyph(p)) {
        s.glyph(p, lx, gy, S.partGlyph, { color: C.ink, inset: 0.02 });
      } else {
        s.text(p, lx, gy + S.partGlyph * 0.8, { size: S.partGlyph * 0.8 });
      }
      const g = ctx.components[p];
      const gx = lx + S.partGlyph + 7;
      if (g?.py) {
        const w = s.text(g.py, gx, gy + S.partGlyph * 0.75, {
          size: S.body - 0.6,
          color: C.accent,
        });
        if (g.def) {
          s.text(firstSense(g.def), gx + w + 6, gy + S.partGlyph * 0.75, {
            size: S.body - 0.6,
            color: C.muted,
            maxWidth: lx + lw - (gx + w + 6),
          });
        }
      }
      py = gy + S.partRow;
    });
    ly += blockHeights(e, o).parts + S.blockGap;
  }

  // ---- left: where it comes from. No panel behind it - a rule in the accent
  // colour and full-strength text reads as a note without washing the block.
  if (keep.has('origin')) {
    label(s, 'WHERE IT COMES FROM', lx, ly + S.labelH - 4, S.label);
    const top2 = ly + S.labelH - 2;
    const h = blockHeights(e, o).origin - S.labelH;
    s.rect(lx, top2, 2, h - 3, { fill: C.accent });
    s.paragraph(etymologyText(e), lx + 9, top2 + S.body + 2, lw - 11, {
      size: S.body + 0.5,
      lineHeight: (S.body + 0.5) * 1.34,
      maxLines: 3,
      color: C.ink,
    });
    ly += blockHeights(e, o).origin + S.blockGap;
  }



  // ---- right: lookalikes
  if (keep.has('confusables')) {
    label(s, "DON'T CONFUSE WITH", rx, ry + S.labelH - 4, S.label);
    let cx = rx;
    const cy = ry + S.labelH - 2;
    for (const d of e.conf) {
      if (cx > rx + rw - 42) break;
      if (s.hasGlyph(d)) {
        s.glyph(d, cx, cy, S.partGlyph, { color: C.ink, inset: 0.02 });
        cx += S.partGlyph + 2;
      } else {
        cx += s.text(d, cx, cy + S.partGlyph * 0.8, { size: S.partGlyph * 0.8 }) + 3;
      }
      const g = ctx.components[d];
      if (g?.py) {
        cx +=
          s.text(g.py, cx, cy + S.partGlyph * 0.75, {
            size: S.body - 1,
            color: C.muted,
            maxWidth: Math.max(20, rx + rw - cx),
          }) + 9;
      }
    }
    ry += blockHeights(e, o).confusables + S.blockGap;
  }

  y += plan.infoH > 0 ? plan.infoH + S.gap : 0;

  // ------------------------------------------------------------- practice
  const { cols, rows, cell } = gridFit(
    contentWidth,
    top + height - y,
    o.practiceRows,
    minCellFor(o.squareSize),
  );
  const left = x0 + (contentWidth - cols * cell) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = left + c * cell;
      const cy = y + r * cell;
      s.cell(cx, cy, cell, o.gridStyle);
      // Only the opening squares are pre-filled: solid enough to trace, then
      // fainter, then nothing.
      if (r === 0) {
        if (c < o.traceCount) {
          s.glyph(e.c, cx, cy, cell, { color: C.trace, inset: 0.12 });
        } else if (c < o.traceCount + o.fadeCount) {
          s.glyph(e.c, cx, cy, cell, { color: C.fade, inset: 0.12 });
        }
      }
    }
  }

  if (o.pinyinPrompt && rows > 0) {
    s.text(e.py.join(' '), left + 2, y + rows * cell + 8, { size: 6.5, color: C.faint });
  }
}
