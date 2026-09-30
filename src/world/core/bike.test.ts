import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { applyBike, BIKE_HOME, BIKE_LINES, bikeName, bikePlace, canGoFlat, flatToday, mergeBike, readBike, type BikeState } from './bike';
import { libraryLeveler } from './budget';
import { libraryLexicon } from './dialogue/lexicon';
import { ScriptedDialogue } from './dialogue/scripted';
import type { Turn, Utterance } from './dialogue/source';
import { holds } from './flags';
import { merge } from './merge';
import { readSave } from './migrate';
import { applyAll, newSave, WORLD_SAVE_VERSION } from './save';
import type { Scene, WorldSave } from './types';

const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
const lib: Library = { characters: chars, themes: [], components: {}, strokes: {}, byChar: new Map(chars.map((c) => [c.c, c])), words, byWord: new Map(words.map((w) => [w.w, w])) };
const lex = libraryLexicon(lib);
const gulou = read<Scene[]>('content/world/gulou/scenes.json');
const shop = gulou.find((s) => s.id === 'bike-shop')!;
const src = new ScriptedDialogue({ scenes: gulou, npcs: [] }, lex);
const ctx = { now: 1 };

const rich = (money = 1000): WorldSave => {
  const s = newSave('t', 0);
  return { ...s, place: { map: 'gulou-dongdajie', tile: [8, 7], facing: 'up' }, bag: { ...s.bag, money } };
};

function talk(save: WorldSave, lines: Array<string | Utterance>, scene = shop) {
  let t: Turn = src.start(scene, save);
  let s = applyAll(save, t.actions, ctx);
  const heard: string[] = [t.say?.zh ?? ''];
  for (const l of lines) {
    const u: Utterance = typeof l === 'string' ? { text: l, via: 'keyboard' } : l;
    t = src.reply(t.state, u);
    s = applyAll(s, t.actions, ctx);
    heard.push([t.chime?.zh, t.say?.zh].filter(Boolean).join(' '));
  }
  return { t, s, heard };
}

describe('the bike shop (§13 L1)', () => {
  it('a bike is looked at, asked about, ridden round the block, bought — and a basket after', () => {
    const { t, s, heard } = talk(rich(), ['我想买自行车', '这辆凤凰多少钱？', '有蓝色的吗？', '有黑的吗？', '我可以试试吗？', '很好！', '太贵了', '我要这辆', { text: '', via: 'keyboard', paid: 420 }, '我要一个车筐', { text: '', via: 'keyboard', paid: 30 }, '再见']);
    assert.match(heard[1]!, /永久、凤凰、飞鸽/);
    assert.equal(heard[2], '凤凰四百二十块。有红的、蓝的、白的。');
    assert.equal(heard[3], '有！蓝的。');
    assert.match(heard[4]!, /没有黑的/);
    assert.equal(heard[5], '可以！骑一圈试试。 怎么样？');
    assert.equal(heard[6], BIKE_LINES.good.zh);
    assert.equal(heard[7], BIKE_LINES.firm.zh);
    assert.match(heard[8]!, /一共四百二十块。扫这儿吧/);
    assert.ok(t.state.ended);
    assert.equal(s.bag.money, 1000 - 420 - 30);
    assert.deepEqual({ model: s.bike?.model, colour: s.bike?.colour, parts: s.bike?.parts }, { model: 'fenghuang', colour: 'blue', parts: ['basket'] });
    assert.deepEqual(s.bike?.at, { map: 'gulou-dongdajie', tile: [8, 7] });
    assert.ok(holds({ bike: 'owned' }, s) && !holds({ bike: 'none' }, s));
    // the diary: 「我买了一辆蓝色的凤凰自行车。」
    assert.ok(Object.values(s.diary).flat().includes('u:一辆蓝色的凤凰自行车:a blue Fenghuang city bike'));
    assert.ok(s.bills.some((b) => b.amount === -420));
  });

  it('with too little money the seller says so and nothing is bought; with a bike already only parts are sold', () => {
    const poor = talk(rich(100), ['这辆飞鸽多少钱？', '我要这辆']);
    assert.equal(poor.t.intent, 'short');
    assert.equal(poor.s.bike, undefined);
    const owner = applyAll(rich(), [{ do: 'bike', model: 'yongjiu', colour: 'green' }], ctx);
    const again = talk(owner, ['我要这辆永久', '我要一把车锁', { text: '', via: 'keyboard', paid: 25 }, '我要一把车锁']);
    assert.equal(again.heard[1], BIKE_LINES.have.zh);
    assert.deepEqual(again.s.bike?.parts, ['lock']);
    assert.equal(again.heard[4], BIKE_LINES.hasPart.zh);
  });

  it('💡 walks the shop from looking to riding away, and a patient player gets there', () => {
    let t: Turn = src.start(shop, rich());
    let s = applyAll(rich(), t.actions, ctx);
    for (let i = 0; i < 12 && !s.bike; i++) {
      t = src.reply(t.state, src.answer(t.state)!);
      s = applyAll(s, t.actions, ctx);
    }
    assert.equal(s.bike?.model, 'yongjiu');
  });

  it('the seller’s own lines keep the word budget (HSK 1–2, plus the bike words)', () => {
    const lv = libraryLeveler(lib);
    const situation = new Set(['自行车', '辆', '骑', '试试', '车筐', '车锁', '后座', '永久', '凤凰', '飞鸽', '看看', '圈', '一圈']);
    for (const l of Object.values(BIKE_LINES)) {
      const ws = lv(l.zh, situation);
      assert.deepEqual(ws.filter((w) => (w.level === 0 || w.level > 2) && !situation.has(w.w)).map((w) => w.w), [], l.zh);
    }
  });
});

