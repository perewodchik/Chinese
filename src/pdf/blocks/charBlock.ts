import type { CharacterEntry, ComponentGloss } from '../../data/types';
import { firstSense, partGloss } from '../../domain/library';
import {
  BAND_NAME,
  profileFor,
  type CharBand,
  type SheetOptions,
} from '../../domain/sheet';
import type { Sheet } from '../draw';
import { gridFit, minCellFor } from '../layout/grid';
import { contentLeft, contentWidth } from '../layout/page';
import { charScale, type CharScale } from '../layout/profile';
import { T } from '../theme';

/** How the parts of a character sit together, in words rather than symbols. */
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

export interface CharBlockCtx {
  components: Record<string, ComponentGloss>;
}

/**
 * Two columns of equal width with a 22pt gutter.
 *
 * Equal rather than weighted, because a section can end up in either column:
 * the page flows its sections into whichever split balances them, so a
 * section's height has to be the same on both sides.
 */
const COL_GAP = 22;
const colWidth = () => (contentWidth - COL_GAP) / 2;

function etymologyText(e: CharacterEntry): string {
  const ety = e.ety;
  if (!ety) return '';
  const hint = ety.hint ?? '';
  if (ety.type === 'pictophonetic' && ety.semantic && ety.phonetic) {
    return `${ety.semantic} carries the meaning${hint ? ` (${hint})` : ''}; ${ety.phonetic} carries the sound.`;
  }
  return hint;
}

const hasParts = (e: CharacterEntry) =>
  Boolean(e.ids && e.parts.length > 1 && !e.parts.some((p) => p.includes('？')));

const CJK = /[⺀-鿿＀-￯]/;

/**
 * Roughly how wide a string sets, without a font to ask.
 *
 * Counting characters alone treats "Represents heaven (天), earth (旦)" as two
 * lines when it comfortably fits on one: a hanzi occupies a full em, a Latin
 * letter about half. Reserving that phantom second line left the rule beside
 * the note hanging below the text it was marking.
 */
function estimateWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += CJK.test(ch) ? size : size * 0.5;
  return w;
}

function originLineCount(e: CharacterEntry, S: CharScale): number {
  const text = etymologyText(e);
  if (!text) return 0;
  const usable = colWidth() - 12;
  return Math.min(3, Math.max(1, Math.ceil(estimateWidth(text, S.body) / usable)));
}

// -------------------------------------------------------------- measuring

type Heights = Record<CharBand, number>;

function blockHeights(e: CharacterEntry, o: SheetOptions): Heights {
  const S = charScale(o.perPage);
  const p = profileFor(o.perPage);
  const perRow = Math.max(1, Math.floor(colWidth() / (S.soBox + 3)));
  const strokes = Math.max(1, e.sc ?? 1);
  const rows = Math.ceil(Math.min(strokes, perRow * 2) / perRow);

  const lines = originLineCount(e, S);
  const words = Math.min(p.maxWords, e.words.length);
  const parts = Math.min(p.maxParts, e.parts.length);

  // Each section starts with a label on its own baseline; content begins
  // `labelDrop` below it. Getting this wrong is what put readings on top of
  // their own headings, so the sums here mirror the drawing line for line.
  return {
    strokeOrder: S.labelDrop - 3 + rows * (S.soBox + 4),
    words: words ? S.labelDrop + (words - 1) * S.wordRow + S.lead + 6 : 0,
    sentence: S.labelDrop + S.lead + 3 + S.small * 1.5 + 3,
    parts: hasParts(e)
      ? p.inlineParts
        ? S.labelDrop - 2 + S.partGlyph
        : S.labelDrop - 2 + parts * S.partRow
      : 0,
    origin: lines ? S.labelDrop + (lines - 1) * (S.body * 1.36) + 4 : 0,
    confusables: S.labelDrop - 2 + S.partGlyph,
  };
}

/** Least valuable first: the order things give way in when the page is full. */
const DROP_ORDER: CharBand[] = [
  'sentence',
  'confusables',
  'origin',
  'parts',
  'words',
  'strokeOrder',
];

/**
 * The order the sections are read in, and it never changes: learn to write it,
 * see what it is made of and where it came from, then meet it in words, in a
 * sentence, and against the things it is mistaken for.
 *
 * The page flows this one sequence into two columns and only moves the break
 * point, so reading is always "down the left, then down the right" no matter
 * which sections a given character happens to have. A third of characters have
 * no look-alikes and one in eight has no sentence; with the columns fixed, that
 * left whole blocks of paper empty.
 */
