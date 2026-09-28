import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { glossaryOf, uncovered } from './gloss';
import {
  addLine,
  check,
  choose,
  defaultChoices,
  disabled,
  goalOf,
  groupOf,
  itemOf,
  missingRequired,
  newOrder,
  nextHint,
  offered,
  setQty,
  solve,
  solveLines,
  type View,
} from './order';
import { SCREENS_OF, KIT_STRINGS } from './strings';
import { buildTasks } from './tasks';
import type { Brand, Order, Task } from './types';

/**
 * The tests every brand must pass, run by each brand's content.test.ts. (Named
 * .test.ts so the app build leaves it out; it has no tests of its own.)
 */
/**
 * Follow 下一步 from the chat to 去支付, pressing whatever it points at, the
 * way a lost learner would. Returns what went wrong, or null when the order
 * was paid and was right.
 */
export function walk(brand: Brand, task: Task): string | null {
  let order: Order = newOrder();
  let view: View = { screen: 'chat', sheet: null };
  let part: 0 | 1 = 0;
  let laterDone = false;
  const trail: string[] = [];
  for (let step = 0; step < 90; step++) {
    const h = nextHint(brand, order, goalOf(task, part, laterDone), view);
    trail.push(h.target);
    const [kind, a, b] = h.target.split(':');
    const sheet = view.sheet;
    const fail = (why: string) => `${why} at ${h.target} — ${trail.slice(-8).join(' → ')}`;
    switch (kind) {
      case 'chat-card':
        view = { screen: brand.model === 'table' ? 'landing' : 'home', sheet: null };
        break;
      case 'home-pickup':
      case 'home-delivery':
        order = { ...order, mode: kind === 'home-pickup' ? '自提' : '外送' };
        view = { screen: 'menu', sheet: null };
        break;
      case 'diners':
        order = { ...order, diners: Number(a) };
        break;
      case 'tea':
        order = { ...order, tea: a };
        break;
      case 'landing-start':
        view = { screen: 'menu', sheet: null };
        break;
      case 'item':
        view = { screen: 'menu', sheet: { kind: 'spec', item: a, choices: defaultChoices(brand, itemOf(brand, a)), qty: 1 } };
        break;
      case 'opt':
      case 'group': {
        if (sheet?.kind !== 'spec') return fail('no sheet');
        const item = itemOf(brand, sheet.item);
        const o = kind === 'opt' ? b : offered(brand, item, a).find((x) => !(sheet.choices[a] ?? []).includes(x.id) && !disabled(brand, sheet.choices, a).has(x.id))?.id;
        if (!o) return fail('nothing to choose');
        const next = choose(brand, sheet.choices, a, o);
        if (JSON.stringify(next) === JSON.stringify(sheet.choices)) return fail('the tap changed nothing');
        view = { ...view, sheet: { ...sheet, choices: next } };
        break;
      }
      case 'spec-plus':
        if (sheet?.kind !== 'spec') return fail('no sheet');
        view = { ...view, sheet: { ...sheet, qty: (sheet.qty ?? 1) + 1 } };
        break;
      case 'spec-add': {
        if (sheet?.kind !== 'spec') return fail('no sheet');
        if (missingRequired(brand, itemOf(brand, sheet.item), sheet.choices)) return fail('a required group is empty');
        order = { ...order, lines: addLine(order.lines, { item: sheet.item, choices: sheet.choices, qty: sheet.qty ?? 1 }) };
        view = { ...view, sheet: null };
        break;
      }
      case 'spec-close':
      case 'cart-close':
      case 'sheet-ok':
        view = { ...view, sheet: null };
        break;
      case 'cart-bar':
        view = { screen: 'menu', sheet: { kind: 'cart' } };
        break;
      case 'cart-minus': {
        const i = Number(a);
        order = { ...order, lines: setQty(order.lines, i, order.lines[i].qty - 1) };
        break;
      }
      case 'checkout-btn':
        view = { screen: 'checkout', sheet: null };
        break;
      case 'nav-back':
        view = { screen: 'menu', sheet: null };
        break;
      case 'dine':
        order = { ...order, dine: a };
        break;
      case 'mode':
        order = { ...order, mode: a as Order['mode'] };
        break;
      case 'note-row':
        view = { ...view, sheet: { kind: 'note' } };
        break;
      case 'note':
        order = { ...order, note: order.note.includes(a) ? order.note.filter((x) => x !== a) : [...order.note, a] };
        break;
      case 'coupon-row':
        view = { ...view, sheet: { kind: 'coupon' } };
        break;
      case 'coupon':
        order = { ...order, coupon: a };
        break;
      case 'address-row':
        view = { ...view, sheet: { kind: 'address' } };
        break;
      case 'addr':
        order = { ...order, address: a };
        view = { ...view, sheet: null };
        break;
      case 'cutlery-row':
        view = { ...view, sheet: { kind: 'cutlery' } };
        break;
      case 'cut':
        order = { ...order, cutlery: Number(a) };
        view = { ...view, sheet: null };
        break;
      case 'order-btn': {
        const wants = part === 0 ? task.wants : task.later!.wants;
        const r = check(brand, order, wants);
        if (!r.ok) return fail(`下单 was wrong: ${r.misses.map((m) => m.en).join('; ')}`);
        order = { ...order, placed: [...order.placed, order.lines], lines: [] };
        if (part === 0 && task.later) part = 1;
        else laterDone = true;
        view = { screen: 'table', sheet: null };
        break;
      }
      case 'more-btn':
        view = { screen: 'menu', sheet: null };
        break;
      case 'bill-btn':
        if (task.later && !laterDone) return fail('went to the bill before 加菜');
        view = { screen: 'bill', sheet: null };
        break;
      case 'pay-btn': {
        if (brand.model === 'table') return view.screen === 'bill' ? null : fail('paying away from the bill');
        const r = check(brand, order, task.wants);
        return r.ok ? null : fail(`去支付 was wrong: ${r.misses.map((m) => m.en).join('; ')}`);
      }
      default:
        return fail('an unknown target');
    }
  }
  return `did not finish — ${trail.slice(-10).join(' → ')}`;
}

