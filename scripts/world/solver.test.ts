/** The solver's checks (see solver.ts): the whole game, and the golden saves. */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { walkable } from '../../src/world/core/grid';
import { readSave } from '../../src/world/core/migrate';
import { DONE_AT } from '../../src/world/core/save';
import { districts, maps, npcs, quests, solve } from './solver';

describe('the quest solver', () => {
  const run = solve();

  it('finishes every quest, main and side', () => {
    const left = quests.filter((q) => !run.save.quests[q.id]?.done).map((q) => `${q.id} (at ${run.save.quests[q.id]?.step ?? 'not started'})`);
    assert.deepEqual(left, [], `unfinished after ${run.log.length} scenes`);
  });

  it('finds every spirit and every 成语', () => {
    for (const d of districts) {
      for (const x of d.spirits) assert.ok(x.id in run.save.spirits, `spirit ${x.id}`);
      for (const x of d.idioms) assert.ok(x.id in run.save.idioms, `成语 ${x.id}`);
    }
  });

  it('never has to pay money it does not have', () => {
    assert.deepEqual(run.short, []);
  });

  it('the 交通卡 never runs dry for good (the attendants top it up)', () => {
    assert.ok(run.save.bag.card !== null && run.save.bag.card >= 0);
  });

  it('every stamp can be earned', () => {
    const missing = districts.flatMap((d) => d.stamps).filter((x) => !(x.id in run.save.stamps)).map((x) => x.id);
    assert.deepEqual(missing, []);
  });

  it('its final save has an `at` stamp for every quest it did, in step order, never after the clock (§10 P4)', () => {
    for (const q of quests) {
      const st = run.save.quests[q.id];
      if (!st) continue;
      const at = st.at ?? {};
      assert.ok(Object.keys(at).length, `${q.id} has no stamps`);
      if (st.done) assert.ok(DONE_AT in at, `${q.id} is done without a finish stamp`);
      assert.ok(st.step in at || st.done, `${q.id}: the step it is at (${st.step}) has no stamp`);
      const ids = q.steps.map((x) => x.id);
      for (const k of Object.keys(at)) assert.ok(k === DONE_AT || ids.includes(k), `${q.id}: a stamp for no step (${k})`);
      const times = ids.filter((k) => k in at).map((k) => at[k]!);
      assert.deepEqual(times, [...times].sort((a, b) => a - b), `${q.id}: steps stamped out of order`);
      for (const t of Object.values(at)) assert.ok(t <= run.save.clock, `${q.id}: a stamp after the clock`);
    }
  });

  it("every person's routine spot is a tile they can stand on", () => {
    const byId = new Map(maps.map((m) => [m.id, m]));
    for (const n of npcs) {
      for (const r of n.routine) {
        const m = byId.get(r.map);
        if (!m) continue; // "not about" — at school, at work
        assert.ok(walkable(m.grid, r.tile[0], r.tile[1]), `${n.id} at ${r.map} ${r.tile.join(',')}`);
      }
    }
  });
});

describe('the golden saves', () => {
  const dir = 'content/world/test-saves';
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

  it('there is one for the start of every chapter', () => {
    assert.ok(files.length >= 8, files.join(' '));
  });

  for (const f of files) {
    it(`${f}: reads through the migration and the game plays on to the end from it`, () => {
      const r = readSave(JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
      assert.ok(r.ok, r.ok ? '' : r.message);
      const main = quests.filter((q) => /^(ch\d|epilogue)/.test(q.id));
      // the main story only: stop once it is told (side quests are the whole-game run's job)
      const run = solve(r.save, 40000, (s) => main.every((q) => s.quests[q.id]?.done));
      assert.deepEqual(main.filter((q) => !run.save.quests[q.id]?.done).map((q) => q.id), []);
    });
  }
});

describe('money goes round (Y3)', () => {
  it('a player who buys everything they are offered still finishes every quest', () => {
    const run = solve(undefined, 40000, undefined, { spendAll: true });
    assert.deepEqual(
      quests.filter((q) => !run.save.quests[q.id]?.done).map((q) => q.id),
      [],
    );
    assert.deepEqual(run.short, []);
    // and bought clothes at every rack on the way (§12 W5): the game still finishes
    const clothes = JSON.parse(readFileSync('content/world/clothes.json', 'utf8')) as { racks: { id: string; hair?: unknown }[]; clothes: { id: string; shop: string }[] };
    const shopOf = new Map(clothes.clothes.map((c) => [c.id, c.shop]));
    const racksBought = new Set(run.save.wardrobe.map((id) => shopOf.get(id.split(':')[0]!)));
    assert.deepEqual(clothes.racks.filter((r) => !r.hair && !racksBought.has(r.id)).map((r) => r.id), []);
    assert.notEqual(run.save.look.hair.style, 'short', 'the barber cut something');
  });

  it('a broke player earns a 交通卡 (40 元) within one game day of jobs', () => {
    const golden = readSave(JSON.parse(readFileSync('content/world/test-saves/chapter-2.json', 'utf8')));
    assert.ok(golden.ok);
    const broke = { ...golden.save, bag: { ...golden.save.bag, money: 0 } };
    const run = solve(broke, 400, (s) => s.bag.money >= 40);
    assert.ok(run.save.bag.money >= 40, `only ${run.save.bag.money} 元 after ${run.log.join(' ')}`);
    assert.ok(Math.floor(run.save.clock / 1440) - Math.floor(broke.clock / 1440) <= 1);
  });
});

