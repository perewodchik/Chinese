import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Lexicon } from '../core/dialogue/lexicon';
import {
  companionOptions,
  cueLine,
  glossLine,
  hintAnswer,
  keepable,
  MAX_OPTIONS,
  phaseOf,
  speaksUpAfterMisses,
  translateAnswer,
  type CompanionCtx,
} from './companionLines';

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

  it('what did they say: the English, and the why on its own line after it', () => {
    assert.equal(translateAnswer(line, undefined), '“Where is the subway?”');
    assert.equal(translateAnswer(line, '您 is polite.'), '“Where is the subway?”\n您 is polite.');
    // a key line folds its note in the same way; its own why wins
    assert.match(translateAnswer({ ...line, key: true }, undefined), /^“Where is the subway\?”\nA key line/);
    assert.equal(translateAnswer({ ...line, key: true }, 'x'), '“Where is the subway?”\nx');
  });

  it('help me answer says where the hint went, step by step', () => {
    assert.match(hintAnswer(1), /word you want/);
    assert.match(hintAnswer(2), /how it goes/);
    assert.match(hintAnswer(3), /whole answer/);
  });

  it('keeps only words with a hanzi in them', () => {
    assert.deepEqual(
      keepable([
        { w: '地铁', py: 'dìtiě', en: 'subway' },
        { w: '？', py: '', en: '' },
        { w: 'OK', py: '', en: '' },
      ]).map((g) => g.w),
      ['地铁'],
    );
  });
});

describe('兔儿爷’s options', () => {
  const all = { again: () => {}, translate: () => {}, hint: () => {}, now: () => {}, learned: () => {} };
  const ids = (ctx: CompanionCtx) => companionOptions(ctx, all).map((o) => o.id);

  it('knows the moment from the talk', () => {
    assert.equal(phaseOf(false, line), 'walk');
    assert.equal(phaseOf(true, line), 'heard');
    assert.equal(phaseOf(true, undefined), 'reply');
  });

  it('walking: what now, and what did I learn only when the last talk left words', () => {
    assert.deepEqual(ids({ phase: 'walk', canHint: false, learned: false }), ['now']);
    assert.deepEqual(ids({ phase: 'walk', canHint: true, learned: true }), ['now', 'learned']);
  });

  it('heard: again and what did they say; help me answer only with a hint left', () => {
    assert.deepEqual(ids({ phase: 'heard', canHint: false, learned: true }), ['again', 'translate']);
    assert.deepEqual(ids({ phase: 'heard', canHint: true, learned: false }), ['again', 'translate', 'hint']);
  });

  it('reply with no line yet: help me answer (if any) and what now', () => {
    assert.deepEqual(ids({ phase: 'reply', canHint: true, learned: false }), ['hint', 'now']);
    assert.deepEqual(ids({ phase: 'reply', canHint: false, learned: false }), ['now']);
  });

  it('never more than three, never one without an action, labels short and in English', () => {
    for (const phase of ['walk', 'heard', 'reply'] as const) {
      for (const canHint of [false, true]) {
        for (const learned of [false, true]) {
          const opts = companionOptions({ phase, canHint, learned }, all);
          assert.ok(opts.length >= 1 && opts.length <= MAX_OPTIONS);
          for (const o of opts) {
            assert.equal(typeof o.run, 'function');
            assert.ok(o.label.length <= 18, o.label);
            assert.doesNotMatch(o.label, /\p{Extended_Pictographic}/u);
          }
        }
      }
    }
    // an option whose action is missing is left out, not disabled
    assert.deepEqual(
      companionOptions({ phase: 'heard', canHint: true, learned: false }, { again: () => {} }).map((o) => o.id),
      ['again'],
    );
  });
});