export function brandSuite(brand: Brand, rounds: number) {
  const gl = glossaryOf(brand);
  const table = brand.model === 'table';
  const SEEDS = 250;

  describe(`${brand.name}: the shared checks`, () => {
    for (const band of [1, 2] as const) {
      it(`builds a full game at band ${band}, rising in level`, () => {
        const tasks = buildTasks(brand, testContext(band, brand.id).rng, band, rounds);
        assert.equal(tasks.length, rounds);
        for (let i = 1; i < tasks.length; i++) assert.ok(tasks[i].level >= tasks[i - 1].level);
        if (band === 1) assert.ok(tasks.every((t) => t.level <= 2));
        else assert.ok(tasks.every((t) => t.level >= 2));
        assert.ok(tasks.filter((t) => brand.templates.find((x) => x.id === t.template)?.extra).length <= 1, 'one extra order at most');
      });
    }

    it('builds the same tasks from the same seed', () => {
      const a = buildTasks(brand, testContext(2, 'same').rng, 2, rounds);
      const b = buildTasks(brand, testContext(2, 'same').rng, 2, rounds);
      assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
    });

    it('can solve every task every template makes, with every word in the glossary', () => {
      for (let s = 0; s < SEEDS; s++) {
        for (const band of [1, 2] as const) {
          for (const t of buildTasks(brand, testContext(band, `s${s}`).rng, band, rounds)) {
            const first = solve(brand, t);
            const r = check(brand, first, t.wants);
            assert.ok(r.ok, `${t.message}: ${r.misses.map((m) => m.en).join('; ')}`);
            if (t.later) {
              const lines = solveLines(brand, t.later.wants);
              const r2 = check(brand, { ...first, placed: [first.lines], lines }, t.later.wants, lines);
              assert.ok(r2.ok, `${t.later.message}: ${r2.misses.map((m) => m.en).join('; ')}`);
            }
            for (const stage of [t, ...(t.later ? [t.later] : [])]) {
              assert.deepEqual(uncovered(stage.message, gl), [], stage.message);
              for (const p of stage.parts) assert.deepEqual(uncovered(p, gl), [], `chip ${p} of ${stage.message}`);
              assert.ok(stage.en.trim(), 'has its English');
              for (const w of stage.wants) {
                if (w.kind !== 'line') continue;
                const item = itemOf(brand, w.item);
                for (const [g, v] of Object.entries(w.choices))
                  for (const o of Array.isArray(v) ? v : [v])
                    assert.ok(offered(brand, item, g).some((x) => x.id === o), `${item.zh} offers ${g}=${o}`);
              }
            }
            if (table) assert.ok(t.wants.some((w) => w.kind === 'diners') || t.level < 4, 'a table meal says how many');
          }
        }
      }
    });

    it('gets every order paid by following 下一步 alone', () => {
      for (let s = 0; s < 60; s++)
        for (const band of [1, 2] as const)
          for (const t of buildTasks(brand, testContext(band, `w${s}`).rng, band, rounds)) {
            const why = walk(brand, t);
            assert.equal(why, null, `${t.template}: ${t.message}${t.later ? ` / ${t.later.message}` : ''}`);
          }
    });

    it('uses every template', () => {
      const seen = new Set<string>();
      for (let s = 0; s < SEEDS; s++)
        for (const band of [1, 2] as const)
          buildTasks(brand, testContext(band, `u${s}`).rng, band, rounds).forEach((t) => seen.add(t.template));
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
        ...(brand.dine ?? []),
        ...(brand.code ? [brand.code.zh] : []),
        ...brand.categories.map((c) => c.zh),
        ...brand.items.flatMap((i) => [i.zh, i.call ?? i.zh, i.desc, ...(i.tags ?? []), ...(i.unit ? [i.unit] : [])]),
        ...Object.values(brand.groups).flatMap((g) => [g.zh, ...g.options.flatMap((o) => [o.zh, o.sub ?? ''])]),
        ...brand.coupons.flatMap((c) => [c.zh, c.sub]),
        ...brand.fees.map((f) => f.zh),
        ...(brand.delivery?.addresses.flatMap((a) => [a.zh, a.sub]) ?? []),
        ...brand.notes,
        ...brand.flow.map((f) => f.zh),
        ...brand.tour.map((t) => t.zh),
        ...brand.words.flatMap((w) => w.words),
        ...KIT_STRINGS,
      ];
      const missing = shown.flatMap((s) => uncovered(s, gl).map((c) => `${c} in ${s}`));
      assert.deepEqual(missing, []);
      for (const w of brand.words.flatMap((g) => g.words)) assert.ok(gl[w], `menu word ${w}`);
      for (const [zh, g] of Object.entries(gl)) assert.ok(g.py && g.en, `${zh} has pinyin and English`);
    });

    it('has a map step for every screen it shows, in order', () => {
      const ids = brand.flow.map((f) => f.id);
      assert.deepEqual(ids, SCREENS_OF[brand.model]);
    });

    it('holds together: groups, options, photos, HSK words', () => {
      assert.ok(brand.items.length >= 20 && brand.items.length <= 40, `${brand.items.length} items`);
      assert.ok(brand.categories.length >= 5 && brand.categories.length <= 9, `${brand.categories.length} categories`);
      assert.ok(brand.templates.length >= 10, `${brand.templates.length} templates`);
      const menuSet = JSON.parse(readFileSync(new URL('../../../scripts/images/menu.json', import.meta.url), 'utf8')) as Record<string, string>;
      for (const key of Object.keys(brand.photos)) assert.ok(menuSet[key], `scripts/images/menu.json has ${key}`);
      const lib = testContext(2).lib;
      const ids = new Set<string>();
      for (const i of brand.items) {
        assert.ok(!ids.has(i.id), `one ${i.id}`);
        ids.add(i.id);
        assert.ok(brand.photos[i.photo], `${i.zh}: photo ${i.photo}`);
        assert.ok(i.cats.length && i.cats.every((c) => brand.categories.some((x) => x.id === c)), `${i.zh}: categories`);
        for (const w of i.hsk ?? []) assert.ok(lib.byWord.has(w), `${i.zh}: ${w} is an HSK word`);
        for (const g of i.groups) groupOf(brand, g);
        for (const [g, os] of Object.entries(i.only ?? {})) for (const o of os) assert.ok(groupOf(brand, g).options.some((x) => x.id === o), `${i.zh}: only ${g}=${o}`);
        for (const [g, o] of Object.entries(i.defaults ?? {})) assert.ok(groupOf(brand, g).options.some((x) => x.id === o), `${i.zh}: default ${g}=${o}`);
        for (const o of Object.keys(i.prices ?? {}))
          assert.ok(i.groups.some((g) => groupOf(brand, g).options.some((x) => x.id === o)), `${i.zh}: price for ${o}`);
      }
      for (const c of brand.categories) assert.ok(brand.items.some((i) => i.cats.includes(c.id)), `${c.zh} has items`);
      if (table) assert.ok(brand.table, 'a table');
      if (brand.table?.tea) groupOf(brand, brand.table.tea);
    });

    // Eight lattes under one photo looked like a broken menu. Within a shop,
    // every dish and the banner show a picture of their own — by key, and by
    // the file behind the key, since two queries can find the same one.
    // (The same dish in two shops, 可乐 or 拍黄瓜, may share one.)
    it('shows every dish with a photo of its own', () => {
      const shipped = JSON.parse(readFileSync(new URL('../../data/menuPictures.json', import.meta.url), 'utf8')) as {
        pictures: Record<string, { src: string }>;
      };
      const byKey = new Map<string, string>();
      const byFile = new Map<string, string>();
      for (const [who, key] of [...brand.items.map((i) => [i.zh, i.photo]), ['banner', brand.banner.photo]]) {
        assert.ok(!byKey.has(key), `${who} and ${byKey.get(key)} both show ${key}`);
        byKey.set(key, who);
        const file = shipped.pictures[key]?.src;
        if (!file) continue;
        assert.ok(!byFile.has(file), `${who} (${key}) shows the same photo as ${byFile.get(file)}`);
        byFile.set(file, `${who} (${key})`);
      }
    });
  });
}
