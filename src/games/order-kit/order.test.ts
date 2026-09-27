import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { luckin as brand } from '../order-luckin/menu';
import type { Brand, Order, Task } from './types';
import {
  addLine,
  applyRules,
  bestCoupon,
  check,
  choose,
  defaultChoices,
  itemOf,
  lineKey,
  missingRequired,
  newHelpLog,
  newOrder,
  nextHint,
  logLookup,
  price,
  round1,
  setQty,
  solve,
  unitPrice,
  usedHelp,
  type View,
} from './order';

const latte = itemOf(brand, 'latte');

const order = (o: Partial<Order>): Order => ({ ...newOrder(), ...o });

/** A made-up shop with a rule and a many-of group, to test what luckin does not use. */
const tea: Brand = {
  ...brand,
  id: 'test-tea',
  groups: {
    ice: {
      id: 'ice',
      zh: '冰量',
      kind: 'one',
      required: true,
      options: [
        { id: 'normal', zh: '正常冰' },
        { id: 'less', zh: '少冰' },
        { id: 'hot', zh: '热' },
      ],
    },
    temp: brand.groups.temp,
    top: {
      id: 'top',
      zh: '加料',
      kind: 'many',
      required: false,
      options: [
        { id: 'pearl', zh: '珍珠', delta: 2 },
        { id: 'coco', zh: '椰果', delta: 1 },
      ],
    },
  },
  rules: [{ if: ['temp', 'hot'], disable: ['ice', ['normal', 'less']] }],
  items: [{ id: 'milk-tea', zh: '奶茶', cats: ['top'], photo: 'x', price: 6, desc: '', groups: ['temp', 'ice', 'top'] }],
  coupons: [],
};

describe('the order', () => {
  it('opens the sheet with the defaults, and a required group without one empty', () => {
    const c = defaultChoices(brand, latte);
    assert.deepEqual(c.temp, []);
    assert.deepEqual(c.sugar, ['none']);
    assert.deepEqual(c.milk, ['whole']);
    assert.equal(missingRequired(brand, latte, c)?.id, 'temp');
    assert.equal(missingRequired(brand, latte, choose(brand, c, 'temp', 'ice')), null);
  });

  it('chooses the only option of a group by itself (仅冰饮)', () => {
    const c = defaultChoices(brand, itemOf(brand, 'orange-americano'));
    assert.deepEqual(c.temp, ['ice']);
  });

  it('prices option deltas and quantities', () => {
    let c = defaultChoices(brand, latte);
    c = choose(brand, c, 'temp', 'hot');
    c = choose(brand, c, 'shot', 'double');
    c = choose(brand, c, 'cup', 'xl');
    assert.equal(unitPrice(brand, { item: 'latte', choices: c }), 35);
    const bill = price(brand, order({ lines: [{ item: 'latte', choices: c, qty: 2 }], coupon: null }));
    assert.equal(bill.items, 70);
    assert.equal(bill.total, 70);
  });

  it('adds up many-of add-ons, and a rule takes away what it switches off', () => {
    let c = defaultChoices(tea, tea.items[0]);
    c = choose(tea, c, 'ice', 'less');
    c = choose(tea, c, 'top', 'pearl');
    c = choose(tea, c, 'top', 'coco');
    assert.equal(unitPrice(tea, { item: 'milk-tea', choices: c }), 9);
    c = choose(tea, c, 'top', 'coco');
    assert.deepEqual(c.top, ['pearl']);
    c = choose(tea, c, 'temp', 'hot');
    assert.deepEqual(c.ice, [], '热 clears the ice level');
    assert.deepEqual(choose(tea, c, 'ice', 'normal').ice, [], 'and it cannot be chosen again');
    assert.deepEqual(applyRules(tea, { temp: ['hot'], ice: ['hot'] }).ice, ['hot']);
  });

  it('merges lines with the same choices and keeps different ones apart', () => {
    const ice = { temp: ['ice'], sugar: ['none'] };
    const hot = { temp: ['hot'], sugar: ['none'] };
    let lines = addLine([], { item: 'latte', choices: ice, qty: 1 });
    lines = addLine(lines, { item: 'latte', choices: { sugar: ['none'], temp: ['ice'] }, qty: 1 });
    assert.equal(lines.length, 1);
    assert.equal(lines[0].qty, 2);
    lines = addLine(lines, { item: 'latte', choices: hot, qty: 1 });
    assert.equal(lines.length, 2);
    assert.notEqual(lineKey(lines[0]), lineKey(lines[1]));
    assert.equal(setQty(lines, 0, 0).length, 1);
  });

  it('picks the coupon that saves most, and 满减 only above its line', () => {
    const one = [{ item: 'latte', choices: { temp: ['ice'] }, qty: 1 }];
    assert.equal(bestCoupon(brand, one)?.id, 'drink');
    const bill = price(brand, order({ lines: one }));
    assert.equal(bill.discount, round1(29 - 13.9));
    assert.equal(bill.total, 13.9);
    // 满50减10 against the drink coupon on three croissants and two lattes
    const big: Order['lines'] = [
      { item: 'croissant', choices: {}, qty: 3 },
      { item: 'americano', choices: { temp: ['ice'] }, qty: 1 },
    ];
    assert.equal(price(brand, order({ lines: big, coupon: 'off50' })).discount, 10);
    assert.equal(price(brand, order({ lines: one, coupon: 'off50' })).discount, 0, 'not usable under ¥50');
    assert.equal(price(brand, order({ lines: one, coupon: null })).discount, 0);
  });

  it('rounds to the jiao', () => {
    assert.equal(round1(0.1 + 0.2), 0.3);
    assert.equal(round1(13.94), 13.9);
  });
});