const ORDER: CharBand[] = [
  'strokeOrder',
  'parts',
  'origin',
  'words',
  'sentence',
  'confusables',
];

/**
 * Which sections this character has, wants and is allowed.
 *
 * "Allowed" is the profile: at three characters a page there is no example
 * sentence, not because this particular character's sentence would not fit but
 * because a page of three does not have sentences on it. Deciding that here
 * rather than by running out of room is what makes the sheets consistent.
 */
function available(e: CharacterEntry, o: SheetOptions): Set<CharBand> {
  const allowed = new Set(profileFor(o.perPage).bands);
  const on = new Set<CharBand>();
  const add = (b: CharBand, has: boolean) => {
    if (has && allowed.has(b)) on.add(b);
  };
  add('strokeOrder', true);
  add('words', e.words.length > 0);
  add('sentence', Boolean(e.sent));
  add('parts', hasParts(e));
  add('origin', Boolean(etymologyText(e)));
  add('confusables', e.conf.length > 0);
  return on;
}

export interface CharPlan {
  keep: Set<CharBand>;
  /** sections that did not fit even so, named for the editor */
  dropped: string[];
  /** sections in the left column, in reading order */
  left: CharBand[];
  /** and the rest, continuing in the right */
  right: CharBand[];
  infoH: number;
  used: number;
}

const reserveFor = (o: SheetOptions) => minCellFor(o.squareSize) + 2;

export function charPlan(e: CharacterEntry, o: SheetOptions, slot: number): CharPlan {
  const S = charScale(o.perPage);
  const h = blockHeights(e, o);
  const keep = available(e, o);
  const dropped: CharBand[] = [];

  const stack = (ids: CharBand[]) =>
    ids.reduce((n, id) => n + h[id], 0) + Math.max(0, ids.length - 1) * S.blockGap;

  /** Break the sequence wherever it leaves the two columns most even. */
  const split = () => {
    const on = ORDER.filter((id) => keep.has(id));
    let best = { left: on, right: [] as CharBand[], zone: Infinity };
    for (let k = 0; k <= on.length; k++) {
      const left = on.slice(0, k);
      const right = on.slice(k);
      const zone = Math.max(stack(left), stack(right));
      if (zone < best.zone) best = { left, right, zone };
    }
    return best;
  };

  let cut = split();
  const total = () => S.headH + (cut.zone > 0 ? cut.zone + S.gridGap : 0);

  // The profile should already have made everything fit; this is the safety
  // net for the rare character whose components run four deep.
  while (total() + reserveFor(o) > slot) {
    const victim = DROP_ORDER.find((id) => keep.has(id));
    if (!victim) break;
    keep.delete(victim);
    dropped.push(victim);
    cut = split();
  }

  return {
    keep,
    dropped: dropped.map((d) => BAND_NAME[d]),
    left: cut.left,
    right: cut.right,
    infoH: cut.zone,
    used: total(),
  };
}

export function charInfoHeight(e: CharacterEntry, o: SheetOptions, slot = Infinity) {
  return charPlan(e, o, slot).used;
}

// --------------------------------------------------------------- drawing

