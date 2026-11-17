import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lookup, lookupRank, type LookupEntry } from './lookup';

const e = (zh: string, py: string, def: string): LookupEntry => ({ zh, py: [py], def });
const hao = e('好', 'hǎo', 'good; well; fine; OK');
const shao = e('少', 'shǎo', 'few; little');
const hai = { zh: '还', py: ['hái', 'huán'], def: 'still; yet; to return' };
const pengyou = e('朋友', 'péng you', 'friend');
const nihao = e('你好', 'nǐ hǎo', 'hello; hi');
const goods = e('货', 'huò', 'goods; money');

describe('looking a character or a word up', () => {
  it('pinyin is matched by the syllable: hao is 好 and never shǎo', () => {
    assert.equal(lookupRank('hao', hao), 0);
    assert.equal(lookupRank('hao', shao), null);
    assert.equal(lookupRank('ha', hao), 1);
    assert.equal(lookupRank('HAO ', hao), 0);
  });

  it('any reading of a character counts, tone marks typed or not', () => {
    assert.equal(lookupRank('huan', hai), 0);
    assert.equal(lookupRank('hái', hai), 0);
  });

  it('a word by its pinyin written together, apart, or from a later syllable', () => {
    assert.equal(lookupRank('pengyou', pengyou), 0);
    assert.equal(lookupRank('peng you', pengyou), 0);
    assert.equal(lookupRank('peng', pengyou), 1);
    assert.equal(lookupRank('you', pengyou), 2);
    assert.equal(lookupRank('ngyou', pengyou), null);
    assert.equal(lookupRank('hao', nihao), 2);
  });

  it('English by the word: a whole sense, a word of one, the start of a word', () => {
    assert.equal(lookupRank('good', hao), 0);
    assert.equal(lookupRank('good', goods), 2);
    assert.equal(lookupRank('return', hai), 0);
    assert.equal(lookupRank('ood', hao), null);
    assert.equal(lookupRank('measure word', e('个', 'gè', 'the general measure word; individual')), 1);
  });

  it('Chinese: the thing itself, what starts with it, what holds it, and a word’s own characters', () => {
    assert.equal(lookupRank('好', hao), 0);
    assert.equal(lookupRank('你', nihao), 1);
    assert.equal(lookupRank('好', nihao), 2);
    assert.equal(lookupRank('你好', hao), 2);
    assert.equal(lookupRank('你好', pengyou), null);
  });

  it('the best first, the rest in the order they came', () => {
    const found = lookup('good', [goods, shao, hao, e('良', 'liáng', 'good; fine')], (x) => x);
    assert.deepEqual(found.map((f) => f.entry.zh), ['好', '良', '货']);
  });

  it('nothing typed finds nothing', () => {
    assert.equal(lookupRank('  ', hao), null);
  });
});
