import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { glossaryOf, KIT_GLOSSARY, uncovered } from '../order-kit/gloss';
import { check, groupOf, itemOf, offered, solve } from '../order-kit/order';
import { buildTasks } from '../order-kit/tasks';
import { KIT_SCREENS, KIT_STRINGS } from '../order-kit/strings';
import { luckin as brand } from './menu';
import { ROUNDS } from './manifest';

const gl = glossaryOf(brand);

describe('瑞幸咖啡', () => {
  for (const band of [1, 2] as const) {
    it(`builds a full game at band ${band}, rising in level`, () => {
      const tasks = buildTasks(brand, testContext(band, 'luckin').rng, band, ROUNDS);
      assert.equal(tasks.length, ROUNDS);
      for (let i = 1; i < tasks.length; i++) assert.ok(tasks[i].level >= tasks[i - 1].level);
      if (band === 1) assert.ok(tasks.every((t) => t.level <= 2));
      else assert.ok(tasks.every((t) => t.level >= 2));
    });
  }

  it('builds the same tasks from the same seed', () => {
    const a = buildTasks(brand, testContext(2, 'same').rng, 2, ROUNDS);
    const b = buildTasks(brand, testContext(2, 'same').rng, 2, ROUNDS);
    assert.deepEqual(a, b);
  });

  it('can solve every task every template makes', () => {
    for (let s = 0; s < 300; s++) {
      for (const band of [1, 2] as const) {
        for (const t of buildTasks(brand, testContext(band, `s${s}`).rng, band, ROUNDS)) {
          const r = check(brand, solve(brand, t), t);
          assert.ok(r.ok, `${t.message}: ${r.misses.map((m) => m.en).join('; ')}`);
          for (const w of t.wants) {
            if (w.kind !== 'line') continue;
            const item = itemOf(brand, w.item);
            for (const [g, o] of Object.entries(w.choices))
              assert.ok(offered(brand, item, g).some((x) => x.id === o), `${item.zh} offers ${g}=${o}`);
          }
          assert.deepEqual(uncovered(t.message, gl), [], t.message);
          for (const p of t.parts) assert.ok(gl[p], `chip ${p} of ${t.message}`);
        }
      }
    }
  });

  it('uses every template', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 300; s++)
      for (const band of [1, 2] as const) buildTasks(brand, testContext(band, `u${s}`).rng, band, ROUNDS).forEach((t) => seen.add(t.template));
    assert.deepEqual([...seen].sort(), brand.templates.map((t) => t.id).sort());
  });

  it('has a glossary entry for every Chinese string it can show', () => {
    const shown = [
      brand.name,
      brand.merchant,
      brand.store.zh,
      brand.friend,
      brand.banner.zh,
      brand.banner.sub,
      ...brand.categories.map((c) => c.zh),
      ...brand.items.flatMap((i) => [i.zh, i.call ?? i.zh, i.desc, ...(i.tags ?? [])]),
      ...Object.values(brand.groups).flatMap((g) => [g.zh, ...g.options.flatMap((o) => [o.zh, o.sub ?? ''])]),
      ...brand.coupons.flatMap((c) => [c.zh, c.sub]),
      ...brand.notes,
      ...brand.flow.map((f) => f.zh),
      ...brand.tour.map((t) => t.zh),
      ...brand.words.flatMap((w) => w.words),
      ...KIT_STRINGS,
    ];
    const missing = shown.flatMap((s) => uncovered(s, gl).map((c) => `${c} in ${s}`));
    assert.deepEqual(missing, []);
    for (const w of brand.words.flatMap((g) => g.words)) assert.ok(gl[w], `menu word ${w}`);
    for (const [zh, g] of Object.entries(gl)) {
      assert.ok(g.py && g.en, `${zh} has pinyin and English`);
    }
    assert.ok(Object.keys(KIT_GLOSSARY).length > 40);
  });

  it('has a map step for every screen the kit shows', () => {
    for (const s of KIT_SCREENS) assert.ok(brand.flow.some((f) => f.id === s), s);
  });

  it('has its photo keys in the menu photo set, and real HSK words for its items', () => {
    const menuSet = JSON.parse(readFileSync(new URL('../../../scripts/images/menu.json', import.meta.url), 'utf8')) as Record<string, string>;
    for (const key of Object.keys(brand.photos)) assert.ok(menuSet[key], `scripts/images/menu.json has ${key}`);
    const lib = testContext(2).lib;
    for (const i of brand.items) for (const w of i.hsk ?? []) assert.ok(lib.byWord.has(w), `${i.zh}: ${w} is an HSK word`);
  });

  it('has a photo for every item', () => {
    for (const i of brand.items) assert.ok(brand.photos[i.photo], `${i.zh}: ${i.photo}`);
    for (const i of brand.items) for (const g of i.groups) assert.ok(groupOf(brand, g));
  });
});
