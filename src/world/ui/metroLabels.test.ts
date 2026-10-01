import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AT, extent } from '../core/metro';
import { circleBoxes, lineBoxes, placeLabels, zoomLevel, type LabelWant } from './metroLabels';

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('metro map names (learner, iPhone 2026-09-30)', () => {
  const e = extent();
  const all = Object.keys(AT);

  it('never overlap each other or run off the screen, at any zoom', () => {
    // a phone's box across the whole diagram (names big for the space), and closer in
    for (const [view, fs] of [
      [{ x: e.x - 2, y: e.y - 1, w: e.w + 4, h: e.h + 2 }, 0.9],
      [{ x: -2, y: -2, w: 10, h: 12 }, 0.4],
    ] as const) {
      const wants: LabelWant[] = all.map((s, i) => ({ station: s, fs, rank: i % 3, badge: i % 5 ? undefined : { w: 1.5, h: 0.5, above: 0.8 } }));
      const placed = [...placeLabels(wants, view).values()];
      assert.ok(placed.length > 0);
      const boxes = placed.flatMap((p) => [p.box, ...(p.badge ? [p.badge] : [])]);
      for (const b of boxes) assert.ok(b.x >= view.x && b.y >= view.y && b.x + b.w <= view.x + view.w + 1e-9 && b.y + b.h <= view.y + view.h + 1e-9, JSON.stringify(b));
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlap(boxes[i]!, boxes[j]!), `${JSON.stringify(boxes[i])} × ${JSON.stringify(boxes[j])}`);
    }
  });

  it('shows the most important name first when two want the same place', () => {
    const view = { x: e.x - 2, y: e.y - 1, w: e.w + 4, h: e.h + 2 };
    const wants: LabelWant[] = all.map((s) => ({ station: s, fs: 2, rank: s === 'nanluoguxiang' ? 100 : 1 }));
    assert.ok(placeLabels(wants, view).has('nanluoguxiang'));
  });
});

describe('metro map names keep off circles and lines (learner, iPhone 2026-10-01)', () => {
  const e = extent();
  const all = Object.keys(AT);
  it('no name covers a station circle or a line, at a phone zoom and closer', () => {
    for (const [view, px] of [
      [{ x: e.x - 2, y: e.y - 1, w: e.w + 4, h: e.h + 2 }, 11],
      [{ x: -2, y: -2, w: 12, h: 15 }, 30],
    ] as const) {
      const g = (n: number) => n / px;
      const obstacles = [...circleBoxes(() => g(8)), ...lineBoxes(g(4))];
      const wants: LabelWant[] = all.map((s, i) => ({ station: s, fs: g(12), rank: i % 4, gap: g(10) }));
      const placed = placeLabels(wants, view, obstacles);
      assert.ok(placed.size >= 15, `only ${placed.size} names placed`);
      for (const p of placed.values()) for (const o of obstacles) assert.ok(!overlap(p.box, o), `${JSON.stringify(p.box)} over ${JSON.stringify(o)}`);
    }
  });
  it('where you are gets its name even among the lines, never over a circle', () => {
    const px = 11;
    const g = (n: number) => n / px;
    const view = { x: e.x - 2, y: e.y - 1, w: e.w + 4, h: e.h + 2 };
    const circles = circleBoxes(() => g(8));
    const placed = placeLabels([{ station: 'nanluoguxiang', fs: g(12), rank: 100, gap: g(10), key: true }], view, circles, lineBoxes(g(4)));
    const p = placed.get('nanluoguxiang');
    assert.ok(p);
    for (const o of circles) assert.ok(!overlap(p.box, o));
  });
  it('fully out shows few names; closer in, more', () => {
    assert.equal(zoomLevel(11), 0);
    assert.equal(zoomLevel(20), 1);
    assert.equal(zoomLevel(40), 2);
  });
});
