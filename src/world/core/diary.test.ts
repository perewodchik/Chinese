import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { checkScene, libraryLeveler } from './budget';
import { DIARY_PER_DAY, DIARY_SCENE, diaryDays, diaryLines, EMPTY_DAY, logDay, type Names } from './diary';
import { readSave } from './migrate';
import { merge } from './merge';
import { applyAll, newSave } from './save';
import type { DistrictContent } from './types';

const ctx = { now: 1 };
const names: Names = {
  npc: (id) => ({ 'wang-ayi': '王阿姨', 'zhao-yeye': '赵爷爷' })[id],
  item: (id) => ({ baozi: { zh: '包子', en: 'a steamed bun' }, tanghulu: { zh: '糖葫芦', en: 'candied haws' } })[id],
  spirit: (id) => (id === 'shishizi' ? { zh: '石狮子', en: 'the stone lion' } : undefined),
};

describe('the diary (X3)', () => {
  it('writes the day from what happened, each thing once', () => {
    let s = newSave('d', 0);
    s = applyAll(s, [
      { do: 'meet', npc: 'wang-ayi' },
      { do: 'meet', npc: 'wang-ayi' },
      { do: 'give', item: 'baozi' },
      { do: 'give', item: 'baozi' },
      { do: 'district', district: 'houhai' },
      { do: 'station', station: 'wangfujing' },
      { do: 'spirit', spirit: 'shishizi' },
      { do: 'idiom', idiom: '马马虎虎' },
    ], ctx);
    const [day] = diaryDays(s);
    assert.equal(day?.day, 1);
    assert.deepEqual(day?.codes, ['m:wang-ayi', 'x:baozi', 'd:houhai', 't:wangfujing', 's:shishizi', 'i:马马虎虎']);
    assert.deepEqual(diaryLines(day!.codes, names).map((l) => l.zh), [
      '我认识了王阿姨。',
      '我有了包子。',
      '今天我第一次去了什刹海和后海。',
      '我坐车到了王府井。',
      '我找到了石狮子！它现在是我的朋友。',
      '我听到了一个成语：马马虎虎。这个成语很有意思。',
    ]);
  });

  it('a present, a name, a good friend, and sleep close the day it ended', () => {
    let s = applyAll(newSave('d', 0), [{ do: 'give', item: 'tanghulu' }], ctx);
    s = applyAll(s, [{ do: 'gifted', npc: 'wang-ayi', item: 'tanghulu' }, { do: 'hearts', npc: 'wang-ayi', delta: 3 }], ctx);
    s = applyAll(s, [{ do: 'name', name: '小白' }], { ...ctx, npc: 'wang-ayi' });
    s = applyAll(s, [{ do: 'sleep' }], ctx);
    const codes = s.diary['1']!;
    assert.deepEqual(codes.slice(1), ['g:wang-ayi:tanghulu', 'f:wang-ayi', 'n:wang-ayi:小白', 'z']);
    assert.deepEqual(diaryLines(codes.slice(1), names).map((l) => l.zh), ['我给了王阿姨糖葫芦。', '王阿姨和我是好朋友了。', '我告诉王阿姨，我叫小白。', '晚上我在家睡觉了。']);
    assert.equal(s.diary['2'], undefined);
  });

  it('leaves out what it cannot name, and an empty day says so', () => {
    assert.deepEqual(diaryLines(['m:nobody', 'x:nothing'], names), [EMPTY_DAY]);
  });

  it('a festival day opens with the festival (X4)', () => {
    assert.deepEqual(diaryLines(['m:wang-ayi'], names, 3).map((l) => l.zh), ['今天是中秋节。', '我认识了王阿姨。']);
    assert.deepEqual(diaryLines([], names, 3).map((l) => l.zh), ['今天是中秋节。']);
  });

  it('keeps a day short', () => {
    let s = newSave('d', 0);
    for (let i = 0; i < 40; i++) s = logDay(s, [`x:thing${i}`]);
    assert.equal(s.diary['1']!.length, DIARY_PER_DAY);
  });

  it('the templates keep the word budget', () => {
    const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
    const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
    const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
    const lib: Library = { characters: chars, themes: [], components: {}, strokes: {}, byChar: new Map(chars.map((c) => [c.c, c])), words, byWord: new Map(words.map((w) => [w.w, w])) };
    const c = { district: { id: 'diary', name: '', en: '', chapter: 1, maps: [], stations: [], names: [] }, npcs: [], scenes: [DIARY_SCENE], quests: [], spirits: [], idioms: [], stamps: [], items: [] } as DistrictContent;
    const problems = checkScene(DIARY_SCENE, c, { leveler: libraryLeveler(lib), all: [c] }, 'diary.ts').filter((p) => p.severity === 'error');
    assert.deepEqual(problems, []);
  });

  it('a version 3 save gains an empty diary; two devices merge their days', () => {
    const r = readSave({ ...newSave('d', 0), version: 3, diary: undefined });
    assert.ok(r.ok && r.save.diary && Object.keys(r.save.diary).length === 0);
    const a = { ...newSave('a', 0), updatedAt: 5, diary: { '1': ['m:wang-ayi', 'z'] } };
    const b = { ...newSave('b', 0), updatedAt: 9, diary: { '1': ['m:wang-ayi', 'x:baozi'], '2': ['z'] } };
    assert.deepEqual(merge(a, b).diary, merge(b, a).diary);
    assert.deepEqual(merge(a, b).diary['1'], ['m:wang-ayi', 'x:baozi', 'z']);
    assert.deepEqual(merge(a, b).diary['2'], ['z']);
  });
});
