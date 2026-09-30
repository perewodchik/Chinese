import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { heroOnPlan, HOODS, hoodOf, type HoodLayout } from './hoods';
import { walkPath, type MapLinks } from './places';
import { checkStamps } from '../../../scripts/world/stamps';

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

  it('have miniatures the shape of their maps, so none is drawn stretched (M8)', () => {
    const size = (m: string) => {
      const b = readFileSync(`public/world/minis/${m}.png`);
      return [b.readUInt32BE(16), b.readUInt32BE(20)];
    };
    for (const p of plans) for (const a of p.areas) assert.deepEqual(size(a.map), [a.w * 4, a.h * 4], `${a.map}: its miniature is not its map's shape — run npm run world:minis`);
  });

  it('load the plans and miniatures by a build stamp that matches the files (M8)', () => {
    assert.equal(checkStamps(), null);
  });

  it('put each room card by its door, with a gap between cards (M8)', () => {
    for (const p of plans) {
      for (const r of p.rooms) {
        const [dx, dy] = [r.door[0] + 0.5, r.door[1] + 0.5];
        const gap = Math.hypot(Math.max(r.x - dx, 0, dx - (r.x + r.w)), Math.max(r.y - dy, 0, dy - (r.y + r.h)));
        // a door deep in a courtyard can only have its card outside the courtyard
        const a = p.areas.find((x) => x.x <= dx && dx <= x.x + x.w && x.y <= dy && dy <= x.y + x.h);
        const depth = a ? Math.min(dx - a.x, a.x + a.w - dx, dy - a.y, a.y + a.h - dy) : 0;
        assert.ok(gap <= 9 + depth, `${p.id}: ${r.map}'s card is ${gap.toFixed(1)} tiles from its door`);
        for (const o of p.rooms) if (o !== r) assert.ok(!overlap({ x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }, o), `${p.id}: ${r.map}'s card touches ${o.map}'s`);
      }
    }
    // the learner's 南锣鼓巷: 理发店 level with its door at row 19, not stacked under 早点铺; 我的房间 near its door
    const p = plans.find((x) => x.id === 'nanluoguxiang')!;
    const street = p.areas.find((a) => a.map === 'nanluo-main')!;
    const barber = p.rooms.find((r) => r.map === 'lifadian')!;
    assert.ok(barber.y <= street.y + 19 && street.y + 19 < barber.y + barber.h, 'the barber card is level with its door');
    const room = p.rooms.find((r) => r.map === 'siheyuan-room')!;
    assert.ok(Math.hypot(room.x + room.w / 2 - room.door[0], room.y + room.h / 2 - room.door[1]) < 12, 'my room is near its door');
  });

  it('mark where one street runs on into the next (M8)', () => {
    const p = plans.find((x) => x.id === 'nanluoguxiang')!;
    for (const b of ['gulou-dongdajie', 'subway-lane', 'hutong-home']) assert.ok(p.joins.some((j) => (j.a === 'nanluo-main' && j.b === b) || (j.b === 'nanluo-main' && j.a === b)), `no crossing of 南锣鼓巷 and ${b}`);
    assert.ok(p.doors.some((d) => d.to === 'station-nanluoguxiang'), 'the station has its way in');
  });

  it('mark every way into another place: doors, street ends, other neighbourhoods (M7)', () => {
    for (const p of plans) {
      const h = HOODS.find((x) => x.id === p.id)!;
      for (const a of p.areas) {
        for (const to of index[a.map]!.links ?? []) {
          if (to === a.map) continue;
          const other = hoodOf(to);
          if (other && other.id !== h.id) {
            assert.ok(p.exits.some((e) => e.map === a.map && e.hood === other.id), `${p.id}: no arrow from ${a.map} to ${other.id}`);
            continue;
          }
          const door = p.doors.some((d) => d.from === a.map && d.to === to) || p.doors.some((d) => d.from === to && d.to === a.map);
          const join = p.joins.some((j) => (j.a === a.map && j.b === to) || (j.b === a.map && j.a === to));
          assert.ok(door || join, `${p.id}: the way from ${a.map} to ${to} is not marked`);
        }
      }
      // every room with a door on a street has its door mark (a room inside a room hangs off that room's card)
      for (const r of p.rooms) {
        const onStreet = p.areas.some((a) => (index[a.map]!.links ?? []).includes(r.map));
        if (onStreet) assert.ok(p.doors.some((d) => d.to === r.map), `${p.id}: ${r.map} has no door mark`);
        else assert.ok(p.rooms.some((o) => o !== r && (index[o.map]!.links ?? []).includes(r.map)), `${p.id}: ${r.map} hangs off nothing`);
      }
    }
  });

  it('put the hero where he stands', () => {
    const p = plans.find((x) => x.id === 'nanluoguxiang')!;
    const street = p.areas.find((a) => a.map === 'nanluo-main')!;
    assert.deepEqual(heroOnPlan(p, 'nanluo-main', [3, 4]), [street.x + 3.5, street.y + 4.5]);
    const room = p.rooms.find((r) => r.map === 'chaguan')!;
    assert.deepEqual(heroOnPlan(p, 'chaguan', [1, 1]), [room.x + room.w / 2, room.y + room.h / 2]);
    // the teahouse card sits by its door on 南锣鼓巷's east side (§13 T1: the lane runs north–south)
    assert.ok(Math.abs(room.door[0] - (street.x + 15)) < 1 && room.door[1] === street.y + 14);
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
