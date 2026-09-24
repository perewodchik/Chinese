import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { familyOf, type CharFacts, type FamilyEdge } from './families';

const facts: Record<string, CharFacts> = {
  妈: { hsk: 1, py: 'mā', gloss: 'mum', freq: 900 },
  吗: { hsk: 1, py: 'ma', gloss: 'question particle', freq: 300 },
  骑: { hsk: 3, py: 'qí', gloss: 'to ride', freq: 1200 },
  语: { hsk: 1, py: 'yǔ', gloss: 'language', freq: 500 },
  说: { hsk: 1, py: 'shuō', gloss: 'to speak', freq: 100 },
};
const lookup = (g: string) => facts[g] ?? null;

describe('radical families', () => {
  it('splits the characters a radical gives meaning to from the ones it gives sound to', () => {
    const edges: FamilyEdge[] = [
      ['妈', '马', 's'],
      ['吗', '马', 's'],
      ['骑', '马', 'm'],
    ];
    const f = familyOf(edges, ['马'], lookup, {}, 7);
    assert.deepEqual(
      f.sections.map((s) => [s.role, s.branches[0].nodes.map((n) => n.g)]),
      [
        ['meaning', ['骑']],
        ['sound', ['吗', '妈']],
      ],
    );
    assert.equal(f.count, 3);
  });

  it('leaves out what is above the band, unless something in the band grows from it', () => {
    const edges: FamilyEdge[] = [
      ['吾', '口', 'm'],
      ['语', '吾', 's'],
      ['骑', '口', 'p'],
    ];
    const f = familyOf(edges, ['口'], lookup, { 吾: { py: 'wú', d: 'I' } }, 2);
    assert.equal(f.sections.length, 1);
    const [wu] = f.sections[0].branches[0].nodes;
    assert.equal(wu.g, '吾');
    assert.equal(wu.kind, 'part');
    assert.equal(wu.py, 'wú');
    assert.deepEqual(
      wu.children.map((n) => [n.g, n.role]),
      [['语', 'sound']],
    );
    assert.equal(f.count, 1);
  });

  it('keeps each form of a radical as its own branch, and only the forms in use', () => {
    const edges: FamilyEdge[] = [
      ['说', '讠', 'm'],
      ['语', '讠', 'm'],
    ];
    const f = familyOf(edges, ['讠', '言'], lookup, {}, 7);
    assert.deepEqual(f.forms, ['讠']);
    assert.deepEqual(
      f.sections[0].branches[0].nodes.map((n) => n.g),
      ['说', '语'],
    );
  });
});
