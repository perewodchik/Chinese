import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { libraryLeveler } from './budget';
import { festivalOf, weatherOf } from './calendar';
import { parseClothes } from './clothes';
import { libraryLexicon } from './dialogue/lexicon';
import { ScriptedDialogue } from './dialogue/scripted';
import { noticeAt, RED_NEW_YEAR, remarkAt } from './notice';
import { applyAll, newSave } from './save';
import type { Scene, WorldSave } from './types';

const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const parsed = parseClothes(read('content/world/clothes.json'));
assert.ok(parsed.ok);
const clothes = parsed.value;
const ctx = { now: 1 };

/** A save with friends, wearing `outfit` over the start clothes, on a day that fits `day`. */
function friendly(outfit: WorldSave['outfit'], day: (d: number) => boolean = (d) => !festivalOf(d)): WorldSave {
  let d = 1;
  while (!day(d)) d++;
  const s = applyAll(newSave('t', 0), [
    { do: 'meet', npc: 'wang-ayi' }, { do: 'hearts', npc: 'wang-ayi', delta: 2 },
    { do: 'meet', npc: 'lao-liu' }, { do: 'hearts', npc: 'lao-liu', delta: 1 },
    { do: 'meet', npc: 'stranger' },
  ], ctx);
  return { ...s, clock: (d - 1) * 1440 + 9 * 60, outfit: { ...s.outfit, ...outfit }, wardrobe: [...s.wardrobe, ...Object.values(outfit)] as string[] };
}

describe('people notice (§12 W6)', () => {
  it('the first friend talked to notices a new thing, once; strangers and old clothes say nothing', () => {
    const s = friendly({ top: 'sweater:green' });
    assert.equal(noticeAt(s, 'stranger', clothes), null, 'no heart, no remark');
    const n = noticeAt(s, 'wang-ayi', clothes)!;
    assert.equal(n.zh, '新衣服？真好看！');
    const after = applyAll(s, n.actions, ctx);
    assert.ok(after.npcs['wang-ayi']!.notes.includes('saw your new sweater'));
    assert.equal(noticeAt(after, 'lao-liu', clothes), null, 'noticed once, by one friend');
    assert.equal(noticeAt(friendly({}), 'wang-ayi', clothes), null, 'what you came in is not new');
  });

  it('each friend has their own way, and some things their own line', () => {
    assert.equal(noticeAt(friendly({ hat: 'cap:red' }), 'lao-liu', clothes)!.zh, '穿得很精神！');
    assert.equal(noticeAt(friendly({ top: 'qipao:blue' }), 'lao-liu', clothes)!.zh, '旗袍！真漂亮！');
  });

  it('red at 春节: a smile and a heart from each neighbour, once a festival', () => {
    const s = friendly({ top: 'tangzhuang:red' }, (d) => festivalOf(d)?.id === 'chunjie');
    const n = noticeAt(s, 'lao-liu', clothes)!;
    assert.equal(n.zh, RED_NEW_YEAR.zh);
    const after = applyAll(s, n.actions, ctx);
    assert.equal(after.npcs['lao-liu']!.hearts, 2);
    // then the new 唐装 is still news, and the smile is not given twice
    assert.equal(noticeAt(after, 'lao-liu', clothes)!.zh, '穿得很精神！');
  });

  it('comes before the person’s usual first line, as a talk starts', () => {
    const lib: Library = (() => {
      const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
      const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
      return { characters: chars, themes: [], components: {}, strokes: {}, byChar: new Map(chars.map((c) => [c.c, c])), words, byWord: new Map(words.map((w) => [w.w, w])) };
    })();
    const scene: Scene = { id: 'hi', map: 'm', npc: 'wang-ayi', trigger: 'talk', start: 'a', nodes: [{ id: 'a', say: '你好！', translate: 'Hello!' }] };
    const src = new ScriptedDialogue({ scenes: [scene], npcs: [], clothes }, libraryLexicon(lib));
    const t = src.start(scene, friendly({ bottom: 'skirt:red' }));
    assert.equal(t.chime?.zh, '新衣服？真好看！');
    assert.equal(t.say?.zh, '你好！');
    assert.ok(t.actions.some((a) => a.do === 'flag' && a.flag === 'noticed:skirt'));
    // the lines keep the budget (HSK 1–2; 精神, 鞋 and 帽子 are the situation's)
    const lv = libraryLeveler(lib);
    for (const zh of ['新衣服？真好看！', '穿得很精神！', '新鞋？很好看！', '新帽子？很好看！', '这个很好看！', RED_NEW_YEAR.zh]) {
      assert.deepEqual(lv(zh, new Set()).filter((w) => (w.level === 0 || w.level > 2) && !['精神', '过年', '鞋', '帽子', '红'].includes(w.w)).map((w) => w.w), [], zh);
    }
  });

  it('兔儿爷 remarks: a T-shirt in the snow, a 旗袍 under an umbrella, a hat indoors', () => {
    let snow = 1;
    while (weatherOf(snow) !== 'snow') snow++;
    let rain = 1;
    while (weatherOf(rain) !== 'rain') rain++;
    const on = (d: number, outfit: WorldSave['outfit']) => ({ ...friendly(outfit), clock: (d - 1) * 1440 + 600 });
    assert.equal(remarkAt(on(snow, { top: 'tshirt:white' }), 'street', false)?.kind, 'snow-tee');
    assert.equal(remarkAt(on(snow, { top: 'tshirt:white' }), 'inside', false), null);
    assert.equal(remarkAt(on(rain, { top: 'qipao:red' }), 'street', true)?.kind, 'rain-qipao');
    assert.equal(remarkAt(on(rain, { top: 'qipao:red' }), 'street', false), null);
    assert.equal(remarkAt(on(1, { hat: 'beanie:red' }), 'inside', false)?.kind, 'hat-inside');
    assert.equal(remarkAt(on(1, {}), 'inside', false), null);
  });
});
