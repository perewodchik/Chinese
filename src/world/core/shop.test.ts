import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { libraryLeveler } from './budget';
import { libraryLexicon } from './dialogue/lexicon';
import { ScriptedDialogue } from './dialogue/scripted';
import { applyAll, newSave } from './save';
import { readSave } from './migrate';
import { numZh, parseOrder, PAY_LINES, priceZh, readNumber, SHOP_LINES, shopScene, yuanZh, type Shop } from './shop';
import { bitsOf } from './voice';
import type { Item, Scene } from './types';

const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
const lib: Library = { characters: chars, themes: [], components: {}, strokes: {}, byChar: new Map(chars.map((c) => [c.c, c])), words, byWord: new Map(words.map((w) => [w.w, w])) };
const ctx = { now: 1 };

const items: Item[] = [
  { id: 'baozi', name: '包子', en: 'steamed bun', kind: 'food' },
  { id: 'doujiang', name: '豆浆', en: 'soy milk', kind: 'drink' },
  { id: 'tanghulu', name: '糖葫芦', en: 'candied haws', kind: 'food' },
  { id: 'hongbao', name: '红包', en: 'red envelope', kind: 'gift' },
];
const shop: Shop = {
  id: 'zaodian',
  npc: 'shifu',
  map: 'zaodian',
  name: '早点铺',
  stock: [
    { item: 'baozi', price: 3 },
    { item: 'doujiang', price: 3, measure: '杯' },
    { item: 'tanghulu', price: 10, measure: '串' },
    { item: 'hongbao', price: 5, when: { season: 'winter' } },
  ],
};
const named = shop.stock.map((x) => ({ item: x.item, name: items.find((i) => i.id === x.item)!.name }));

describe('numbers and prices (Y1)', () => {
  it('reads and says numbers the way a seller does', () => {
    assert.deepEqual(['一', '两', '二', '十', '十二', '二十', '二十五', '3', 'abc'].map(readNumber), [1, 2, 2, 10, 12, 20, 25, 3, null]);
    assert.deepEqual([1, 2, 10, 12, 20, 25, 100, 105, 110, 150, 200].map((n) => numZh(n)), ['一', '两', '十', '十二', '二十', '二十五', '一百', '一百零五', '一百一十', '一百五十', '两百']);
    assert.deepEqual([3, 2, 3.5, 0.5, 12, 20].map(priceZh), ['三块', '两块', '三块五', '五毛', '十二块', '二十块']);
    assert.deepEqual([15, 2, 3.5].map(yuanZh), ['十五元', '二元', '三点五元']);
  });

  it('hears what is ordered, with numbers and measure words', () => {
    assert.deepEqual(parseOrder('我要两个包子，一杯豆浆。', named), [
      { item: 'baozi', n: 2 },
      { item: 'doujiang', n: 1 },
    ]);
    assert.deepEqual(parseOrder('三串糖葫芦', named), [{ item: 'tanghulu', n: 3 }]);
    assert.deepEqual(parseOrder('包子', named), [{ item: 'baozi', n: 1 }]);
    assert.deepEqual(parseOrder('你好', named), []);
  });

  it('every price and total up to 200 元 can be said from the recorded pieces (Y2)', () => {
    for (let p = 0.5; p <= 200; p += 0.5) {
      for (const zh of [PAY_LINES.scan(priceZh(p)).zh, PAY_LINES.less(priceZh(p)).zh, PAY_LINES.box(yuanZh(p)).zh]) assert.ok(bitsOf(zh), zh);
    }
  });

  it('the seller’s own lines keep the word budget (HSK 1, at most one HSK 2 word)', () => {
    const lv = libraryLeveler(lib);
    for (const l of Object.values(SHOP_LINES)) {
      const ws = lv(l.zh, new Set());
      assert.deepEqual(ws.filter((w) => w.level === 0 || w.level > 2).map((w) => w.w), [], l.zh);
      assert.ok(ws.filter((w) => w.level === 2).length <= 1, l.zh);
    }
  });
});

