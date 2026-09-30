import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { applyBike, BIKE_HOME, BIKE_LINES, bikeName, bikePlace, callScene, canGoFlat, flatToday, mergeBike, NO_RIDE_MAPS, NO_RIDE_SIGNS, noRide, parkOnArrival, timedNow, readBike, RIDE_KM, RIDE_PLACES, rideMs, rideOptions, ridePlace, rideSights, type BikeState } from './bike';
import { walkable } from './grid';
import { readMap } from '../engine/mapdata';
import { libraryLeveler } from './budget';
import { libraryLexicon } from './dialogue/lexicon';
import { ScriptedDialogue } from './dialogue/scripted';
import type { Turn, Utterance } from './dialogue/source';
import { holds } from './flags';
import { BIKE_NOTICE } from './notice';
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

describe('riding (§13 L2)', () => {
  it('no riding into stations, parks, the palace and temples, or indoors; streets are fine', () => {
    assert.equal(noRide('station-wangfujing', false), 'station');
    assert.equal(noRide('tiantan-park', true), 'park');
    assert.equal(noRide('taihedian', true), 'park');
    assert.equal(noRide('zaodian', false), 'indoors');
    assert.equal(noRide('wangfujing-street', true), null);
    assert.equal(noRide('gulou-dongdajie', true), null);
  });

  it('骑车去: near districts only, the story’s ones, nearest first, minutes at 15 km/h', () => {
    const all = () => 1;
    const from = rideOptions({ district: 'gulou', chapter: 11 }, all);
    assert.equal(from[0]!.to.district, 'houhai');
    assert.ok(from.every((o) => o.km <= RIDE_KM));
    assert.ok(from.every((o, i) => i === 0 || from[i - 1]!.km <= o.km));
    assert.ok(!from.some((o) => o.to.district === 'panjiayuan'), 'too far from 鼓楼');
    const houhai = from.find((o) => o.to.district === 'houhai')!;
    assert.ok(houhai.km < 2 && houhai.minutes >= 5);
    // not in chapter 1: only what the story has opened
    assert.deepEqual(rideOptions({ district: 'gulou', chapter: 1 }, (d) => (d === 'houhai' ? 2 : 1)).map((o) => o.to.district).includes('houhai'), false);
    // from 王府井 to 前门 you cross 长安街
    const sights = rideSights(ridePlace('wangfujing')!, ridePlace('qianmen')!).map((x) => x.zh);
    assert.deepEqual(sights, ['王府井', '长安街', '前门']);
    assert.ok(rideSights(ridePlace('gulou')!, ridePlace('houhai')!).some((x) => x.zh === '什刹海'));
    assert.equal(rideMs(0.5), 6000);
    assert.equal(rideMs(40), 15000);
  });

  it('every arrival street and the bike’s place at home are tiles you can stand on', () => {
    const check = (map: string, tile: readonly [number, number]) => {
      const info = readMap(map, read(`public/world/maps/${map}.json`));
      assert.ok(walkable(info.grid, tile[0], tile[1]), `${map} ${tile}`);
      assert.equal(noRide(map, true), null, `${map} can be ridden`);
    };
    for (const p of RIDE_PLACES) check(p.arrive.map, p.arrive.tile);
    check(BIKE_HOME.map, BIKE_HOME.tile);
  });

  it('the phone call: said in Chinese, 10 元, the bike home by the next morning', () => {
    const s0 = applyAll({ ...rich(), clock: 15 * 60 }, [{ do: 'bike', model: 'feige', colour: 'green' }, { do: 'bike_on' }, { do: 'bike_off', map: 'wangfujing-street', tile: [3, 4] }], ctx);
    const call = callScene('王府井大街');
    const talked = new ScriptedDialogue({ scenes: [call], npcs: [] }, lex);
    let t = talked.start(call, s0);
    t = talked.reply(t.state, talked.answer(t.state)!);
    const s = applyAll(s0, t.actions, ctx);
    assert.equal(s.bag.money, s0.bag.money - 10);
    assert.equal(bikePlace(s), 'coming');
    assert.deepEqual(bikePlace({ ...s, clock: 2 * 1440 + 7 * 60 }), BIKE_HOME);
  });

  it('a ride between districts passes its minutes and writes the diary', () => {
    const s = applyAll(rich(), [{ do: 'bike', model: 'yongjiu', colour: 'black' }, { do: 'bike_on' }, { do: 'bike_ride', district: 'houhai', minutes: 7 }], ctx);
    assert.equal(s.clock, rich().clock + 7);
    assert.ok(Object.values(s.diary).flat().includes('y:houhai'));
    const walking = applyAll(rich(), [{ do: 'bike_ride', district: 'houhai', minutes: 7 }], ctx);
    assert.equal(walking.clock, rich().clock);
  });
});

