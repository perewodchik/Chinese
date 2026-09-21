import type { RadicalEntry, RadicalForm } from '../../data/radicals';
import { POSITION_LABEL } from '../../domain/radicals/forms';
import { radicalProfile, type RadicalProfile, type RadicalSheet } from '../../domain/radicals/sheet';
import type { Sheet } from '../draw';
import { gridFit, minCellFor } from '../layout/grid';
import { contentLeft, contentWidth } from '../layout/page';
import { LABEL_TRACKING, T } from '../theme';
import { radicalScale, type RadicalScale } from './scale';

/**
 * The radical block: a heading, then one practice row for every way the
 * radical is written, each row opened by a line naming that form.
 *
 * What the block before it got wrong was the whole reason to print a radical
 * sheet. 心 is written 忄 down the left of 快, flat and wide under 想, and ⺗
 * under 恭 — and a sheet with 忄 in every square teaches a third of the radical
 * while the other two thirds go on looking like different radicals.
 *
 * Each form is drawn from the outline of a real character, cut out at build
 * time (scripts/build_radicals.py), so a square asks for it at the size and in
 * the place it truly has: 忄 a narrow strip down the left of the square, 心 low
 * and wide across the foot of it.
 */

/** One row of squares, and the forms that share it. */
export interface RadicalRow {
  forms: RadicalForm[];
  /** how many squares each of them gets, left to right */
  cells: number[];
  /** whether there is room under the line for how this form differs */
  tip: boolean;
}

export interface RadicalPlan {
  cols: number;
  cell: number;
  rows: RadicalRow[];
  /** rows of empty squares under those */
  free: number;
  /** breathing room between one form's squares and the next form's line */
  gap: number;
  note: boolean;
  facts: boolean;
  formLines: boolean;
  /** true when forms had to share a row */
  shared: boolean;
  /** the height the block takes */
  used: number;
}

const COUNT_WORD: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' };

/** Squares split between the forms sharing a row; the earlier ones take the remainder. */
function share(cols: number, parts: number): number[] {
  const base = Math.floor(cols / parts);
  let extra = cols - base * parts;
  return Array.from({ length: parts }, () => base + (extra-- > 0 ? 1 : 0));
}

export function radicalPlan(r: RadicalEntry, o: RadicalSheet, slot: number): RadicalPlan {
  const S = radicalScale(o.perPage);
  const p = radicalProfile(o.perPage);
  const note = p.note && Boolean(r.note);
  const above = S.headH + (note ? S.noteH : 0) + S.gridGap;

  const minCell = Math.max(30, minCellFor(o.squareSize) - 4);
  const room = Math.max(minCell, slot - above);
  const { cols, cell } = gridFit(contentWidth, room, 99, minCell, 48);

  const lineH = p.formLines ? S.lineH : 0;
  const tipH = (f: RadicalForm) => (p.formLines && p.tips && f.tip ? S.tipH : 0);
  // The reference sheet asks for a row per shape; a designed sheet asks for a
  // number of rows and lets the shapes share them.
  const wanted = o.rowPerForm ? r.forms.length : Math.max(1, o.practiceRows);

  const rows: RadicalRow[] = [];
  let left = room;
  for (const form of r.forms) {
    const h = lineH + tipH(form) + cell;
    if (rows.length >= wanted || h > left) break;
    rows.push({ forms: [form], cells: [], tip: tipH(form) > 0 });
    left -= h;
  }
  if (!rows.length) {
    // Not even one line and one row fit: the row alone, every form on it.
    rows.push({ forms: [...r.forms], cells: [], tip: false });
    left = room - cell;
  } else if (rows.length < r.forms.length) {
    // Whatever is left over shares the last row, and a shared line has no room
    // for a note about how one of them is written.
    const last = rows[rows.length - 1];
    if (last.tip) {
      left += S.tipH;
      last.tip = false;
    }
    last.forms.push(...r.forms.slice(rows.length));
  }
  for (const row of rows) row.cells = share(cols, row.forms.length);

  const free = o.rowPerForm ? 0 : Math.max(0, Math.min(wanted - rows.length, Math.floor(left / cell)));
  const drawn = rows.reduce((h, row) => h + lineH + (row.tip ? S.tipH : 0) + cell, 0);

  // Each form's line sat directly on the squares of the form above it, which
  // read as one crowded block rather than as three ways of writing one radical.
  // The room for that comes out of what the slot has left over and no more, so
  // the sizes with nothing spare keep every form a row of its own rather than
  // buying air with somebody's practice.
  const gaps = p.formLines ? Math.max(0, rows.length - 1) : 0;
  const spare = Math.max(0, left - free * cell);
  const gap = gaps ? Math.min(S.rowGap, spare / gaps) : 0;

  return {
    cols,
    cell,
    rows,
    free,
    gap,
    note,
    facts: p.facts,
    formLines: p.formLines,
    shared: rows.some((row) => row.forms.length > 1),
    used: above + drawn + free * cell + gap * gaps,
  };
}