describe('a shop talk (Y1)', () => {
  const scene = shopScene(shop, new Map(items.map((i) => [i.id, i])));
  const story: Scene = {
    id: 'breakfast',
    map: 'zaodian',
    npc: 'shifu',
    trigger: 'talk',
    start: 'hi',
    nodes: [
      { id: 'hi', say: '早！要什么？', translate: '', order: { shop: 'zaodian', go: 'done' } },
      { id: 'done', say: '给你！', translate: '' },
    ],
  };
  const d = new ScriptedDialogue({ scenes: [scene, story], npcs: [], shops: [shop], items }, libraryLexicon(lib));
  const rich = newSave('d', 0);

  it('takes an order, answers 多少钱, and on 不要了 says the total to pay (Y2)', () => {
    const t0 = d.start(scene, rich);
    const t1 = d.reply(t0.state, { text: '我要两个包子。', via: 'keyboard' });
    assert.equal(t1.say?.zh, '两个包子，一共六块。还要什么？');
    const t2 = d.reply(t1.state, { text: '豆浆多少钱？', via: 'keyboard' });
    assert.equal(t2.say?.zh, '豆浆三块一杯。');
    const t3 = d.reply(t2.state, { text: '一杯豆浆', via: 'keyboard' });
    assert.equal(t3.say?.zh, '两个包子，一杯豆浆，一共九块。还要什么？');
    const t4 = d.reply(t3.state, { text: '不要了，谢谢。', via: 'keyboard' });
    assert.equal(t4.say?.zh, '一共九块。扫这儿吧。');
    assert.equal(t4.actions.length, 0, 'nothing is paid until the phone pays');
    assert.deepEqual(t4.state.due && [t4.state.due.total, t4.state.due.mode], [9, 'scan']);
    // the amount heard, typed wrong twice, then right
    const w1 = d.reply(t4.state, { text: '', via: 'keyboard', paid: 6 });
    assert.equal(w1.say?.zh, '不对，是九块。');
    const w2 = d.reply(w1.state, { text: '', via: 'keyboard', paid: 90 });
    assert.equal(w2.say?.zh, '多了！');
    assert.equal(w2.state.hint, 3, 'from the second miss the phone fills it in');
    const t5 = d.reply(w2.state, { text: '', via: 'keyboard', paid: 9 });
    assert.equal(t5.chime?.zh, '支付宝到账，九元。');
    assert.equal(t5.say?.zh, '谢谢！');
    assert.ok(t5.end);
    const s = applyAll(rich, t5.actions, { ...ctx, npc: 'shifu' });
    assert.deepEqual([s.bag.money, s.bag.items.baozi, s.bag.items.doujiang], [rich.bag.money - 9, 2, 1]);
    assert.deepEqual(s.bills.at(-1), { id: `d:${rich.clock}`, at: rich.clock, who: 'shifu', amount: -9 });
  });

  it('a cashier who rings up too much is put right with 不对, and a heart', () => {
    const cashier: Shop = { ...shop, id: 'store', pay: 'code', mischarge: true };
    const sc = shopScene(cashier, new Map(items.map((i) => [i.id, i])));
    const dd = new ScriptedDialogue({ scenes: [sc], npcs: [], shops: [cashier], items }, libraryLexicon(lib));
    // day 3 is a day a cashier may get it wrong
    const day3 = { ...rich, clock: 2 * 1440 + 9 * 60 };
    const t0 = dd.start(sc, day3);
    const due = dd.reply(dd.reply(t0.state, { text: '一个包子', via: 'keyboard' }).state, { text: '不要了', via: 'keyboard' });
    assert.deepEqual([due.state.due?.total, due.state.due?.charged], [3, 6]);
    const fixed = dd.reply(due.state, { text: '不对', via: 'keyboard' });
    assert.equal(fixed.say?.zh, '对不起！是三块。谢谢你！');
    assert.ok(fixed.actions.some((a) => a.do === 'hearts'));
    assert.equal(fixed.state.due?.charged, 3);
    const paid = dd.reply(fixed.state, { text: '', via: 'keyboard', paid: 3 });
    assert.ok(paid.actions.some((a) => a.do === 'money' && a.amount === -3));
    // accepting a wrong charge costs a little, and 兔儿爷 says so afterwards
    const lost = dd.reply(due.state, { text: '', via: 'keyboard', paid: 6 });
    assert.ok(lost.actions.some((a) => a.do === 'money' && a.amount === -6));
    assert.equal(lost.companion?.kind, 'heard');
  });

  it('never vanishes when the money is short, and says what is out of season', () => {
    const poor = { ...rich, bag: { ...rich.bag, money: 5 } };
    const t0 = d.start(scene, poor);
    const t1 = d.reply(d.reply(t0.state, { text: '一串糖葫芦', via: 'keyboard' }).state, { text: '不要了', via: 'keyboard' });
    assert.equal(t1.say?.zh, `一共十块……${SHOP_LINES.short.zh}`);
    assert.equal(t1.actions.length, 0);
    assert.ok(!t1.end);
    // 红包 are sold in winter; day 1 is September
    assert.equal(d.reply(t0.state, { text: '我要红包', via: 'keyboard' }).say?.zh, '现在没有红包。');
  });

  it('an order inside a story goes on to the story afterwards', () => {
    const t0 = d.start(story, rich);
    const due = d.reply(d.reply(t0.state, { text: '一个包子', via: 'keyboard' }).state, { text: '不要了', via: 'keyboard' });
    const t1 = d.reply(due.state, d.answer(due.state)!);
    assert.equal(t1.state.node, 'done');
    assert.equal(t1.chime?.zh, '支付宝到账，三元。');
    assert.equal(t1.say?.zh, '给你！');
  });

  it('💡 offers the first thing on sale, then 不要了', () => {
    const t0 = d.start(scene, rich);
    assert.equal(d.hintAt(t0.state)?.full, '我要一个包子。');
    const t1 = d.reply(t0.state, { text: '我要一个包子。', via: 'keyboard' });
    assert.equal(d.hintAt(t1.state)?.full, '不要了，谢谢。');
  });

  it('a version 6 save gains an empty 账单', () => {
    const r = readSave({ ...newSave('d', 0), version: 6, bills: undefined });
    assert.ok(r.ok && Array.isArray(r.save.bills) && r.save.bills.length === 0);
  });
});
