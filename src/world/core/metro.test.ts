import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allStations, AT, labelBox, linePoints, ROUTES, type Box } from './metro';
import { LINES } from './travel';

/** grid units per screen pixel on the iPad (the diagram fit into ~1000 px) */
const PX = 1 / 34;
const GAME = new Set(['nanluoguxiang', 'shichahai', 'beihaibei', 'tiananmendong', 'wangfujing', 'qianmen', 'tiantandongmen', 'yonghegong', 'tuanjiehu', 'guomao', 'aolinpikegongyuan', 'panjiayuan', 'xizhimen', 'yiheyuan', 'badalingchangcheng', 'beijingbeizhan']);
const fsOf = (s: string) => (GAME.has(s) ? 13 : 10.5) * PX;
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('the metro diagram', () => {
  it('places every station of every line, and every line runs its real stops in order', () => {
    for (const s of allStations()) assert.ok(AT[s], `${s} has no place`);
    for (const l of LINES) {
      const r = ROUTES[l.id];
      assert.ok(r, `${l.id} is not drawn`);
      const stops = r!.filter((x): x is string => typeof x === 'string');
      const want = l.loop ? [...l.stops, l.stops[0]!] : l.stops;
      assert.deepEqual(stops, want, l.id);
    }
  });

  it('draws only across, down and at 45°', () => {
    for (const id of Object.keys(ROUTES)) {
      const p = linePoints(id);
      for (let i = 1; i < p.length; i++) {
        const dx = Math.abs(p[i]![0] - p[i - 1]![0]);
        const dy = Math.abs(p[i]![1] - p[i - 1]![1]);
        assert.ok(dx < 1e-9 || dy < 1e-9 || Math.abs(dx - dy) < 1e-9, `${id}: ${p[i - 1]} → ${p[i]}`);
      }
    }
  });

  it('keeps every name clear of the other names and of the stations', () => {
    const ids = Object.keys(AT);
    const boxes = ids.map((s) => ({ s, b: labelBox(s, fsOf(s)) }));
    for (const a of boxes)
      for (const b of boxes) if (a.s < b.s) assert.ok(!hit(a.b, b.b), `${a.s} and ${b.s} overlap`);
    const dot = 5 * PX;
    for (const { s, b } of boxes)
      for (const t of ids) {
        if (t === s) continue;
        const [x, y] = AT[t]!;
        assert.ok(!hit(b, { x: x - dot, y: y - dot, w: dot * 2, h: dot * 2 }), `the name of ${s} covers ${t}`);
      }
  });
});