export const radicalBlockHeight = (r: RadicalEntry, o: RadicalSheet, slot = Infinity) =>
  radicalPlan(r, o, slot).used;

/* ------------------------------------------------------------------ drawing */

export function drawRadicalBlock(
  s: Sheet,
  r: RadicalEntry,
  o: RadicalSheet,
  top: number,
  height: number,
) {
  const S = radicalScale(o.perPage);
  const p = radicalProfile(o.perPage);
  const plan = radicalPlan(r, o, height);
  const x0 = contentLeft;
  const x1 = contentLeft + contentWidth;
  const main = r.forms[0];

  /* ------------------------------------------------------------- heading */
  s.headBand(x0 - 7, top - 6, contentWidth + 14, S.headH - 1);
  s.headBox(x0, top, S.box, o.gridStyle);
  s.glyph(main.k, x0, top, S.box, { color: s.c.ink, inset: 0.12, fit: true });

  const tx = x0 + S.box + S.boxGap;
  const tag = `#${r.n} · top ${r.rank}`;
  const tagW = s.measure(tag, T.micro, false, 0.3);
  s.textRight(tag, x1, top + S.nameY, {
    size: T.micro,
    color: s.st.accentFurniture ? s.c.accent : s.c.ink3,
    tracking: 0.3,
  });

  // "heart · 心 xīn · 竖心旁" — the reading belongs to the character the radical
  // is named after, which is not always the form on the sheet.
  let hx = tx;
  hx += s.text(r.mean, hx, top + S.nameY, { size: S.lead + 1.2 }) + 9;
  hx +=
    s.text(r.word === main.g ? r.py : `${r.word} ${r.py}`, hx, top + S.nameY, {
      size: S.lead,
      color: s.st.accentReading ? s.c.accent : s.c.ink,
    }) + 10;
  if (main.name) {
    hx += s.text(main.name, hx, top + S.nameY, { size: S.lead }) + 4;
    s.text(main.namePy ?? '', hx, top + S.nameY, {
      size: S.small,
      color: s.c.ink2,
      maxWidth: Math.max(16, x1 - hx - tagW - 12),
    });
  }
  s.line(tx, top + S.ruleY, x1, top + S.ruleY, { width: 0.4, color: s.c.hair });

  if (plan.facts) {
    const facts = [
      r.forms.length > 1
        ? `written ${COUNT_WORD[r.forms.length] ?? r.forms.length} ways`
        : `${main.sc} stroke${main.sc === 1 ? '' : 's'}`,
      `in ${r.syllabus} of the 3000 characters`,
      r.about ?? '',
    ].filter(Boolean);
    s.text(facts.join('   ·   '), tx, top + S.factY, {
      size: S.body,
      color: s.c.ink2,
      maxWidth: x1 - tx - 6,
    });
  }

  let y = top + S.headH;
  if (plan.note && r.note) {
    const base = y + S.noteH - 4;
    const w = s.text('DON’T CONFUSE', x0, base, {
      size: T.label,
      color: s.st.accentFurniture ? s.c.accent : s.c.ink3,
      bold: true,
      tracking: LABEL_TRACKING,
    });
    s.text(r.note, x0 + w + 9, base, {
      size: S.body,
      color: s.c.ink2,
      maxWidth: x1 - x0 - w - 9,
    });
    y += S.noteH;
  }
  y += S.gridGap;

  /* ------------------------------------------------------------- practice */
  const gw = plan.cols * plan.cell;
  const gx = x0 + (contentWidth - gw) / 2;

  plan.rows.forEach((row, i) => {
    if (i) y += plan.gap;
    if (plan.formLines) {
      let sx = gx;
      row.forms.forEach((form, i) => {
        const w = row.cells[i] * plan.cell;
        drawFormLine(s, form, sx, y, w, S, p, row.forms.length === 1, row.tip, r.forms.length === 1);
        sx += w;
      });
      y += S.lineH + (row.tip ? S.tipH : 0);
    }
    drawRow(s, row, gx, y, plan, o);
    y += plan.cell;
  });
  for (let i = 0; i < plan.free; i++) {
    drawRow(s, { forms: [], cells: [], tip: false }, gx, y, plan, o);
    y += plan.cell;
  }
}

