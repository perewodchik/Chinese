import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { BARGAIN_LINES, haggle, startHaggle, type Bargain, type Haggle } from './bargain';
import { libraryLeveler } from './budget';
import { libraryLexicon } from './dialogue/lexicon';
import { ScriptedDialogue } from './dialogue/scripted';
import { priceFrom, readNumber } from './numbers';
import { applyAll, newSave } from './save';
import type { Scene } from './types';
import { bitsOf } from './voice';

const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
const lib: Library = { characters: chars, themes: [], components: {}, strokes: {}, byChar: new Map(chars.map((c) => [c.c, c])), words, byWord: new Map(words.map((w) => [w.w, w])) };

describe('Chinese numbers (Y6)', () => {
  it('reads numbers the long way, the market way, and in digits', () => {
    const cases: [string, number | null][] = [
      ['一', 1], ['两', 2], ['十', 10], ['十二', 12], ['二十', 20], ['二十五', 25], ['两百', 200], ['一百', 100],
      ['一百零五', 105], ['一百一十', 110], ['一百一', 110], ['一百五', 150], ['两百五十', 250], ['三千', 3000], ['一千二', 1200],
      ['25', 25], ['二五', null], ['百十', null], ['abc', null], ['', null],
    ];
    for (const [s, n] of cases) assert.equal(readNumber(s), n, s);
  });

  it('finds the price in a line, and not the 一 of 一点', () => {
    const cases: [string, number | null][] = [
      ['二十块', 20], ['最多三十', 30], ['一百五行吗？', 150], ['三块五', 3.5], ['五毛', 0.5], ['25', 25], ['二十五块钱吧', 25],
      ['便宜一点吧', null], ['太贵了！', null], ['我要一个', null], ['三十块行吗？', 30], ['那……四十，可以吗？', 40],
    ];
    for (const [s, n] of cases) assert.equal(priceFrom(s), n, s);
  });
});

const map: Bargain = { item: 'ditu', open: 50, limit: 30, go: 'c' };
const say = (b: Bargain, h: Haggle, text: string) => {
  const t = haggle(b, h, text);
  assert.ok(t, text);
  return t;
};

