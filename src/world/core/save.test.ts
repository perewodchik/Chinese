import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSave } from './migrate';
import { apply, applyAll, HOME, newSave, WORLD_SAVE_VERSION, type ApplyContext } from './save';
import type { Quest } from './types';

const quest: Quest = {
  id: 'breakfast',
  title: 'Breakfast',
  chapter: 1,
  kind: 'main',
  steps: [
    { id: 'go', past: '', now: 'Go to the 早点铺.' },
    { id: 'order', past: '', now: 'Order.' },
    { id: 'pay', past: '', now: 'Pay.' },
  ],
};
const ctx: ApplyContext = { now: 2000, deviceId: 'ipad', quests: new Map([[quest.id, quest]]) };
const fresh = () => newSave('mac', 1000);

describe('apply', () => {
  it('starts at home with some money and no card', () => {
    const s = fresh();
    assert.deepEqual(s.place, HOME);
    assert.equal(s.bag.card, null);
    assert.equal(s.version, WORLD_SAVE_VERSION);
  });

  it('stamps the time and device only when something changed', () => {
    const s = fresh();
    const same = apply(s, { do: 'district', district: 'gulou' }, ctx);
    assert.equal(same, s);
    const moved = apply(s, { do: 'move', tile: [5, 4], facing: 'right' }, ctx);
    assert.equal(moved.updatedAt, 2000);
    assert.equal(moved.deviceId, 'ipad');
    assert.equal(s.place.tile[0], 4, 'the old save is untouched');
  });

  it('enters a map and records a new district', () => {
    const s = apply(fresh(), { do: 'enter', map: 'tam-square', tile: [3, 3], facing: 'up', district: 'tiananmen' }, ctx);
    assert.equal(s.place.map, 'tam-square');
    assert.equal(s.district, 'tiananmen');
    assert.deepEqual(s.districts, ['gulou', 'tiananmen']);
  });

  it('teleports, keeping the facing if none is given', () => {
    const s = apply(fresh(), { do: 'teleport', map: 'x', tile: [1, 2] }, ctx);
    assert.deepEqual(s.place, { map: 'x', tile: [1, 2], facing: 'down' });
  });

  it('sets and clears flags', () => {
    let s = apply(fresh(), { do: 'flag', flag: 'lantern_broken' }, ctx);
    s = apply(s, { do: 'flag', flag: 'lantern_broken' }, ctx);
    assert.deepEqual(s.flags, ['lantern_broken']);
    s = apply(s, { do: 'flag', flag: 'lantern_broken', value: false }, ctx);
    assert.deepEqual(s.flags, []);
  });

  it('gives and takes items, dropping empty ones', () => {
    let s = apply(fresh(), { do: 'give', item: 'baozi', count: 2 }, ctx);
    s = apply(s, { do: 'take', item: 'baozi' }, ctx);
    assert.equal(s.bag.items.baozi, 1);
    s = apply(s, { do: 'take', item: 'baozi' }, ctx);
    assert.equal('baozi' in s.bag.items, false);
  });

  it('spends money in 角 without float dust, never below zero', () => {
    let s = apply(fresh(), { do: 'money', amount: -1.1 }, ctx);
    s = apply(s, { do: 'money', amount: -2.2 }, ctx);
    assert.equal(s.bag.money, 196.7);
    s = apply(s, { do: 'money', amount: -1000 }, ctx);
    assert.equal(s.bag.money, 0);
  });

  it('buys and pays with the 交通卡', () => {
    let s = apply(fresh(), { do: 'card', amount: 20 }, ctx);
    s = apply(s, { do: 'card', amount: -3 }, ctx);
    assert.equal(s.bag.card, 17);
  });

  it('moves quests forward only, then finishes them', () => {
    let s = apply(fresh(), { do: 'quest', quest: 'breakfast', step: 'order' }, ctx);
    const t0 = s.clock;
    assert.deepEqual(s.quests.breakfast, { step: 'order', index: 1, done: false, at: { order: t0 } });
    s = apply(s, { do: 'quest', quest: 'breakfast', step: 'go' }, ctx);
    assert.equal(s.quests.breakfast.step, 'order');
    s = apply(s, { do: 'tick', minutes: t0 + 90 }, ctx);
    s = apply(s, { do: 'quest_done', quest: 'breakfast' }, ctx);
    // the journal's stamps (§10 J1): when each step was reached, and when it was finished
    assert.deepEqual(s.quests.breakfast, { step: 'pay', index: 2, done: true, at: { order: t0, $done: t0 + 90 } });
    assert.equal(apply(s, { do: 'quest', quest: 'breakfast', step: 'pay' }, ctx), s);
  });

  it('pins a riddle and solves it', () => {
    let s = apply(fresh(), { do: 'pin', riddle: 'lion-rumour/key' }, ctx);
    assert.deepEqual(s.riddles['lion-rumour/key'], { scene: 'lion-rumour', node: 'key', pinnedAt: s.clock, solved: false });
    s = apply(s, { do: 'solve', riddle: 'lion-rumour/key' }, ctx);
    assert.equal(s.riddles['lion-rumour/key'].solved, true);
    assert.equal(apply(s, { do: 'pin', riddle: 'lion-rumour/key' }, ctx), s);
  });

  it('meets people and remembers what they said, once each', () => {
    let s = apply(fresh(), { do: 'meet', npc: 'wang-ayi' }, ctx);
    s = apply(s, { do: 'remember', npc: 'wang-ayi', note: 'likes 包子' }, ctx);
    s = apply(s, { do: 'remember', npc: 'wang-ayi', note: 'likes 包子' }, ctx);
    assert.deepEqual(s.npcs['wang-ayi'].notes, ['likes 包子']);
    for (let i = 0; i < 30; i++) s = apply(s, { do: 'remember', npc: 'wang-ayi', note: `n${i}` }, ctx);
    assert.equal(s.npcs['wang-ayi'].notes.length, 20);
  });

  it('collects spirits, idioms, stamps, stations — the first time counts', () => {
    let s = applyAll(
      fresh(),
      [
        { do: 'spirit', spirit: 'shishizi' },
        { do: 'stamp', stamp: 'breakfast' },
        { do: 'station', station: 'nanluoguxiang' },
        { do: 'station', station: 'nanluoguxiang' },
      ],
      ctx,
    );
    s = apply(s, { do: 'idiom', idiom: '马马虎虎' }, { ...ctx, npc: 'barber', scene: 'haircut' });
    assert.equal(s.spirits.shishizi, s.clock);
    assert.deepEqual(s.idioms['马马虎虎'], { at: s.clock, npc: 'barber', scene: 'haircut' });
    assert.deepEqual(s.stations, ['nanluoguxiang']);
    const later = apply(apply(s, { do: 'tick', minutes: s.clock + 100 }, ctx), { do: 'stamp', stamp: 'breakfast' }, ctx);
    assert.equal(later.stamps.breakfast, s.clock);
  });

  it('opens chapters forward only', () => {
    let s = apply(fresh(), { do: 'chapter', chapter: 3 }, ctx);
    s = apply(s, { do: 'chapter', chapter: 2 }, ctx);
    assert.equal(s.chapter, 3);
  });

  it('ticks the clock forward and sleeps to morning', () => {
    let s = apply(fresh(), { do: 'tick', minutes: 22 * 60 }, ctx);
    assert.equal(apply(s, { do: 'tick', minutes: 60 }, ctx).clock, 22 * 60);
    s = apply(s, { do: 'sleep' }, ctx);
    assert.equal(s.clock, 1440 + 7 * 60);
  });

  it('counts rides, finishes scenes, changes settings', () => {
    const s = applyAll(
      fresh(),
      [
        { do: 'ride', route: 'nanluoguxiang>tiananmendong' },
        { do: 'ride', route: 'nanluoguxiang>tiananmendong' },
        { do: 'scene_done', scene: 'arrival' },
        { do: 'settings', patch: { input: 'voice' } },
      ],
      ctx,
    );
    assert.equal(s.rides['nanluoguxiang>tiananmendong'], 2);
    assert.deepEqual(s.scenes, ['arrival']);
    assert.equal(s.settings.input, 'voice');
    assert.equal(s.settings.pinyin, true);
  });
});