/**
 * The line that opens a form's row: the form itself, where it goes, what it is
 * called, how many strokes, its stroke order, and characters written with it.
 *
 * Everything is measured before it is drawn and given up from the right when
 * the room runs out, so a form sharing a row keeps its glyph, its position and
 * its stroke order, and loses the examples rather than the point.
 */
function drawFormLine(
  s: Sheet,
  form: RadicalForm,
  x: number,
  y: number,
  w: number,
  S: RadicalScale,
  p: RadicalProfile,
  /** this form has the row to itself, so there is width for its full name */
  alone: boolean,
  tip: boolean,
  /** the radical is written only this one way, so "full form" would say nothing */
  solo: boolean,
) {
  const baseline = y + S.soBox * 0.76;
  const right = x + w - 4;
  let cx = x;

  s.glyph(form.k, cx, y, S.soBox, { fit: true, inset: 0.04, color: s.c.ink });
  cx += S.soBox + 7;

  if (!solo || form.pos !== 'alone') {
    cx +=
      s.text(POSITION_LABEL[form.pos].toUpperCase(), cx, baseline, {
        size: T.label,
        color: s.c.ink3,
        bold: true,
        tracking: LABEL_TRACKING,
      }) + 8;
  }

  if (form.name && cx < right - 70) {
    cx += s.text(form.name, cx, baseline, { size: S.body }) + 4;
    if (alone && form.namePy) {
      cx += s.text(form.namePy, cx, baseline, { size: S.small, color: s.c.ink2 }) + 7;
    }
  }
  if (alone && cx < right - 46) {
    cx += s.text(`${form.sc} strokes`, cx, baseline, { size: S.small, color: s.c.ink3 }) + 9;
  }

  const box = S.soBox;
  const fits = Math.max(0, Math.floor((right - cx) / (box + 2)));
  for (let i = 0; i < Math.min(form.sc, fits); i++) {
    if (s.st.soFrames) s.rect(cx, y, box, box, { border: s.c.hair, borderWidth: 0.35 });
    s.glyph(form.k, cx, y, box, {
      upto: i + 1,
      fit: true,
      inset: 0.08,
      color: s.c.trace,
      highlight: s.c.accent,
    });
    cx += box + 2;
  }
  cx += 7;

  if (p.examples !== 'none') {
    for (const e of form.ex) {
      const glyph = s.measure(e.c, S.body + 2.4);
      const py = s.measure(e.py, S.small);
      const gloss = p.examples === 'glossed' ? s.measure(e.d, S.small) + 9 : 4;
      if (cx + glyph + py + gloss + 6 > right) break;
      cx += s.text(e.c, cx, baseline, { size: S.body + 2.4 }) + 3;
      cx +=
        s.text(e.py, cx, baseline, {
          size: S.small,
          color: s.st.accentReading ? s.c.accent : s.c.ink2,
        }) + 3;
      cx +=
        p.examples === 'glossed'
          ? s.text(e.d, cx, baseline, { size: S.small, color: s.c.ink3 }) + 9
          : 4;
    }
  }

  if (tip && form.tip) {
    s.text(form.tip, x + S.soBox + 7, y + S.lineH + S.tipH - 5, {
      size: S.small,
      color: s.c.ink2,
      maxWidth: w - S.soBox - 12,
    });
  }
}

/** One row of squares: each form's own run starts with models to trace. */
function drawRow(
  s: Sheet,
  row: RadicalRow,
  x: number,
  y: number,
  plan: RadicalPlan,
  o: RadicalSheet,
) {
  if (!row.forms.length) {
    for (let i = 0; i < plan.cols; i++) s.cell(x + i * plan.cell, y, plan.cell, o.gridStyle);
  } else {
    let col = 0;
    row.forms.forEach((form, i) => {
      const n = row.cells[i];
      // Scaled to the run: a form sharing a row must not get a run of solid
      // models with nothing left to write in.
      const trace = Math.max(1, Math.min(o.traceCount, n - 2));
      const fade = Math.max(0, Math.min(o.fadeCount, n - trace - 1));
      for (let k = 0; k < n; k++) {
        const cx = x + (col + k) * plan.cell;
        s.cell(cx, y, plan.cell, o.gridStyle);
        if (k < trace) s.glyph(form.k, cx, y, plan.cell, { color: s.c.trace, inset: 0.12 });
        else if (k < trace + fade) {
          s.glyph(form.k, cx, y, plan.cell, { color: s.c.fade, inset: 0.12 });
        }
      }
      col += n;
    });
  }
  if (s.st.gridFrame) {
    s.rect(x, y, plan.cols * plan.cell, plan.cell, {
      border: s.c.grid,
      borderWidth: s.st.frameWeight,
    });
  }
}
