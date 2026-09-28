import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, SyllabusWord } from '../../data/types';
import { buildIme } from '../core/ime';
import { fieldCandidates, hintChips, pickCandidate, splitField, startMode } from './typing';

const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const ime = buildIme({
  characters: read<{ items: CharacterEntry[] }>('public/data/characters.json').items,
  words: read<{ items: SyllabusWord[] }>('public/data/words.json').items,
});

describe('the field and the pinyin input', () => {
  it('finds the pinyin being typed at the end of the field', () => {
    assert.deepEqual(splitField('请问ditie'), { head: '请问', tail: 'ditie' });
    assert.deepEqual(splitField('我想去 ni hao '), { head: '我想去 ', tail: 'ni hao' });
    assert.deepEqual(splitField('地铁站在哪儿？'), { head: '地铁站在哪儿？', tail: '' });
    assert.deepEqual(splitField('ni3hao3'), { head: '', tail: 'ni3hao3' });
  });

  it('offers 地铁 for ditie and puts it in place of the pinyin', () => {
    const c = fieldCandidates('请问ditie', ime);
    const ditie = c.find((x) => x.text === '地铁');
    assert.ok(ditie);
    assert.equal(pickCandidate('请问ditie', ditie), '请问地铁');
  });

  it('picking a shorter word leaves the rest of the pinyin', () => {
    const ni = fieldCandidates('nihao', ime).find((x) => x.text === '你');
    assert.ok(ni);
    assert.equal(pickCandidate('nihao', ni), '你hao');
  });

  it('offers nothing for hanzi only', () => {
    assert.deepEqual(fieldCandidates('你好', ime), []);
  });
});

describe('hint chips', () => {
  const hint = { word: '地铁', frame: '请问，___在哪儿？', full: '请问，地铁站在哪儿？' };
  it('go word → frame with the word in its gap → whole sentence', () => {
    assert.deepEqual(hintChips(hint, 0), []);
    assert.deepEqual(hintChips(hint, 1), [{ text: '地铁', key: true }]);
    assert.deepEqual(hintChips(hint, 2).map((c) => c.text), ['请问，', '地铁', '在哪儿？']);
    assert.deepEqual(hintChips(hint, 3), [{ text: '请问，地铁站在哪儿？', key: true }]);
    assert.deepEqual(hintChips(undefined, 2), []);
  });
});

describe('the input mode', () => {
  it('this device first, then the save, never voice without a listener', () => {
    assert.equal(startMode('keyboard', 'voice', true), 'keyboard');
    assert.equal(startMode(null, 'voice', true), 'voice');
    assert.equal(startMode('voice', 'keyboard', false), 'keyboard');
    assert.equal(startMode('junk', 'keyboard', true), 'keyboard');
  });
});