describe('bargaining (Y6)', () => {
  it('太贵了 twice brings the price down, then the seller holds', () => {
    let h = startHaggle(map);
    const t1 = say(map, h, '太贵了！');
    assert.deepEqual([t1.kind, t1.zh, t1.haggle.price], ['drop', '好吧，四十。', 40]);
    const t2 = say(map, (h = t1.haggle), '便宜一点吧');
    assert.deepEqual([t2.kind, t2.haggle.price], ['drop', 35]);
    const t3 = say(map, (h = t2.haggle), '再便宜一点');
    assert.deepEqual([t3.kind, t3.zh, t3.haggle.price], ['firm', '不能再少了，三十五。', 35]);
  });

  it('an offer is countered, and the same fair offer again is taken', () => {
    const t1 = say(map, startHaggle(map), '三十块行吗？');
    assert.deepEqual([t1.kind, t1.zh, t1.haggle.price], ['counter', '三十太少了。四十吧！', 40]);
    const t2 = say(map, t1.haggle, '三十块行吗？');
    assert.deepEqual([t2.kind, t2.zh, t2.haggle.price], ['deal', '好，三十！', 30]);
  });

  it('far too low is cold; an offer above the price on the table is taken at the table’s price', () => {
    const t1 = say(map, startHaggle(map), '十块！');
    assert.equal(t1.kind, 'cold');
    assert.equal(t1.zh, `十？${BARGAIN_LINES.cold.zh}五十。`);
    assert.deepEqual([say(map, startHaggle(map), '六十块').kind, say(map, startHaggle(map), '六十块').haggle.price], ['deal', 50]);
  });

  it('walking away gets one call back at the lowest price; the second time the seller lets you go', () => {
    const t1 = say(map, startHaggle(map), '算了。');
    assert.deepEqual([t1.kind, t1.zh, t1.haggle.price], ['called', '等一下！三十，好吗？', 30]);
    assert.equal(say(map, t1.haggle, '好').kind, 'deal');
    assert.equal(say(map, t1.haggle, '不要了').kind, 'gone');
  });

  it('selling is the same talk the other way: the buyer goes up to his highest', () => {
    const coin: Bargain = { item: 'tongqian', open: 8, limit: 15, sell: true };
    const t1 = say(coin, startHaggle(coin), '太少了！');
    assert.deepEqual([t1.kind, t1.haggle.price], ['drop', 12]);
    const t2 = say(coin, startHaggle(coin), '十五块行吗？');
    assert.equal(t2.kind, 'counter');
    assert.equal(say(coin, t2.haggle, '十五块行吗？').haggle.price, 15);
    assert.equal(say(coin, startHaggle(coin), '一百块').kind, 'cold');
  });

  it('words that are not bargaining are left to the rest of the talk', () => {
    assert.equal(haggle(map, startHaggle(map), '你好'), null);
    assert.equal(haggle(map, startHaggle(map), '不行')?.kind ?? null, null);
  });

  it('every line a seller can say keeps the word budget and can be said from the recorded pieces', () => {
    const lv = libraryLeveler(lib);
    for (const l of Object.values(BARGAIN_LINES)) {
      const ws = lv(l.zh, new Set());
      assert.deepEqual(ws.filter((w) => w.level === 0 || w.level > 2).map((w) => w.w), [], l.zh);
    }
    for (const b of [map, { open: 200, limit: 100 }, { open: 8, limit: 15, sell: true }] as Bargain[]) {
      for (const text of ['太贵了', '太少了', '便宜一点', '多一点', `${b.limit}块行吗`, `${b.limit}块行吗`, '十块', '算了', '好']) {
        let h = startHaggle(b);
        for (let i = 0; i < 3; i++) {
          const t = haggle(b, h, text);
          if (!t) break;
          assert.ok(bitsOf(t.zh), t.zh);
          h = t.haggle;
        }
      }
    }
  });
});

describe('a bargain in a talk (Y6)', () => {
  const scene: Scene = {
    id: 'old-map',
    map: 'm',
    npc: 'dashu',
    trigger: 'talk',
    start: 'a',
    nodes: [
      { id: 'a', say: '地图，五十块。', translate: '', bargain: map },
      { id: 'c', say: '给你！', translate: '' },
    ],
  };
  const d = new ScriptedDialogue({ scenes: [scene], npcs: [], items: [{ id: 'ditu', name: '地图', en: 'map' }] }, libraryLexicon(lib));
  const rich = newSave('d', 0);

  it('haggles, then the deal is paid on the phone and the story goes on', () => {
    const t0 = d.start(scene, rich);
    const t1 = d.reply(t0.state, { text: '三十块行吗？', via: 'keyboard' });
    assert.equal(t1.say?.zh, '三十太少了。四十吧！');
    const t2 = d.reply(t1.state, d.answer(t1.state)!);
    assert.equal(t2.say?.zh, '好，三十！扫这儿吧。');
    assert.equal(t2.state.due?.total, 30);
    const t3 = d.reply(t2.state, d.answer(t2.state)!);
    assert.equal(t3.chime?.zh, '支付宝到账，三十元。');
    assert.equal(t3.say?.zh, '给你！');
    assert.ok(t3.end);
    const s = applyAll(rich, t3.actions, { now: 1 });
    assert.deepEqual([s.bag.money, s.bag.items.ditu, s.scenes.includes('old-map')], [rich.bag.money - 30, 1, true]);
  });

  it('walking away for good ends the talk with nothing bought, and the stall is there another day', () => {
    const t0 = d.start(scene, rich);
    const t1 = d.reply(d.reply(t0.state, { text: '算了', via: 'keyboard' }).state, { text: '算了', via: 'keyboard' });
    assert.ok(t1.end);
    assert.deepEqual(t1.actions, []);
  });

  it('💡 offers the fair price', () => {
    assert.equal(d.hintAt(d.start(scene, rich).state)?.full, '三十块行吗？');
  });
});