describe('your bike in the save (§13 L2–L3)', () => {
  const bought = (clock = 10 * 60) => applyAll({ ...rich(), clock }, [{ do: 'bike', model: 'feige', colour: 'green' }], ctx);

  it('gets on and off, parks where you got off, locks only with a lock, goes home by the next morning', () => {
    let s = bought();
    s = applyAll(s, [{ do: 'bike_on' }], ctx);
    assert.equal(s.bike?.at, 'riding');
    assert.ok(holds({ bike: 'riding' }, s));
    s = applyAll(s, [{ do: 'bike_off', map: 'wangfujing-street', tile: [3, 4], lock: true }], ctx);
    assert.deepEqual(s.bike?.at, { map: 'wangfujing-street', tile: [3, 4] });
    assert.equal(s.bike?.locked, undefined, 'no lock, no locking');
    s = applyAll(s, [{ do: 'bike_part', part: 'lock' }, { do: 'bike_lock' }], ctx);
    assert.equal(s.bike?.locked, true);
    s = applyAll(s, [{ do: 'bike_home' }], ctx);
    assert.equal(bikePlace(s), 'coming');
    assert.deepEqual(bikePlace({ ...s, clock: s.bike!.arrives! }), BIKE_HOME);
  });

  it('a flat tyre comes at most once a week, and the 修车摊 mends it', () => {
    let s = bought(0);
    // some day in the next two weeks, after the first three days
    let day = 0;
    for (let d = 1; d <= 14 && !day; d++) if (flatToday({ ...s, clock: d * 1440 })) day = d;
    assert.ok(day >= 3, `a flat on day ${day}`);
    s = applyAll({ ...s, clock: day * 1440 }, [{ do: 'bike_flat' }], ctx);
    assert.ok(holds({ bike: 'flat' }, s));
    s = applyAll(s, [{ do: 'bike_fix' }], ctx);
    assert.ok(!holds({ bike: 'flat' }, s));
    assert.ok(Object.values(s.diary).flat().includes('a'));
    assert.ok(!canGoFlat({ ...s, clock: (day + 3) * 1440 }), 'not again within the week');
    assert.ok(canGoFlat({ ...s, clock: (day + 7) * 1440 }));
  });

  it('the save upgrades to v17 with no bike, reads a bike back, and refuses junk', () => {
    assert.equal(WORLD_SAVE_VERSION, 17);
    const old = { ...newSave('x', 0), version: 16 } as unknown as Record<string, unknown>;
    delete old.bike;
    const r = readSave(old);
    assert.ok(r.ok && r.upgraded && r.save.bike === undefined);
    const withBike = readSave(JSON.parse(JSON.stringify(bought())));
    assert.ok(withBike.ok && withBike.save.bike?.model === 'feige');
    assert.equal(readBike({ model: 'ufo' }), undefined);
    assert.equal(readBike({ model: 'yongjiu', colour: 'pink', at: 7 })?.colour, 'black');
  });

  it('merges: either device’s bike; the later save’s colour, parts and place', () => {
    const a = { ...bought(), updatedAt: 5, deviceId: 'a' };
    const b = { ...newSave('b', 9), updatedAt: 9 };
    assert.equal(merge(a, b).bike?.model, 'feige');
    const later = { ...a, updatedAt: 20, deviceId: 'c', bike: { ...a.bike!, parts: ['basket'], at: 'riding' } as BikeState };
    const m = merge(a, later);
    assert.deepEqual(m.bike?.parts, ['basket']);
    assert.equal(m.bike?.at, 'riding');
    assert.equal(mergeBike(a, later, later)?.got, a.bike!.got);
  });

  it('names a bike for the diary', () => {
    assert.equal(bikeName('yongjiu', 'green').zh, '一辆绿色的永久自行车');
    assert.equal(bikeName('jiuche', 'black').zh, '一辆旧自行车');
    assert.equal(applyBike(newSave('t', 0), { do: 'bike_on' }).bike, undefined);
  });
});
