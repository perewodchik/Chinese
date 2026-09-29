import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { libraryLeveler } from './budget';
import { dayOf } from './clock';
import { festivalOf, seasonOf } from './calendar';
import { parseClothes } from './clothes';
import { libraryLexicon } from './dialogue/lexicon';
import { ScriptedDialogue } from './dialogue/scripted';
import type { Turn, Utterance } from './dialogue/source';
import { RACK_LINES, rackBargain, rackScene, rackScenes, rackStock, SHORTER } from './rack';
import { applyAll, newSave } from './save';
import type { WorldSave } from './types';
import type { ClothesContent } from './wardrobe';

const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
const lib: Library = { characters: chars, themes: [], components: {}, strokes: {}, byChar: new Map(chars.map((c) => [c.c, c])), words, byWord: new Map(words.map((w) => [w.w, w])) };
const parsed = parseClothes(read('content/world/clothes.json'));
assert.ok(parsed.ok);
const clothes: ClothesContent = parsed.value;
const lex = libraryLexicon(lib);
const src = new ScriptedDialogue({ scenes: rackScenes(clothes), npcs: [], clothes }, lex);
const ctx = { now: 1 };
const scene = (id: string) => rackScene(clothes.racks.find((r) => r.id === id)!, clothes);

/** A save with money, on a day in the given season (no festival unless asked). */
function saveOn(season: 'winter' | 'summer' | 'spring' | 'autumn', festival?: string, money = 1000): WorldSave {
  let day = 1;
  while (seasonOf(day) !== season || (festival ? festivalOf(day)?.id !== festival : !!festivalOf(day))) day++;
  const s = newSave('t', 0);
  return { ...s, clock: (day - 1) * 1440 + 10 * 60, bag: { ...s.bag, money } };
}