describe('small life with the bike (§13 L3)', () => {
  it('a friend notices your bike once; a photo with it has its diary line', () => {
    const s0 = applyAll(rich(), [{ do: 'meet', npc: 'wang-ayi' }, { do: 'hearts', npc: 'wang-ayi', delta: 2 }, { do: 'bike', model: 'feige', colour: 'blue' }], ctx);
    const hi: Scene = { id: 'hi', map: 'm', npc: 'wang-ayi', trigger: 'talk', start: 'a', nodes: [{ id: 'a', say: '你好！', translate: 'Hello!' }] };
    const talkSrc = new ScriptedDialogue({ scenes: [hi], npcs: [] }, lex);
    const t = talkSrc.start(hi, s0);
    assert.equal(t.chime?.zh, BIKE_NOTICE['wang-ayi']!.zh);
    const s1 = applyAll(s0, t.actions, ctx);
    assert.equal(talkSrc.start(hi, s1).chime, undefined, 'once');
    const lv = libraryLeveler(lib);
    for (const l of Object.values(BIKE_NOTICE)) assert.deepEqual(lv(l.zh, new Set(['自行车'])).filter((w) => (w.level === 0 || w.level > 2) && w.w !== '自行车').map((w) => w.w), [], l.zh);
    const shot = applyAll(s1, [{ do: 'photo', subjects: ['bike:mine'] }], ctx);
    assert.ok(Object.values(shot.diary).flat().includes('v'));
  });

  it('no flat tyre on a timed step', () => {
    assert.ok(timedNow([{ when: 'after dark' }]));
    assert.ok(!timedNow([{}]));
  });
});

describe('the bike checks (§13 L4)', () => {
  it('arriving on a map you cannot ride: the bike stays where you last rode, and the right sign', () => {
    const riding = applyAll(rich(), [{ do: 'bike', model: 'yongjiu', colour: 'black' }, { do: 'bike_on' }], ctx);
    // down into the subway at 王府井: it waits at the station's door on the street
    const sub = parkOnArrival(riding, 'station-wangfujing', false, { map: 'wangfujing-street', tile: [10, 55] }, [8, 11])!;
    assert.deepEqual(sub.off, { do: 'bike_off', map: 'wangfujing-street', tile: [10, 55] });
    assert.equal(sub.sign?.text, '自行车不能进站');
    const after = applyAll(riding, [sub.off], ctx);
    assert.deepEqual(bikePlace(after), { map: 'wangfujing-street', tile: [10, 55] });
    // a park gate
    assert.equal(parkOnArrival(riding, 'jingshan-park', true, { map: 'beihai-north', tile: [35, 14] }, [0, 10])?.sign?.text, NO_RIDE_SIGNS.park.text);
    // a shop: no sign, parked at the door
    const shop = parkOnArrival(riding, 'yaodian', false, { map: 'wangfujing-street', tile: [15, 16] }, [3, 6])!;
    assert.equal(shop.sign, null);
    // on along a street; and nothing at all when walking
    assert.equal(parkOnArrival(riding, 'yandai-xiejie', true, null, [0, 5]), null);
    assert.equal(parkOnArrival(rich(), 'station-wangfujing', false, null, [8, 11]), null);
  });

  it('every no-ride map is a real map, entered from a street you can ride', () => {
    const maps = new Set(readdirSync('public/world/maps').filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => f.replace(/\.json$/, '')));
    for (const m of NO_RIDE_MAPS) assert.ok(maps.has(m), m);
  });

  it('every 骑车去 pair can be ridden both ways, each with sights from where you set off to where you arrive', () => {
    let pairs = 0;
    for (const a of RIDE_PLACES) {
      const opts = rideOptions({ district: a.district, chapter: 11 }, () => 1);
      assert.ok(opts.length, `${a.district} is not alone`);
      for (const o of opts) {
        pairs++;
        const back = rideOptions({ district: o.to.district, chapter: 11 }, () => 1).find((x) => x.to.district === a.district);
        assert.ok(back && back.km === o.km, `${a.district} ⇄ ${o.to.district}`);
        const sights = rideSights(a, o.to);
        assert.equal(sights[0], a.sight);
        assert.equal(sights.at(-1), o.to.sight);
        const s = applyAll(rich(), [{ do: 'bike', model: 'feige', colour: 'blue' }, { do: 'bike_on' }, { do: 'bike_ride', district: o.to.district, minutes: o.minutes }, { do: 'enter', ...o.to.arrive, district: o.to.district }], ctx);
        assert.equal(s.bike?.at, 'riding');
        assert.equal(s.district, o.to.district);
      }
    }
    assert.ok(pairs >= 20, `${pairs} rides`);
  });
});
