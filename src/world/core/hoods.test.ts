import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { heroOnPlan, HOODS, hoodOf, type HoodLayout } from './hoods';
import { walkPath, type MapLinks } from './places';

const index = JSON.parse(readFileSync('public/world/maps/index.json', 'utf8')) as MapLinks;
const plans = JSON.parse(readFileSync('public/world/maps/hoods.json', 'utf8')) as HoodLayout[];
const real = Object.keys(index).filter((m) => !m.endsWith('-proto'));

type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('neighbourhoods', () => {
  it('hold every map of the game exactly once', () => {
    for (const m of real) assert.ok(hoodOf(m), `${m} is in no neighbourhood`);
    const all = HOODS.flatMap((h) => h.maps);
    assert.equal(new Set(all).size, all.length);
    for (const m of all) assert.ok(index[m], `${m} is not a map`);
  });

  it('hang together on foot, each around its station', () => {
    for (const h of HOODS) {
      const sub: MapLinks = Object.fromEntries(h.maps.map((m) => [m, { ...index[m]!, links: (index[m]!.links ?? []).filter((l) => h.maps.includes(l)) }]));
      for (const m of h.maps) assert.ok(walkPath(sub, h.maps[0]!, m), `${h.id}: no way on foot from ${h.maps[0]} to ${m}`);
    }
  });

  it('are laid out with every map on the plan and nothing on top of anything', () => {
    assert.equal(plans.length, HOODS.length);
    for (const p of plans) {
      const h = HOODS.find((x) => x.id === p.id)!;
      const drawn = [...p.areas, ...p.rooms];
      assert.deepEqual(drawn.map((d) => d.map).sort(), [...h.maps].sort(), p.id);
      for (const a of drawn) for (const b of drawn) if (a !== b) assert.ok(!overlap(a, b), `${p.id}: ${a.map} lies on ${b.map}`);
    }
  });

  it('have a miniature for every map (npm run world:minis)', () => {
    for (const m of real) assert.ok(existsSync(`public/world/minis/${m}.png`), `no miniature of ${m}`);
  });

  it('put the hero where he stands', () => {
    const p = plans.find((x) => x.id === 'nanluoguxiang')!;
    const street = p.areas.find((a) => a.map === 'nanluo-main')!;
    assert.deepEqual(heroOnPlan(p, 'nanluo-main', [3, 4]), [street.x + 3.5, street.y + 4.5]);
    const room = p.rooms.find((r) => r.map === 'chaguan')!;
    assert.deepEqual(heroOnPlan(p, 'chaguan', [1, 1]), [room.x + room.w / 2, room.y + room.h / 2]);
    // the teahouse card sits by its door on 南锣鼓巷
    assert.ok(Math.abs(room.door[0] - (street.x + 44)) < 1 && room.door[1] === street.y + 5);
  });

  it('show the ways on foot into the next neighbourhood', () => {
    const p = plans.find((x) => x.id === 'nanluoguxiang')!;
    assert.ok(p.exits.some((e) => e.hood === 'shichahai' && e.map === 'gulou-square'));
  });
});

describe('the way there', () => {
  it('walks when it can, else rides from this neighbourhood\'s station to that one\'s', async () => {
    const { wayThere } = await import('./hoods');
    const { newSave } = await import('./save');
    const s = { ...newSave('t', 0), place: { map: 'nanluo-main', tile: [3, 8] as [number, number], facing: 'down' as const } };
    assert.deepEqual(wayThere(s, 'chaguan', index), { kind: 'walk', path: ['nanluo-main', 'chaguan'] });
    const w = wayThere(s, 'bianlidian', index);
    // 国贸 is not 团结湖: the ride ends at 国贸 and the walk starts there
    assert.ok(w.kind === 'ride' && w.from === 'nanluoguxiang' && w.to === 'guomao' && w.then?.at(-1) === 'bianlidian', JSON.stringify(w));
  });
});
