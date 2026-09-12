import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { RadicalEntry } from '../../data/radicals';
import { DEFAULT_RADICAL_SHEET, RADICAL_PER_PAGE } from '../../domain/radicals/sheet';
import type { SquareSize } from '../../domain/sheet';
import { slotHeight } from '../layout/page';
import { radicalPlan } from './block';

/**
 * The radical block has to fit, and every way of writing a radical has to get
 * squares. Both are arithmetic, so they are checked here against the real data
 * rather than by looking at a hundred pages.
 */

const radicals: RadicalEntry[] = JSON.parse(
  readFileSync(new URL('../../../public/data/radicals.json', import.meta.url), 'utf8'),
).items;

const SIZES: SquareSize[] = ['large', 'medium', 'small'];

describe('the radical block', () => {
  it('never asks for more room than the page gives it', () => {
    for (const perPage of RADICAL_PER_PAGE) {
      const slot = slotHeight(perPage);
      for (const squareSize of SIZES) {
        for (const r of radicals) {
          const plan = radicalPlan(r, { ...DEFAULT_RADICAL_SHEET, perPage, squareSize }, slot);
          assert.ok(
            plan.used <= slot + 0.5,
            `${r.r} at ${perPage} a page, ${squareSize} squares: ${plan.used.toFixed(1)}pt in a ${slot.toFixed(1)}pt slot`,
          );
        }
      }
    }
  });

  it('gives every form squares of its own, whatever the size', () => {
    for (const perPage of RADICAL_PER_PAGE) {
      const slot = slotHeight(perPage);
      for (const r of radicals) {
        const plan = radicalPlan(r, { ...DEFAULT_RADICAL_SHEET, perPage }, slot);
        const drawn = plan.rows.flatMap((row) => row.forms);
        assert.deepEqual(
          drawn.map((f) => f.k),
          r.forms.map((f) => f.k),
          `${r.r} at ${perPage} a page shows ${drawn.length} of its ${r.forms.length} forms`,
        );
        for (const row of plan.rows) {
          assert.equal(row.cells.length, row.forms.length);
          assert.equal(
            row.cells.reduce((a, b) => a + b, 0),
            plan.cols,
            `${r.r}: a row of ${plan.cols} squares split into ${row.cells.join('+')}`,
          );
          assert.ok(Math.min(...row.cells) >= 2, `${r.r}: a form with ${Math.min(...row.cells)} squares`);
        }
      }
    }
  });

  it('gives the two commonest forms a row each at three per page', () => {
    const slot = slotHeight(3);
    const heart = radicals.find((r) => r.n === 61)!;
    const plan = radicalPlan(heart, { ...DEFAULT_RADICAL_SHEET, perPage: 3 }, slot);
    assert.equal(plan.rows.length, 2);
    assert.deepEqual(plan.rows[0].forms.map((f) => f.g), ['忄']);
    // 心 and the rare ⺗ share the second row rather than pushing 忄 off the page.
    assert.deepEqual(plan.rows[1].forms.map((f) => f.g), ['心', '⺗']);
  });

  it('still prints a row of squares when only a heading fits', () => {
    const heart = radicals.find((r) => r.n === 61)!;
    const plan = radicalPlan(heart, { ...DEFAULT_RADICAL_SHEET, perPage: 6, practiceRows: 1 }, slotHeight(6));
    assert.equal(plan.rows.length, 1);
    assert.equal(plan.rows[0].forms.length, 3);
    assert.ok(plan.cols >= 8);
  });
});
