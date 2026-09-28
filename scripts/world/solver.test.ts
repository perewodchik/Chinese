/** The solver's checks (see solver.ts): the whole game, and the golden saves. */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { walkable } from '../../src/world/core/grid';
import { readSave } from '../../src/world/core/migrate';
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
      const run = solve(r.save);
      const main = quests.filter((q) => /^(ch\d|epilogue)/.test(q.id));
      assert.deepEqual(main.filter((q) => !run.save.quests[q.id]?.done).map((q) => q.id), []);
    });
  }
});