const task = (t: Partial<Task>): Task => ({ message: '', en: '', parts: [], level: 2, template: 't', wants: [], ...t });

describe('checking an order', () => {
  const want = task({
    wants: [
      { kind: 'line', item: 'latte', qty: 1, choices: { temp: 'ice', milk: 'oat' } },
      { kind: 'dine', value: '外带' },
    ],
  });
  const good = { temp: ['ice'], sugar: ['less'], milk: ['oat'], shot: ['std'], cup: ['xl'] };

  it('accepts any choice the task did not name', () => {
    assert.ok(check(brand, order({ lines: [{ item: 'latte', choices: good, qty: 1 }], dine: '外带' }), want).ok);
  });

  it('names a wrong option', () => {
    const r = check(brand, order({ lines: [{ item: 'latte', choices: { ...good, milk: ['whole'] }, qty: 1 }], dine: '外带' }), want);
    assert.equal(r.ok, false);
    assert.equal(r.misses.length, 1);
    assert.match(r.misses[0].zh, /燕麦奶/);
  });

  it('names a missing item, an extra one, a wrong count, dine-in and the note', () => {
    assert.match(check(brand, order({ dine: '外带' }), want).misses[0].zh, /我要的是拿铁/);
    const extra = check(
      brand,
      order({ lines: [{ item: 'latte', choices: good, qty: 1 }, { item: 'croissant', choices: {}, qty: 1 }], dine: '外带' }),
      want,
    );
    assert.match(extra.misses[0].zh, /我没要原味可颂/);
    const many = check(brand, order({ lines: [{ item: 'latte', choices: good, qty: 2 }], dine: '外带' }), want);
    assert.match(many.misses[0].zh, /我只要一杯拿铁/);
    const dine = check(brand, order({ lines: [{ item: 'latte', choices: good, qty: 1 }], dine: '堂食' }), want);
    assert.match(dine.misses[0].zh, /外带/);
    const noted = task({ wants: [{ kind: 'note', value: '少冰' }] });
    assert.equal(check(brand, order({}), noted).ok, false);
    assert.equal(check(brand, order({ note: ['少冰'] }), noted).ok, true);
  });

  it('matches two lines of one drink to two different wants', () => {
    const two = task({
      wants: [
        { kind: 'line', item: 'latte', qty: 1, choices: { temp: 'ice' } },
        { kind: 'line', item: 'latte', qty: 1, choices: { temp: 'hot' } },
      ],
    });
    const lines = [
      { item: 'latte', choices: { ...good, temp: ['hot'] }, qty: 1 },
      { item: 'latte', choices: good, qty: 1 },
    ];
    assert.ok(check(brand, order({ lines }), two).ok);
    const both = check(brand, order({ lines: [{ item: 'latte', choices: good, qty: 2 }] }), two);
    assert.equal(both.ok, false);
    assert.match(both.misses[0].zh, /热/);
  });

  it('is solved by the order built from its wants', () => {
    assert.ok(check(brand, solve(brand, want), want).ok);
  });
});

