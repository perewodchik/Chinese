/**
 * Chapters 1–4 on their own (the learner's review, 2026-09-30): everything a
 * player can start in them can be finished in them, whatever order they
 * play in, and the traps found in review stay fixed — a promise the story
 * can't keep yet (the palace ticket), a spirit met before its step, a story
 * item given away, a person who isn't there at the hour the step doesn't
 * mention.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { castMap } from '../../src/world/core/cast';
import { newSave } from '../../src/world/core/save';
import { sceneFor } from '../../src/world/core/scenes';
import type { Condition, Scene } from '../../src/world/core/types';
import { districts, maps, npcs, quests, solve } from './solver';

const scenes = districts.flatMap((d) => d.scenes);
const shops = districts.flatMap((d) => d.shops ?? []);
const items = new Map(districts.flatMap((d) => d.items).map((i) => [i.id, i]));
const early = quests.filter((q) => q.chapter <= 4);
const actionsOf = (s: Scene) => s.nodes.flatMap((n) => [...(n.onEnter ?? []), ...(n.onExit ?? []), ...(n.expect ?? []).flatMap((e) => e.actions ?? [])]);

describe('chapters 1–4 hold up on their own', () => {
  it('every quest of chapters 1–4 can be finished before chapter 5', () => {
    const run = solve(undefined, 60000, undefined, { cap: 4 });
    assert.deepEqual(early.filter((q) => !run.save.quests[q.id]?.done).map((q) => `${q.id}@${run.save.quests[q.id]?.step ?? 'not started'}`), []);
    assert.deepEqual(run.short, []);
  });

  for (const seed of [3, 7, 11]) {
    it(`a player wandering in a random order (seed ${seed}) finishes them too`, () => {
      const run = solve(undefined, 60000, undefined, { cap: 4, seed });
      assert.deepEqual(early.filter((q) => !run.save.quests[q.id]?.done).map((q) => `${q.id}@${run.save.quests[q.id]?.step ?? 'not started'}`), []);
      assert.deepEqual(run.short, []);
    });
  }
});

describe('the traps found in review', () => {
  it('the palace ticket: the guard sends you to a friend, and 王阿姨 books it from chapter 1', () => {
    const guard = scenes.find((s) => s.id === 'tam-guard')!;
    assert.ok(!guard.nodes.some((n) => n.say.includes('明天再来')), 'no "come back tomorrow" the story cannot keep');
    assert.ok(actionsOf(guard).some((a) => a.do === 'quest' && a.quest === 'side-palace-ticket'));
    const s = { ...newSave('t', 0), chapter: 1, flags: ['palace-needs-ticket'], scenes: ['arrive', 'breakfast', 'lantern'], quests: { ch1: { step: 'card', index: 16, done: false } } };
    assert.equal(sceneFor(scenes, s, { npc: 'wang-ayi' })?.id, 'ticket');
  });

  it('a spirit is met only at its own step (meeting it early would strand the steps before it)', () => {
    for (const [scene, quest, step] of [
      ['lion-night', 'ch1', 'lion'],
      ['fox', 'ch2', 'fox'],
      ['c2-fox-tiger', 'ch2', 'fox'],
      ['menshen-give', 'ch3', 'menshen'],
      ['c3-menshen-face', 'ch3', 'menshen'],
      ['qilin', 'ch4', 'qilin'],
    ] as const) {
      const sc = scenes.find((s) => s.id === scene)!;
      assert.ok(JSON.stringify(sc.when).includes(`{"quest":"${quest}","step":"${step}"}`), scene);
    }
  });

  it('a thing a step needs cannot be lost for good (given away or eaten with no way to get another)', () => {
    const needed = new Set<string>();
    const walk = (c: Condition | undefined) => {
      if (!c) return;
      if ('item' in c) needed.add(c.item);
      if ('all' in c) c.all.forEach(walk);
      if ('any' in c) c.any.forEach(walk);
    };
    for (const q of early) for (const st of q.steps) walk(st.done);
    const bad: string[] = [];
    for (const id of needed) {
      const it = items.get(id);
      const losable = it?.gift || ['food', 'drink'].includes(it?.kind ?? '');
      if (!losable) continue;
      const sold = shops.some((sh) => sh.stock.some((x) => x.item === id));
      const again = scenes.some((s) => !s.once && actionsOf(s).some((a) => (a.do === 'give' || a.do === 'buy') && a.item === id));
      // the scarf may go to anyone: the homecoming has a version without it
      if (!sold && !again && id !== 'weijin') bad.push(id);
    }
    assert.deepEqual(bad, []);
  });

  it('a step whose person keeps hours says when', () => {
    const hoursIn = (c: Condition | undefined): boolean => !!c && ('hours' in c || ('all' in c && c.all.some(hoursIn)) || ('any' in c && c.any.some(hoursIn)));
    const bad: string[] = [];
    for (const q of early)
      for (const st of q.steps) {
        const d = st.done as { scene?: string; flag?: string } | undefined;
        const by = d?.scene
          ? scenes.filter((s) => s.id === d.scene)
          : d?.flag
            ? scenes.filter((s) => actionsOf(s).some((a) => a.do === 'flag' && a.flag === d.flag))
            : [];
        const timed = by.some((s) => hoursIn(s.when) || (npcs.find((n) => n.id === s.npc)?.routine ?? []).length > 0);
        if (timed && !st.when) bad.push(`${q.id}/${st.id}`);
      }
    assert.deepEqual(bad, []);
  });

  it('a flag set in chapters 1–4 is used in chapters 1–4 (no promise only a later chapter keeps)', () => {
    const minCh = (c: Condition | undefined): number =>
      !c ? 0 : 'chapter' in c ? c.chapter : 'all' in c ? Math.max(0, ...c.all.map(minCh)) : 'any' in c ? Math.min(...c.any.map(minCh)) : 0;
    const readsFlag = (c: Condition | undefined, f: string): boolean =>
      !!c && (('flag' in c && c.flag === f) || ('all' in c && c.all.some((x) => readsFlag(x, f))) || ('any' in c && c.any.some((x) => readsFlag(x, f))) || ('not' in c && readsFlag(c.not, f)));
    const chOf = new Map(districts.flatMap((d) => d.scenes.map((s) => [s.id, d.district.chapter] as const)));
    const bad: string[] = [];
    for (const s of scenes) {
      if (Math.max(chOf.get(s.id) ?? 1, minCh(s.when)) > 4) continue;
      for (const a of actionsOf(s)) {
        if (a.do !== 'flag' || a.value === false) continue;
        const readers = [
          ...scenes.filter((x) => readsFlag(x.when, a.flag)).map((x) => Math.max(chOf.get(x.id) ?? 1, minCh(x.when))),
          ...quests.filter((q) => q.steps.some((st) => readsFlag(st.done, a.flag))).map((q) => q.chapter),
        ];
        if (readers.length && readers.every((c) => c >= 5)) bad.push(`${a.flag} (${s.id})`);
      }
    }
    assert.deepEqual([...new Set(bad)], []);
  });

  it('小明 is at 天坛 for the school trip in school hours (the story placement wins over his routine)', () => {
    const park = maps.find((m) => m.id === 'tiantan-park')!;
    const at = (hour: number) => ({ ...newSave('t', 0), clock: hour * 60, chapter: 4, quests: { ch4: { step: 'school', index: 1, done: false } } });
    const here = (hour: number) => castMap(park.objects, park.id, npcs, at(hour)).some((o) => o.kind === 'npc' && o.npc === 'xiaoming');
    assert.equal(here(10), true, 'on the trip at 10:00');
    assert.equal(here(18), false, 'home again by evening');
  });
});

describe('📌 key lines of chapters 1–4', () => {
  it('a key line the player answers on the spot is marked worked out (it does not stay pinned forever)', () => {
    const solved = new Set([...JSON.stringify(districts.map((d) => [d.scenes, d.cutscenes])).matchAll(/"do":"solve","riddle":"([^"]+)"/g)].map((m) => m[1]!));
    const bad: string[] = [];
    for (const d of districts)
      for (const s of d.scenes) {
        if (d.district.chapter > 4 && !/^(c[1-4]|sub-)/.test(s.id)) continue;
        for (const n of s.nodes) if (n.key && n.expect?.length && !solved.has(`${s.id}/${n.id}`)) bad.push(`${s.id}/${n.id}`);
      }
    assert.deepEqual(bad, []);
  });
});
