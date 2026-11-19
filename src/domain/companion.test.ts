import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beatAt, beatCount, canRelive, castOf, partsOf, scenesOf } from './companion';
import type { GeneratedText, TextLine } from './text';

const cast = castOf('西游记')!;
const line = (zh: string, p = false, who?: string): TextLine => ({ zh, py: '', en: '', p, who });
const slice = (zh: string, from: number, to: number) => [...zh].slice(from, to).join('');

test('only a book with a cast has a companion', () => {
  assert.ok(castOf('西游记'));
  assert.ok(castOf(' 西游记 '));
  assert.equal(castOf('十万个为什么'), null);
});

test('a chapter can be relived once either version has been read', () => {
  const t = (read: boolean) => ({ read }) as GeneratedText;
  assert.equal(canRelive({ main: t(false), easier: t(false) }), false);
  assert.equal(canRelive({ main: t(false), easier: t(true) }), true);
  assert.equal(canRelive({ main: t(true), easier: null }), true);
});

test('a quotation is said by the person the sentence names before it', () => {
  const zh = '老猴子说：“谁敢进去？”';
  const { parts } = partsOf(line(zh), cast, null);
  assert.deepEqual(parts.map((p) => p.kind), ['told', 'said']);
  assert.equal(slice(zh, parts[0]!.from, parts[0]!.to), '老猴子说：');
  assert.equal(slice(zh, parts[1]!.from, parts[1]!.to), '“谁敢进去？”');
  assert.deepEqual(parts[1]!.who, { id: 'old', name: '老猴子' });
});

test('the longest name wins, so 孙悟空 is not read as 悟空', () => {
  const { parts } = partsOf(line('孙悟空高兴地说：“我学！”'), cast, null);
  assert.deepEqual(parts[1]!.who, { id: 'wukong', name: '孙悟空' });
});

test('a quotation with nobody named in its sentence goes to the last person named in the paragraph', () => {
  const text = { genre: 'story', lines: [line('石猴跳了起来。', true), line('“我进去！我进去！”')] } as GeneratedText;
  const [scene] = scenesOf(text, cast);
  assert.deepEqual(scene!.beats[1]!.parts[0]!.who, { id: 'wukong', name: '石猴' });
});

test('a new paragraph starts with nobody named', () => {
  const text = { genre: 'story', lines: [line('石猴很高兴。', true), line('“我们走吧！”', true)] } as GeneratedText;
  const scenes = scenesOf(text, cast);
  assert.equal(scenes.length, 2);
  assert.equal(scenes[1]!.beats[0]!.parts[0]!.who, null);
});

test('two speakers in one sentence each get their own line', () => {
  const zh = '祖师问：“你想学什么？”悟空说：“我想学长生。”';
  const { parts } = partsOf(line(zh), cast, null);
  const said = parts.filter((p) => p.kind === 'said');
  assert.deepEqual(said.map((p) => p.who?.id), ['bodhi', 'wukong']);
  assert.equal(parts.map((p) => slice(zh, p.from, p.to)).join(''), zh, 'nothing of the sentence is lost');
});

test('the writer’s own speaker on a line wins, and a line without marks is then said whole', () => {
  const { parts } = partsOf(line('我想学长生。', false, '悟空'), cast, null);
  assert.deepEqual(parts, [{ kind: 'said', from: 0, to: 6, who: { id: 'wukong', name: '悟空' } }]);
});

test('a sentence with no quotation is told', () => {
  const { parts } = partsOf(line('花果山上有很多猴子。'), cast, null);
  assert.deepEqual(parts.map((p) => p.kind), ['told']);
});

test('an unclosed quotation runs to the end of the sentence', () => {
  const zh = '老猴子说：“谁敢进去';
  const { parts } = partsOf(line(zh), cast, null);
  assert.equal(parts[1]!.to, [...zh].length);
});

test('beats are counted across scenes and found again', () => {
  const text = { genre: 'story', lines: [line('一。', true), line('二。'), line('三。', true)] } as GeneratedText;
  const scenes = scenesOf(text, cast);
  assert.equal(beatCount(scenes), 3);
  assert.deepEqual(beatAt(scenes, 2), { scene: 1, beat: 0 });
  assert.equal(beatAt(scenes, 3), null);
});
