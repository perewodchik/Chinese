import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, SyllabusWord } from '../../data/types';
import { buildIme, candidates, parseTyped, rest } from './ime';

const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const ime = buildIme({
  characters: read<{ items: CharacterEntry[] }>('public/data/characters.json').items,
  words: read<{ items: SyllabusWord[] }>('public/data/words.json').items,
});
const top = (s: string, n = 3) => candidates(s, ime, n).map((c) => c.text);

describe('reading what was typed', () => {
  it('splits syllables with and without tone numbers', () => {
    const syl = (s: string) => parseTyped(s)?.map((t) => `${t.s}${t.tone ?? ''}${t.er ? 'r' : ''}${t.partial ? '…' : ''}`);
    assert.deepEqual(syl('nihao'), ['ni', 'hao']);
    assert.deepEqual(syl('ni3hao3'), ['ni3', 'hao3']);
    assert.deepEqual(syl('ni hao'), ['ni', 'hao']);
    assert.deepEqual(syl('nv3'), ['nv3']);
    assert.deepEqual(syl('lü4'), ['lv4']);
    assert.deepEqual(syl('nar'), ['nar']);
    assert.deepEqual(syl('na3r'), ['na3r']);
    assert.deepEqual(syl('er'), ['er']);
    assert.deepEqual(syl('nih'), ['ni', 'h…']);
    assert.deepEqual(syl("xi'an"), ['xi', 'an']);
    assert.equal(parseTyped('hello'), null);
    assert.equal(parseTyped(''), null);
  });
});

describe('candidates', () => {
  it('the whole word first, HSK 1–2 first', () => {
    assert.equal(top('nihao')[0], '你好');
    assert.equal(top('ni3hao3')[0], '你好');
    assert.equal(top('xiexie')[0], '谢谢');
    assert.equal(top('ditie')[0], '地铁');
    assert.equal(top('zaijian')[0], '再见');
  });

  it('a tone number narrows the choice', () => {
    assert.equal(top('mai3', 1)[0], '买');
    assert.equal(top('mai4', 1)[0], '卖');
    assert.ok(!top('ma3', 12).includes('吗'));
  });

  it('ü typed as v, and erhua', () => {
    assert.equal(top('nv3', 1)[0], '女');
    assert.equal(top('nar', 1)[0], '哪儿');
    assert.ok(top('na', 12).includes('哪'));
  });

  it('an unfinished syllable still finds the word', () => {
    assert.ok(top('nih', 5).includes('你好'));
    assert.ok(top('xiex', 5).includes('谢谢'));
  });

  it('offers the first character alone, and gives back the rest', () => {
    const cs = candidates('nihao', ime, 40);
    const ni = cs.find((c) => c.text === '你')!;
    assert.equal(ni.uses, 1);
    assert.equal(rest('nihao', ni.uses), 'hao');
    assert.equal(rest('ni3hao3', 1), 'hao3');
    assert.equal(cs[0]!.uses, 2);
  });

  it('nothing for what is not pinyin', () => {
    assert.deepEqual(candidates('hello', ime), []);
    assert.deepEqual(candidates('', ime), []);
  });
});
