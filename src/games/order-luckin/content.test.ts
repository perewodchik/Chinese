import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { check, newOrder, price, solve } from '../order-kit/order';
import { brandSuite } from '../order-kit/suite.test';
import { buildTasks } from '../order-kit/tasks';
import { ROUNDS } from './manifest';
import { luckin as brand } from './menu';

brandSuite(brand, ROUNDS);

describe('瑞幸咖啡: delivery, budget and coupon orders', () => {
  const find = (id: string) => {
    for (let s = 0; s < 500; s++)
      for (const band of [1, 2] as const) {
        const t = buildTasks(brand, testContext(band, `f${s}`).rng, band, ROUNDS).find((x) => x.template === id);
        if (t) return t;
      }
    throw new Error(`no ${id}`);
  };

  it('prices a delivery: 配送费, 打包费 per cup, and 满30减8', () => {
    const lines = [{ item: 'latte', choices: { temp: ['ice'] }, qty: 2 }];
    const bill = price(brand, { ...newOrder(), mode: '外送', lines, coupon: null });
    assert.deepEqual(bill.fees.map((f) => [f.zh, f.amount]), [['配送费', 3], ['打包费', 2]]);
    assert.equal(bill.promo, 8);
    assert.equal(bill.total, 58 - 8 + 5);
    assert.equal(price(brand, { ...newOrder(), lines, coupon: null }).fees.length, 0, 'no fees for pickup');
  });

  it('wants the address and the cutlery on a delivery', () => {
    const t = find('deliver-office');
    const o = solve(brand, t);
    assert.ok(check(brand, o, t.wants).ok);
    assert.match(check(brand, { ...o, address: 'home' }, t.wants).misses[0].zh, /送到公司/);
    assert.match(check(brand, { ...o, cutlery: 1 }, t.wants).misses[0].zh, /不要餐具/);
    assert.match(check(brand, { ...o, mode: '自提' }, t.wants).misses[0].zh, /外送/);
  });

  it('holds the budget, and wants the coupon it names', () => {
    const b = find('budget');
    const o = solve(brand, b);
    assert.ok(check(brand, o, b.wants).ok);
    assert.match(check(brand, { ...o, coupon: null }, b.wants).misses[0].zh, /太贵了/, 'without the coupon the cheapest coffee is over ¥15');
    const c = find('other-coupon');
    const oc = solve(brand, c);
    assert.ok(check(brand, oc, c.wants).ok);
    assert.match(check(brand, { ...oc, coupon: undefined }, c.wants).misses[0].zh, /满30减5/, 'the coupon the app picked is not the one asked for');
  });
});
