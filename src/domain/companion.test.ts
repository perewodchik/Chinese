import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beatAt, beatCount, beatFromQuery, canRelive, castOf, guideOf, mixedOrder, partsOf, scenesOf, wordsSaid, type GuideChapter } from './companion';
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

// The cases below are sentences from the learner's own chapters of 西游记,
// where the first version of the rule gave a line to the wrong person.

test('a name or an inscription in quotation marks is told, not said', () => {
  for (const zh of ['海上有一座很有名的山，叫“花果山”。', '有一天，“轰隆”一声，石头开了！', '房子里有一块大石头，上面写着三个字：“水帘洞”。', '石猴过了桥，发现前面有座石房，中间有一块石碣，写着：“花果山福地，水帘洞洞天。”']) {
    assert.deepEqual(partsOf(line(zh), cast, null).parts.map((p) => p.kind), ['told'], zh);
  }
});

test('the one acting speaks, not the one spoken to or pointed at', () => {
  const who = (zh: string) => partsOf(line(zh), cast, null).parts.find((p) => p.kind === 'said')?.who?.id;
  assert.equal(who('祖师生气了，手持戒尺，指着孙悟空说：“你这猢狲，这也不学，那也不学，要做什么？”'), 'bodhi');
  assert.equal(who('一天，美猴王对众猴说：“我要去学长生不老的道法。”'), 'wukong');
  assert.equal(who('猴子们都同意了，一起对石猴说：“大王好！”'), 'troop');
  assert.equal(who('祖师说不能，悟空就说：“不学！不学！”'), 'wukong');
  assert.equal(who('小鬼们吓坏了，跑去告诉大王：“不好了！外面一只猴子打进来了！”'), 'ghosts');
});

test('someone the cast does not know is no one, not the last person named', () => {
  const zh = '那个人说：“你好。”';
  assert.equal(partsOf(line(zh), cast, { id: 'wukong', name: '孙悟空' }).parts[1]!.who, null);
});

test('他 and a sentence with no one named point back to whom the paragraph is about', () => {
  const text = { genre: 'story', lines: [line('过了一会儿，两个神仙回来了。', true), line('他们说：“花果山上出生了一只石猴。”'), line('然后，把簿子一扔，说：“了账！”')] } as GeneratedText;
  const [scene] = scenesOf(text, cast);
  assert.equal(scene!.beats[1]!.parts[1]!.who?.id, 'gods');
  assert.equal(scene!.beats[2]!.parts[1]!.who?.id, 'gods');
});

const chapter = (n: number, lines: TextLine[], vocab: Array<{ w: string; py: string; d: string }> = []): GuideChapter => ({ n, page: n + 1, text: { genre: 'story', lines, vocab } });

test('the guide has only what the read chapters have, people in the order they come in', () => {
  const g = guideOf('西游记', [
    chapter(1, [line('花果山上有一只石猴。', true), line('老猴子说：“谁敢进去？”'), line('石猴说：“我进去！”')], [{ w: '花果山', py: 'Huāguǒshān', d: 'the Mountain of Flowers and Fruit' }]),
  ])!;
  assert.deepEqual(g.people.map((p) => p.member.id), ['wukong', 'old']);
  assert.deepEqual(g.people[0]!.lines.map((l) => l.zh), ['“我进去！”']);
  assert.deepEqual(g.people[0]!.lines[0]!.line, 2);
  assert.deepEqual(g.places.map((p) => [p.name, p.py, p.first.n]), [['花果山', 'Huāguǒshān', 1]]);
  assert.equal(g.things.length, 0);
  assert.equal(guideOf('十万个为什么', []), null);
});

test('a hero’s names are gathered in the order the book first uses them', () => {
  const g = guideOf('西游记', [chapter(1, [line('石猴成了美猴王。', true)]), chapter(2, [line('祖师给他起名叫孙悟空。', true), line('祖师说：“悟空，过来。”')])])!;
  assert.deepEqual(g.people.find((p) => p.member.id === 'wukong')!.names, ['石猴', '美猴王', '孙悟空', '悟空']);
});

test('places come in the order of the journey, whatever order they are met in', () => {
  const g = guideOf('西游记', [chapter(1, [line('他从三星洞回到了花果山。', true)])])!;
  assert.deepEqual(g.places.map((p) => p.entry.id), ['huaguoshan', 'sanxingdong']);
});

test('a beat from the address stays inside the chapter', () => {
  assert.equal(beatFromQuery('3', 10), 3);
  assert.equal(beatFromQuery('40', 10), 9);
  assert.equal(beatFromQuery('-1', 10), 0);
  assert.equal(beatFromQuery('x', 10), 0);
  assert.equal(beatFromQuery(null, 10), 0);
});

test('the words said are the chapter’s own, with who said them, and no names', () => {
  const text = { genre: 'story', lines: [line('老猴子说：“谁敢进去看看？”', true), line('石猴说：“我进去！花果山真好。”')], vocab: [{ w: '进去', py: 'jìnqu', d: 'to go in' }, { w: '花果山', py: 'Huāguǒshān', d: 'the mountain' }, { w: '看看', py: 'kànkan', d: 'to have a look' }] } as GeneratedText;
  assert.deepEqual(wordsSaid(text, cast, '西游记').map((w) => [w.w, w.who.id]), [['进去', 'old'], ['看看', 'old']]);
});

test('the pictures are mixed into a real reordering: each once, never the story’s order', () => {
  for (let n = 3; n <= 12; n++) {
    const m = mixedOrder(n);
    assert.deepEqual([...m].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i), `n=${n}`);
    assert.notDeepEqual(m, Array.from({ length: n }, (_, i) => i), `n=${n}`);
  }
  assert.deepEqual(mixedOrder(2), [0, 1]);
});

test('a place’s reading is made of its listed parts, and left out rather than guessed', () => {
  const g = guideOf('西游记', [chapter(1, [line('他去了东海龙宫，想学长生。', true)], [{ w: '东海', py: 'Dōnghǎi', d: 'the Eastern Sea' }, { w: '龙宫', py: 'lónggōng', d: 'the Dragon Palace' }])])!;
  assert.equal(g.places.find((p) => p.entry.id === 'longgong')!.py, 'Dōnghǎi lónggōng');
  assert.equal(g.things.find((t) => t.entry.id === 'changsheng')!.py, '');
});