export function drawCharBlock(
  s: Sheet,
  e: CharacterEntry,
  o: SheetOptions,
  ctx: CharBlockCtx,
  top: number,
  height: number,
) {
  const S = charScale(o.perPage);
  const p = profileFor(o.perPage);
  const x0 = contentLeft;
  const x1 = contentLeft + contentWidth;
  const plan = charPlan(e, o, height);
  const { keep } = plan;
  const H = blockHeights(e, o);

  // ---------------------------------------------------------------- heading
  // The band is the heading zone: glyph, reading, definition and the line of
  // facts, with air above and 7pt below so it stops clear of the first section
  // label. Ending it between the definition and the facts, as it used to, made
  // the block look broken in two.
  s.headBand(x0 - 7, top - 6, contentWidth + 14, S.headH - 1);
  s.headBox(x0, top, S.box, o.gridStyle);
  s.glyph(e.c, x0, top, S.box, { color: s.c.ink, groups: true, inset: 0.1 });

  const tx = x0 + S.box + S.boxGap;
  const tag = `${e.i} · HSK ${e.hsk}`;
  const tagW = s.measure(tag, T.micro, false, 0.3);
  s.textRight(tag, x1, top + S.pyY, {
    size: T.micro,
    color: s.st.accentFurniture ? s.c.accent : s.c.ink3,
    tracking: 0.3,
  });

  const pyW = s.text(e.py.join(' / '), tx, top + S.pyY, {
    size: S.hero,
    color: s.st.accentReading ? s.c.accent : s.c.ink,
  });

  if (S.defInline) {
    s.text(e.def, tx + pyW + 12, top + S.defY, {
      size: S.lead,
      maxWidth: x1 - tx - pyW - tagW - 26,
    });
  } else {
    s.text(e.def, tx, top + S.defY, { size: S.lead, maxWidth: x1 - tx - 6 });
  }

  s.line(tx, top + S.ruleY, x1, top + S.ruleY, { width: 0.4, color: s.c.hair });

  // One quiet line of facts, separated by middots. Three all-caps labels here
  // shouted louder than the character did.
  // The radical is named only when the page shows it nowhere else. It is the
  // character itself 5% of the time, and one of the parts listed under "built
  // from" 86% of the time — in both cases repeating it here is noise, and
  // unlabelled it is a mystery glyph. Where it does appear it is spelled out.
  const radicalShownInParts = keep.has('parts') && e.parts.includes(e.rad ?? '');
  const facts: string[] = [];
  if (e.rad && e.rad !== e.c && !radicalShownInParts) {
    const gloss = partGloss(ctx.components, e, e.rad);
    facts.push(`radical ${e.rad}${gloss ? ` ${firstSense(gloss)}` : ''}`);
  }
  if (e.sc) facts.push(`${e.sc} stroke${e.sc === 1 ? '' : 's'}`);
  if (e.trad) facts.push(`${e.trad} traditional`);
  if (e.freq < 6000) facts.push(`#${e.freq} most common`);
  s.text(facts.join('   ·   '), tx, top + S.factY, {
    size: S.body,
    color: s.c.ink2,
    maxWidth: x1 - tx - 6,
  });

  let y = top + S.headH;

  // ------------------------------------------------------------- info zone
  // Each section draws into a column of `w` at (x, y) and reports nothing: the
  // plan already knows how tall it is. That is what lets the same section sit
  // in either column.
  const draw: Record<CharBand, (x: number, y: number, w: number) => void> = {
    strokeOrder: (x, yy, w) => {
      s.label('STROKE ORDER', x, yy, w);
      const n = s.strokeCount(e.c);
      const size = S.soBox;
      const perRow = Math.max(1, Math.floor(w / (size + 3)));
      const shown = Math.min(n, perRow * 2);
      const step = n <= shown ? 1 : Math.ceil(n / shown);
      const frames: number[] = [];
      for (let i = step - 1; i < n; i += step) frames.push(i + 1);
      if (frames[frames.length - 1] !== n) frames.push(n);

      frames.slice(0, perRow * 2).forEach((upto, i) => {
        const bx = x + (i % perRow) * (size + 3);
        const by = yy + S.labelDrop - 4 + Math.floor(i / perRow) * (size + 4);
        if (s.st.soFrames) {
          s.rect(bx, by, size, size, { border: s.c.hair, borderWidth: 0.35 });
        }
        s.glyph(e.c, bx, by, size, {
          upto,
          color: s.c.trace,
          highlight: s.c.accent,
          groups: true,
          inset: 0.1,
        });
      });
    },

    parts: (x, yy, w) => {
      s.label('BUILT FROM', x, yy, w, e.ids ? IDC_NAME[e.ids[0]] : undefined);
      const parts = e.parts.slice(0, p.maxParts);

      if (p.inlineParts) {
        // Four characters to a page: the components go on one line, reading
        // beside glyph, and the meanings go. They are a reminder of what the
        // character is made of, not a lesson in each part.
        let cx = x;
        for (const part of parts) {
          if (cx > x + w - 40) break;
          cx += s.glyphOrText(part, cx, yy + S.labelDrop - 8, S.partGlyph, s.c.ink) + 3;
          const g = ctx.components[part];
          // 阝 is a hill on the left and a city on the right; 王 on the left is jade.
          if (g?.py) {
            cx +=
              s.text(g.py, cx, yy + S.labelDrop - 8 + S.partGlyph * 0.76, {
                size: S.small,
                color: s.c.ink2,
                maxWidth: Math.max(20, x + w - cx),
              }) + 12;
          }
        }
        return;
      }

      const pyCol = x + S.partGlyph + 10;
      const glossCol = pyCol + 36;
      parts.forEach((part, i) => {
        const gy = yy + S.labelDrop - 4 + i * S.partRow;
        s.glyphOrText(part, x, gy, S.partGlyph, s.c.ink);
        const g = ctx.components[part];
        // Centred on the glyph's own middle rather than sat on its foot: the
        // reading and the gloss belong to the character beside them, and a
        // shared centre line is what says so.
        const base = gy + S.partGlyph / 2 + S.small * 0.35;
        if (g?.py) {
          s.text(g.py, pyCol, base, {
            size: S.small,
            color: s.st.accentReading ? s.c.accent : s.c.ink2,
          });
        }
        const gloss = partGloss(ctx.components, e, part);
        if (gloss) {
          s.text(firstSense(gloss), glossCol, base, {
            size: S.small,
            color: s.c.ink2,
            maxWidth: x + w - glossCol,
          });
        }
      });
    },

    origin: (x, yy, w) => {
      s.label('WHERE IT COMES FROM', x, yy, w);
      const lh = S.body * 1.36;
      const text = etymologyText(e);
      const box = { size: S.body, lineHeight: lh, maxLines: 3 } as const;
      // Measure, mark, then draw: the mark is a background in some designs.
      const used = s.paragraph(text, x + 10, yy + S.labelDrop, w - 12, {
        ...box,
        dry: true,
      });
      s.note(x, yy + S.labelDrop - S.body, w, used - lh + S.body + 3, yy);
      s.paragraph(text, x + 10, yy + S.labelDrop, w - 12, { ...box, color: s.c.ink });
    },

    words: (x, yy, w) => {
      s.label('COMMON WORDS', x, yy, w);
      const glossCol = x + (S.defInline ? 44 : 50);
      e.words.slice(0, p.maxWords).forEach((word, i) => {
        const py = yy + S.labelDrop + i * S.wordRow;
        const base = py + S.lead + 3;
        s.text(word.p, x + 0.5, py, {
          size: S.small,
          color: s.st.accentReading ? s.c.accent : s.c.ink2,
          maxWidth: w,
        });
        s.text(word.w, x, base, { size: S.lead + 1.4 });
        s.text(word.d, glossCol, base - 0.5, {
          size: S.small,
          color: s.c.ink2,
          maxWidth: x + w - glossCol,
        });
      });
    },

    sentence: (x, yy, w) => {
      if (!e.sent) return;
      s.label('IN A SENTENCE', x, yy, w);
      const py = yy + S.labelDrop;
      if (e.sent.py) {
        s.text(e.sent.py, x + 0.5, py, {
          size: S.small,
          color: s.st.accentReading ? s.c.accent : s.c.ink2,
          maxWidth: w,
        });
      }
      const zhBase = py + S.lead + 3;
      s.text(e.sent.zh, x, zhBase, { size: S.lead, maxWidth: w });
      s.text(e.sent.en, x, zhBase + S.small * 1.5, {
        size: S.small,
        color: s.c.ink2,
        maxWidth: w,
      });
    },

    confusables: (x, yy, w) => {
      s.label("DON'T CONFUSE WITH", x, yy, w);
      let cx = x;
      const cy = yy + S.labelDrop - 9;
      for (const d of e.conf) {
        if (cx > x + w - 44) break;
        cx += s.glyphOrText(d, cx, cy, S.partGlyph, s.c.ink) + 3;
        const g = ctx.components[d];
        if (g?.py) {
          cx +=
            s.text(g.py, cx, cy + S.partGlyph * 0.76, {
              size: S.small,
              color: s.c.ink2,
              maxWidth: Math.max(20, x + w - cx),
            }) + 13;
        }
      }
    },
  };

  const cw = colWidth();
  const pour = (ids: CharBand[], x: number) => {
    let cy = y;
    for (const id of ids) {
      draw[id](x, cy, cw);
      cy += H[id] + S.blockGap;
    }
  };
  pour(plan.left, x0);
  pour(plan.right, x0 + cw + COL_GAP);

  y += plan.infoH > 0 ? plan.infoH + S.gridGap : 0;

  // --------------------------------------------------------------- practice
  const { cols, rows, cell } = gridFit(
    contentWidth,
    top + height - y,
    o.practiceRows,
    minCellFor(o.squareSize),
  );
  if (rows < 1) return;

  const gw = cols * cell;
  const left = x0 + (contentWidth - gw) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = left + c * cell;
      const cy = y + r * cell;
      s.cell(cx, cy, cell, o.gridStyle);
      if (r === 0) {
        if (c < o.traceCount) {
          s.glyph(e.c, cx, cy, cell, { color: s.c.trace, inset: 0.12 });
        } else if (c < o.traceCount + o.fadeCount) {
          s.glyph(e.c, cx, cy, cell, { color: s.c.fade, inset: 0.12 });
        }
      }
    }
  }
  // A slightly firmer frame around the whole writing area holds it together.
  if (s.st.gridFrame) {
    s.rect(left, y, gw, rows * cell, {
      border: s.c.grid,
      borderWidth: s.st.frameWeight,
    });
  }
}