/** Say things in turn; the save follows the actions. */
function talk(sceneId: string, save: WorldSave, lines: Array<string | Utterance>) {
  let t: Turn = src.start(scene(sceneId), save);
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

describe('clothes racks (§12 W5)', () => {
  it('a rack is looked through, asked about, tried on, bought and worn out', () => {
    const s0 = saveOn('spring');
    const { t, s, heard } = talk('ruifuxiang', s0, [
      '这件旗袍多少钱？',
      '有绿的吗？',
      '有紫的吗？',
      '我可以试试吗？',
      '太贵了',
      '我要这件',
      { text: '', via: 'keyboard', paid: 500 },
      '穿着走',
    ]);
    assert.equal(heard[0], RACK_LINES.hello.zh);
    assert.equal(heard[1], '旗袍五百块。有红的、蓝的、绿的、黑的。');
    assert.equal(heard[2], '有！绿的。');
    assert.match(heard[3]!, /^没有紫的，有红的、蓝的、绿的、黑的。$/);
    assert.equal(heard[4], RACK_LINES.try.zh);
    assert.equal(heard[5], RACK_LINES.firm.zh, 'only 潘家园 bargains');
    assert.equal(heard[6], '一共五百块。');
    // a cashier's 付款码 (瑞蚨祥): the till says it, then the thanks
    assert.equal(heard[7], `支付宝到账，五百元。 ${RACK_LINES.thanks.zh}`);
    assert.equal(heard[8], RACK_LINES.wear.zh);
    assert.ok(t.end);
    assert.equal(s.bag.money, s0.bag.money - 500);
    assert.ok(s.wardrobe.includes('qipao:green'));
    assert.equal(s.outfit.top, 'qipao:green');
    const diary = JSON.stringify(s.diary);
    assert.match(diary, /一件绿旗袍/);
    assert.ok(s.scenes.includes('rack-ruifuxiang'));
  });

  it('a card tapped on the sheet is looked at; a bag instead of wearing it; the wardrobe keeps it', () => {
    const { s, heard } = talk('baihuo-2', saveOn('spring'), [{ text: '', via: 'keyboard', choice: 'skirt:blue' }, '我要这条', { text: '', via: 'keyboard', paid: 90 }, '不用，放袋子里']);
    assert.equal(heard[1], '裙子九十块。有红的、蓝的、黑的、粉的。');
    assert.equal(heard[4], RACK_LINES.bag.zh);
    assert.ok(s.wardrobe.includes('skirt:blue'));
    assert.notEqual(s.outfit.bottom, 'skirt:blue', 'changing happens at home');
  });

  it('asks which one, says what is not sold here, and hears 「我要红的」 as a colour and a purchase', () => {
    const { heard, t } = talk('lining', saveOn('spring'), ['多少钱？', '我要旗袍', 'T恤多少钱？', '我要红的']);
    assert.equal(heard[1], RACK_LINES.which.zh);
    assert.equal(heard[2], RACK_LINES.none.zh);
    assert.equal(t.state.due?.clothes?.id, 'tshirt:red');
  });

  it('stock follows the seasons and 春节: 羽绒服 and 毛线帽 in winter, 草帽 in summer, the red 毛衣 at New Year', () => {
    const baihuo = clothes.racks.find((r) => r.id === 'baihuo-1')!;
    const hats = clothes.racks.find((r) => r.id === 'shengxifu')!;
    assert.ok(rackStock(baihuo, clothes, saveOn('winter')).some((x) => x.startsWith('down-jacket:')));
    assert.ok(!rackStock(baihuo, clothes, saveOn('summer')).some((x) => x.startsWith('down-jacket:')));
    assert.ok(rackStock(hats, clothes, saveOn('summer')).includes('straw:yellow'));
    assert.ok(!rackStock(hats, clothes, saveOn('summer')).some((x) => x.startsWith('beanie:')));
    assert.ok(!rackStock(baihuo, clothes, saveOn('winter')).includes('sweater:red'));
    assert.ok(rackStock(baihuo, clothes, saveOn('winter', 'chunjie')).includes('sweater:red'));
    const { heard } = talk('baihuo-1', saveOn('summer'), ['羽绒服多少钱？']);
    assert.equal(heard[1], '现在没有羽绒服。');
    assert.ok(dayOf(saveOn('summer').clock) > 0);
  });

  it('not enough money: a kind word, and nothing is sold', () => {
    const { t, s } = talk('baihuo-2', saveOn('spring', undefined, 50), ['西装多少钱？', '我要这件']);
    assert.equal(t.intent, 'short');
    assert.equal(t.state.due, undefined);
    assert.equal(s.bag.money, 50);
  });

  it('潘家园 bargains with Y6’s engine, and the deal is what is paid', () => {
    const b = rackBargain(clothes.clothes.find((c) => c.id === 'zhongshan')!);
    assert.deepEqual(b, { open: 120, limit: 75 });
    const { s, heard, t } = talk('jiuyi', saveOn('spring'), ['中山装多少钱？', '太贵了', '七十五块行吗？', '七十五块行吗？', { text: '', via: 'keyboard', paid: 75 }, '穿着走']);
    assert.match(heard[2]!, /^好吧/);
    assert.match(heard[4]!, /扫这儿吧/);
    assert.ok(t.end);
    assert.equal(s.bag.money, 1000 - 75);
    assert.equal(s.outfit.top, 'zhongshan:grey');
  });

  it('the barber: 剪短一点, a style by name, a colour — paid, and your hair changes', () => {
    const s0 = saveOn('spring');
    const cut = talk('lifadian', s0, ['剪短一点', '好', { text: '', via: 'keyboard', paid: 30 }]);
    assert.equal(cut.heard[1], '寸头，三十块。好吗？');
    assert.equal(cut.s.look.hair.style, SHORTER.short);
    assert.equal(cut.s.bag.money, s0.bag.money - 30);
    assert.ok(cut.t.end);
    const dye = talk('lifadian', s0, ['我要马尾，染成棕色', '多少钱？', '行', { text: '', via: 'keyboard', paid: 70 }]);
    assert.equal(dye.heard[2], '七十块。');
    assert.deepEqual(dye.s.look.hair, { style: 'ponytail', colour: 'brown' });
    const same = talk('lifadian', s0, ['我要短发']);
    assert.equal(same.heard[1], RACK_LINES.sameHair.zh);
  });

  it('💡 walks a rack from looking to wearing it out, and a patient player gets there', () => {
    let t = src.start(scene('huili'), saveOn('spring'));
    const said: string[] = [];
    for (let i = 0; i < 8 && !t.state.ended; i++) {
      const a = src.answer(t.state)!;
      said.push(a.text || `paid ${a.paid}`);
      t = src.reply(t.state, a);
    }
    assert.deepEqual(said, ['这双回力鞋多少钱？', '我可以试试吗？', '我要这双。', 'paid 80', '我穿着走。']);
    assert.ok(t.state.ended);
  });

  it('the seller’s own lines keep the word budget (HSK 1–2, plus the situation words 随便 试衣间 袋子 染)', () => {
    const lv = libraryLeveler(lib);
    const situation = new Set(['随便', '试', '试衣间', '袋子', '染', '剪', '穿着', '头发']);
    for (const l of Object.values(RACK_LINES)) {
      const ws = lv(l.zh, situation);
      assert.deepEqual(ws.filter((w) => (w.level === 0 || w.level > 2) && !situation.has(w.w)).map((w) => w.w), [], l.zh);
    }
  });
});
