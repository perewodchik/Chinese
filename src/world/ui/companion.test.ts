import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Lexicon } from '../core/dialogue/lexicon';
import { cueLine, glossLine, speaksUpAfterMisses, whyText } from './companionLines';

const lex: Lexicon = {
  words: (zh) => (zh === '你好！你好！' ? ['你好', '你好'] : ['地铁', '在', '哪儿']),
  syllables: () => [],
  gloss: (w) => ({ 地铁: { py: 'dìtiě', en: 'subway' }, 在: { py: 'zài', en: 'be at' }, 你好: { py: 'nǐhǎo', en: 'hello' } })[w] ?? null,
};
const line = { speaker: 'x', zh: '地铁在哪儿？', en: 'Where is the subway?', node: 'n' };

describe('兔儿爷', () => {
  it('turns a cue into one short English line', () => {
    assert.match(cueLine({ kind: 'hint', step: 1, text: '地铁' }), /地铁/);
    assert.match(cueLine({ kind: 'hint', step: 3, text: '请问，地铁站在哪儿？' }), /Say this/);
    assert.match(cueLine({ kind: 'not_chinese', text: '你好' }), /only speak Chinese/);
    assert.match(cueLine({ kind: 'explain', word: '附近', py: 'fùjìn', en: 'nearby' }), /fùjìn.*nearby/);
    assert.equal(cueLine({ kind: 'heard', text: 'I heard 卖' }), 'I heard 卖');
  });

  it('speaks up only after two misses in a row, or a misheard word', () => {
    assert.equal(speaksUpAfterMisses(1, { kind: 'hint', step: 1, text: 'x' }), false);
    assert.equal(speaksUpAfterMisses(2, { kind: 'hint', step: 1, text: 'x' }), true);
    assert.equal(speaksUpAfterMisses(0, { kind: 'heard', text: 'x' }), true);
    assert.equal(speaksUpAfterMisses(0, undefined), false);
  });

  it('translates word by word, each word once', () => {
    assert.deepEqual(glossLine(line, lex), [
      { w: '地铁', py: 'dìtiě', en: 'subway' },
      { w: '在', py: 'zài', en: 'be at' },
      { w: '哪儿', py: '', en: '' },
    ]);
    assert.equal(glossLine({ ...line, zh: '你好！你好！' }, lex).length, 1);
  });

  it('why: the script\'s note, else a calm word', () => {
    assert.equal(whyText('您 is polite.', line), '您 is polite.');
    assert.match(whyText(undefined, { ...line, key: true }), /key line/);
    assert.match(whyText(undefined, line), /Nothing tricky/);
  });
});
