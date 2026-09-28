import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { checkScene, formatProblem, libraryLeveler } from '../../src/world/core/budget';
import type { DistrictContent, NpcCard, Scene } from '../../src/world/core/types';
import { checkContent, readLibrary } from './check-content';

const lib = readLibrary();
const leveler = libraryLeveler(lib);

const npc = (id: string, explains: Record<string, string> = {}): NpcCard => ({
  id,
  name: id,
  role: 'someone',
  look: { sprite: 'base' },
  character: 'Calm.',
  knows: [],
  wants: [],
  actions: [],
  routine: [],
  explains,
});

const district = (scenes: Scene[], npcs: NpcCard[] = [npc('uncle'), npc('auntie', { 附近: '就是不远的地方' })]): DistrictContent => ({
  district: { id: 'gulou', name: '鼓楼', en: 'Drum Tower', chapter: 1, maps: ['m'], stations: [], names: ['南锣鼓巷', '王阿姨'] },
  npcs,
  scenes,
  quests: [],
  spirits: [],
  idioms: [
    { id: '马马虎虎', pinyin: 'mǎmǎhūhū', parts: [{ c: '马', gloss: 'horse' }], meaning: 'so-so', story: { zh: '……', en: '…' }, tier: 'basic' },
  ],
  stamps: [],
  items: [],
});

const scene = (nodes: Scene['nodes'], extra: Partial<Scene> = {}): Scene => ({
  id: 's',
  map: 'm',
  npc: 'uncle',
  trigger: 'talk',
  start: nodes[0]!.id,
  nodes,
  ...extra,
});

const check = (s: Scene, c = district([s])) => checkScene(s, c, { leveler, all: [c] }, 'gulou/scenes.json');
const errors = (s: Scene, c?: DistrictContent) => check(s, c).filter((p) => p.severity === 'error');

describe('the word budget', () => {
  it('lets HSK 1 and one HSK 2 word through a normal line', () => {
    assert.deepEqual(errors(scene([{ id: 'a', say: '你好！你想吃什么？', translate: '' }])), []);
    assert.deepEqual(errors(scene([{ id: 'a', say: '我们坐地铁去吧。', translate: '' }])), []);
  });

  it('names and place names do not count', () => {
    assert.deepEqual(errors(scene([{ id: 'a', say: '王阿姨住在南锣鼓巷。', translate: '' }])), []);
  });

  it('refuses HSK 3+ in a normal line, naming the node, word and level', () => {
    const [p, ...rest] = errors(scene([{ id: 'dir', say: '地铁站在附近。', translate: '' }]));
    assert.equal(rest.length, 0);
    assert.equal(p!.node, 'dir');
    assert.equal(p!.word, '附近');
    assert.equal(p!.level, 3);
    assert.match(formatProblem(p!), /gulou\/scenes\.json · s\/dir \(say\): 附近 \[HSK 3\]:/);
  });

  it('refuses two HSK 2 words in one normal line', () => {
    const ps = errors(scene([{ id: 'a', say: '地铁比公共汽车快。', translate: '' }]));
    assert.ok(ps.some((p) => /HSK 2 words — at most one/.test(p.message)), ps.map(formatProblem).join('\n'));
  });

  it('a key line may hold up to three hard words, each explained by another NPC', () => {
    assert.deepEqual(errors(scene([{ id: 'k', key: true, say: '地铁站在附近。', translate: '' }])), []);
    const lonely = district([], [npc('uncle', { 附近: '就是不远的地方' })]);
    const s = scene([{ id: 'k', key: true, say: '地铁站在附近。', translate: '' }]);
    lonely.scenes.push(s);
    const ps = errors(s, lonely);
    assert.equal(ps.length, 1);
    assert.match(ps[0]!.message, /no other NPC explains it/);
  });

  it('a 成语 only in a key line, and only one', () => {
    assert.deepEqual(errors(scene([{ id: 'k', key: true, say: '他做事马马虎虎。', translate: '' }])), []);
    const ps = errors(scene([{ id: 'n', say: '他做事马马虎虎。', translate: '' }]));
    assert.match(ps[0]!.message, /成语 only belongs in a 📌 key line/);
  });

  it('situation words are free, but said at least twice, at most eight', () => {
    const words = [
      { w: '感冒', explain: '身体不舒服', en: 'a cold' },
      { w: '发烧', explain: '身体很热', en: 'fever' },
      { w: '药', explain: '吃了身体会好', en: 'medicine' },
    ];
    const ok = scene(
      [
        { id: 'a', say: '你感冒了吗？发烧吗？', translate: '' },
        { id: 'b', say: '感冒了？吃这个药。发烧也吃这个药。', translate: '' },
      ],
      { words },
    );
    assert.deepEqual(errors(ok), []);
    const once = scene([{ id: 'a', say: '你感冒了吗？发烧吗？吃药吧。', translate: '' }], { words });
    const ps = errors(once);
    assert.deepEqual(ps.map((p) => p.word).sort(), ['发烧', '感冒', '药']);
    const many = scene([{ id: 'a', say: '你好', translate: '' }], {
      words: Array.from({ length: 9 }, (_, i) => ({ w: `词${i}`, explain: '就是这个', en: 'x' })),
    });
    assert.ok(errors(many).some((p) => /9 situation words/.test(p.message)));
  });

  it('checks the simpler line and the hint sentence too', () => {
    const ps = errors(scene([{ id: 'a', say: '你好！', simpler: '附近有吗？', hint: { word: '附近', frame: '___', full: '附近有地铁吗？' }, translate: '' }]));
    assert.deepEqual(ps.map((p) => p.field), ['simpler', 'hint']);
  });

  it('warns about fewer than three situation words, without failing', () => {
    const s = scene([{ id: 'a', say: '交通卡在这儿买。交通卡二十块。', translate: '' }], { words: [{ w: '交通卡', explain: '坐地铁用的卡', en: 'transit card' }] });
    const ps = check(s);
    assert.equal(ps.filter((p) => p.severity === 'error').length, 0);
    assert.equal(ps.filter((p) => p.severity === 'warning').length, 1);
  });
});

describe('checking the content folder', () => {
  it('the real content/world passes', () => {
    const r = checkContent('content/world', lib);
    const bad = [...r.errors, ...r.budget.filter((p) => p.severity === 'error').map(formatProblem)];
    assert.deepEqual(bad, []);
  });

  it('finds schema, reference and budget errors in a folder', () => {
    const root = mkdtempSync(join(tmpdir(), 'world-content-'));
    mkdirSync(join(root, 'gulou'));
    const w = (f: string, v: unknown) => writeFileSync(join(root, 'gulou', f), JSON.stringify(v));
    w('district.json', { id: 'gulou', name: '鼓楼', en: 'Drum Tower', chapter: 1, maps: ['m'], stations: [], names: [] });
    w('npcs.json', [npc('uncle')]);
    w('scenes.json', [
      { id: 'a', map: 'm', npc: 'uncle', trigger: 'talk', start: 'x', nodes: [{ id: 'x', say: '地铁站在附近。', translate: 'near' }] },
      { id: 'b', map: 'm', npc: 'nobody', trigger: 'talk', start: 'x', nodes: [{ id: 'x', say: '你好', translate: 'hi' }] },
    ]);
    const r = checkContent(root, lib);
    assert.deepEqual(r.errors, ['gulou/scenes.json[1].npc: unknown npc "nobody"']);
    assert.equal(r.budget.length, 1);
    assert.equal(r.budget[0]!.word, '附近');
  });
});
