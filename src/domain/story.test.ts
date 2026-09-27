import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseResponse } from './parse';
import { endingsOf, scenesOf, storyOf, storyProblem } from './story';
import type { TextLine } from './text';

const line = (v: unknown): TextLine | null =>
  v && typeof v === 'object' && typeof (v as { zh?: unknown }).zh === 'string'
    ? { zh: (v as { zh: string }).zh, py: '', en: '' }
    : null;

const tea = {
  start: 'a',
  nodes: {
    a: { lines: [{ zh: '你想喝什么？' }], choices: [{ zh: '喝茶', to: 'b' }, { zh: '喝咖啡', to: 'c' }] },
    b: { lines: [{ zh: '茶很好喝。' }], end: 'good' },
    c: { lines: [{ zh: '咖啡太热了。' }], choices: [{ zh: '等一下', to: 'b' }] },
  },
};

describe('stories with choices', () => {
  it('lays the nodes out in reading order, each line tagged with its node', () => {
    const told = storyOf(tea, line)!;
    assert.deepEqual(
      told.lines.map((l) => [l.node, l.zh]),
      [
        ['a', '你想喝什么？'],
        ['b', '茶很好喝。'],
        ['c', '咖啡太热了。'],
      ],
    );
    assert.deepEqual(endingsOf(told.story), ['b']);
  });

  it('refuses a story with a choice leading nowhere, a node nobody reaches, or no ending', () => {
    const broken = structuredClone(tea);
    broken.nodes.a.choices[0].to = 'x';
    assert.equal(storyOf(broken, line), null);
    const lost = structuredClone(tea) as typeof tea & { nodes: Record<string, unknown> };
    lost.nodes.d = { lines: [{ zh: '没有人来。' }], end: 'alone' };
    assert.equal(storyOf(lost, line), null);
    assert.match(storyProblem({ start: 'a', nodes: { a: { choices: [{ zh: '走', py: '', en: '', to: 'a' }] } } })!, /never ends/);
  });

  it('comes through the paste box as a passage whose lines are the story', () => {
    const raw = '```json\n' + JSON.stringify({ texts: [{ id: 't1', title: 'Tea', story: tea }] }) + '\n```';
    const [draft] = parseResponse(raw).drafts;
    assert.ok(draft.story);
    assert.equal(draft.lines.length, 3);
  });
});

describe('scenes', () => {
  it('keeps only what can be drawn, and an ask only about a thing that is there', () => {
    const scenes = scenesOf(
      [
        {
          para: 1,
          bg: 'home',
          things: [
            { w: '猫', x: 0.3, y: 0.7 },
            { w: '独角兽', x: 0.5, y: 0.5 },
          ],
          people: [{ who: 'chen', x: 0.8, y: 0.6 }],
          ask: { q: '猫在哪儿？', w: '猫' },
        },
        { bg: 'moon base', things: [{ w: '猫' }] },
      ],
      (w) => w === '猫',
    );
    assert.equal(scenes.length, 1);
    assert.deepEqual(scenes[0].things.map((t) => t.w), ['猫']);
    assert.equal(scenes[0].ask?.w, '猫');
    assert.equal(scenes[0].para, 1);
  });
});