describe('readSave', () => {
  it('reads a current save as it is', () => {
    const s = apply(fresh(), { do: 'spirit', spirit: 'shishizi' }, ctx);
    const r = readSave(JSON.parse(JSON.stringify(s)));
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.save, s);
      assert.equal(r.upgraded, false);
    }
  });

  it('fills fields a save does not have yet', () => {
    const r = readSave({ version: 1, deviceId: 'mac', place: { map: 'lane', tile: [2, 3], facing: 'up' }, settings: { input: 'voice' } });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.save.place.map, 'lane');
      assert.deepEqual(r.save.rides, {});
      assert.equal(r.save.settings.input, 'voice');
      assert.equal(r.save.settings.volume, 0.6);
      assert.deepEqual(r.save.districts, ['gulou']);
    }
  });

  it('upgrades an older save step by step', () => {
    const upgrades = {
      1: (r: Record<string, unknown>) => ({ ...r, version: 2, flags: [...(r.flags as string[]), 'from_v1'] }),
      2: (r: Record<string, unknown>) => ({ ...r, version: 3, chapter: 2 }),
    };
    const r = readSave({ version: 1, flags: ['a'], chapter: 1 }, upgrades, 3);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.save.flags, ['a', 'from_v1']);
      assert.equal(r.save.chapter, 2);
      assert.equal(r.save.version, 3);
      assert.equal(r.upgraded, true);
    }
  });

  it('never downgrades a save from a newer build', () => {
    const r = readSave({ version: WORLD_SAVE_VERSION + 1 });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'newer');
  });

  it('refuses junk', () => {
    for (const junk of [null, 'save', [], { flags: [] }]) {
      const r = readSave(junk);
      assert.equal(r.ok, false);
    }
  });
});
