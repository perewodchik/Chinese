import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { merge } from './merge';
import { apply, newSave, type SaveAction } from './save';
import type { Quest, WorldSave } from './types';

/** A small seeded generator, so a failing case can be replayed. */
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 2 ** 32;
  };
}

const quest: Quest = { id: 'q', title: 'Q', chapter: 1, kind: 'main', steps: ['a', 'b', 'c', 'd'].map((id) => ({ id, now: id, past: '' })) };
const quests = new Map([[quest.id, quest]]);

function randomSave(seed: number, device: string): WorldSave {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  let s = newSave('start', 0);
  let now = 0;
  for (let i = 0; i < 30; i++) {
    now += 1 + Math.floor(r() * 5);
    const a: SaveAction = pick<() => SaveAction>([
      () => ({ do: 'flag', flag: pick(['f1', 'f2', 'f3', 'f4']) }),
      () => ({ do: 'scene_done', scene: pick(['s1', 's2', 's3']) }),
      () => ({ do: 'spirit', spirit: pick(['lion', 'fox', 'dragon']) }),
      () => ({ do: 'idiom', idiom: pick(['马马虎虎', '一心一意']) }),
      () => ({ do: 'stamp', stamp: pick(['st1', 'st2', 'st3']) }),
      () => ({ do: 'station', station: pick(['nlgx', 'tamd', 'gl']) }),
      () => ({ do: 'district', district: pick(['gulou', 'tiananmen', 'houhai']) }),
      () => ({ do: 'quest', quest: 'q', step: pick(['a', 'b', 'c', 'd']) }),
      () => ({ do: 'pin', riddle: pick(['r1', 'r2']) }),
      () => ({ do: 'solve', riddle: pick(['r1', 'r2']) }),
      () => ({ do: 'remember', npc: pick(['wang', 'li']), note: pick(['n1', 'n2', 'n3']) }),
      () => ({ do: 'ride', route: pick(['x>y', 'y>z']) }),
      () => ({ do: 'give', item: pick(['baozi', 'tea']) }),
      () => ({ do: 'move', tile: [Math.floor(r() * 9), Math.floor(r() * 9)], facing: 'up' }),
      () => ({ do: 'tick', minutes: s.clock + Math.floor(r() * 60) }),
      () => ({ do: 'chapter', chapter: 1 + Math.floor(r() * 3) }),
    ])();
    s = apply(s, a, { now, deviceId: device, quests });
  }
  return s;
}

const pairs = Array.from({ length: 60 }, (_, i) => [randomSave(i * 2 + 1, 'ipad'), randomSave(i * 2 + 2, 'mac')] as const);

describe('merge', () => {
  it('is commutative', () => {
    for (const [a, b] of pairs) assert.deepEqual(merge(a, b), merge(b, a));
  });

  it('is idempotent', () => {
    for (const [a] of pairs) assert.deepEqual(merge(a, a), merge(merge(a, a), a));
  });

  it('never loses a spirit, idiom, stamp, flag, scene or station', () => {
    for (const [a, b] of pairs) {
      const m = merge(a, b);
      for (const s of [a, b]) {
        for (const k of Object.keys(s.spirits)) assert.ok(k in m.spirits);
        for (const k of Object.keys(s.idioms)) assert.ok(k in m.idioms);
        for (const k of Object.keys(s.stamps)) assert.ok(k in m.stamps);
        for (const f of s.flags) assert.ok(m.flags.includes(f));
        for (const f of s.scenes) assert.ok(m.scenes.includes(f));
        for (const f of s.stations) assert.ok(m.stations.includes(f));
        for (const f of s.districts) assert.ok(m.districts.includes(f));
        for (const [k, r] of Object.entries(s.riddles)) if (r.solved) assert.equal(m.riddles[k].solved, true);
        for (const [k, n] of Object.entries(s.npcs)) for (const note of n.notes) assert.ok(m.npcs[k].notes.includes(note));
        assert.ok(m.chapter >= s.chapter);
      }
    }
  });

  it('keeps the further quest step', () => {
    for (const [a, b] of pairs) {
      const m = merge(a, b);
      for (const s of [a, b]) {
        const q = s.quests.q;
        if (q) assert.ok(m.quests.q.index >= q.index || m.quests.q.done);
      }
    }
  });

  it('takes place, clock and bag from the later save', () => {
    const a = apply(newSave('ipad', 0), { do: 'move', tile: [1, 1], facing: 'up' }, { now: 10 });
    const b = apply(
      apply(newSave('mac', 0), { do: 'give', item: 'tea' }, { now: 20, deviceId: 'mac' }),
      { do: 'tick', minutes: 900 },
      { now: 20, deviceId: 'mac' },
    );
    const m = merge(a, b);
    assert.deepEqual(m.place, b.place);
    assert.equal(m.clock, 900);
    assert.deepEqual(m.bag.items, { tea: 1 });
    assert.equal(m.updatedAt, 20);
    assert.equal(m.deviceId, 'mac');
  });

  it('remembers when a spirit was found first', () => {
    const a = { ...newSave('a', 5), spirits: { lion: 700 } };
    const b = { ...newSave('b', 9), spirits: { lion: 500, fox: 900 } };
    assert.deepEqual(merge(a, b).spirits, { fox: 900, lion: 500 });
  });
});