describe('下一步', () => {
  const want = task({
    wants: [
      { kind: 'line', item: 'latte', qty: 1, choices: { temp: 'ice', milk: 'oat' } },
      { kind: 'dine', value: '外带' },
      { kind: 'note', value: '少冰' },
    ],
  });
  const menu: View = { screen: 'menu', sheet: null };

  it('walks the whole order, one control at a time', () => {
    const hints: string[] = [];
    let o = newOrder();
    hints.push(nextHint(brand, o, want, { screen: 'chat', sheet: null }).target);
    hints.push(nextHint(brand, o, want, { screen: 'home', sheet: null }).target);
    hints.push(nextHint(brand, o, want, menu).target);
    let c = defaultChoices(brand, latte);
    hints.push(nextHint(brand, o, want, { screen: 'menu', sheet: { kind: 'spec', item: 'latte', choices: c } }).target);
    c = choose(brand, c, 'temp', 'ice');
    hints.push(nextHint(brand, o, want, { screen: 'menu', sheet: { kind: 'spec', item: 'latte', choices: c } }).target);
    c = choose(brand, c, 'milk', 'oat');
    hints.push(nextHint(brand, o, want, { screen: 'menu', sheet: { kind: 'spec', item: 'latte', choices: c } }).target);
    o = { ...o, lines: [{ item: 'latte', choices: c, qty: 1 }] };
    hints.push(nextHint(brand, o, want, menu).target);
    hints.push(nextHint(brand, o, want, { screen: 'checkout', sheet: null }).target);
    o = { ...o, dine: '外带' };
    hints.push(nextHint(brand, o, want, { screen: 'checkout', sheet: null }).target);
    hints.push(nextHint(brand, o, want, { screen: 'checkout', sheet: { kind: 'note' } }).target);
    o = { ...o, note: ['少冰'] };
    hints.push(nextHint(brand, o, want, { screen: 'checkout', sheet: null }).target);
    assert.deepEqual(hints, [
      'chat-card',
      'home-pickup',
      'item:latte',
      'opt:temp:ice',
      'opt:milk:oat',
      'spec-add',
      'checkout-btn',
      'dine:外带',
      'note-row',
      'note:少冰',
      'pay-btn',
    ]);
  });

  it('sends a wrong item back out of the cart', () => {
    const o = order({ lines: [{ item: 'croissant', choices: {}, qty: 1 }] });
    assert.equal(nextHint(brand, o, want, menu).target, 'cart-bar');
    assert.equal(nextHint(brand, o, want, { screen: 'menu', sheet: { kind: 'cart' } }).target, 'cart-minus:0');
    assert.equal(nextHint(brand, o, want, { screen: 'checkout', sheet: null }).target, 'nav-back');
  });
});

describe('help costs the first-try mark', () => {
  it('counts 拼, any 下一步, and a third word looked up', () => {
    let log = newHelpLog();
    assert.equal(usedHelp(log), false);
    log = logLookup(logLookup(log, '冰'), '热');
    log = logLookup(log, '冰');
    assert.equal(usedHelp(log), false, 'two words, one of them twice');
    assert.equal(usedHelp(logLookup(log, '奶')), true);
    assert.equal(usedHelp({ ...newHelpLog(), pinyin: true }), true);
    assert.equal(usedHelp({ ...newHelpLog(), hints: 1 }), true);
  });
});
