import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { charsPerSecond, paced, spokenLength } from './pace';

/**
 * The numbers here are measured off clips the pack actually shipped, decoded
 * in a browser: the blurs, the drawls, and the ones in between that are the
 * reason anybody puts up with a generated voice.
 */

describe('how long a sentence should take', () => {
  it('counts the characters said, not the punctuation', () => {
    assert.equal(spokenLength('你好！你今天吃了什么？'), 9);
    assert.equal(spokenLength('。。。？'), 0);
    assert.equal(spokenLength(''), 0);
  });

  it('keeps a teacher reading at a teacher’s pace', () => {
    // 我不知道你是否和我有一样 — 10.5s for 16 characters, the pace the pack is for.
    assert.equal(paced(10.5, '我不知道你是否和我有一样的想法', 'teaching'), true);
    // 4.9s for 16: brisk, but every syllable is there.
    assert.equal(paced(4.9, '我平时每天可能练习一个小时', 'teaching'), true);
  });

  it('turns down a blur', () => {
    // 0.3s for twelve characters. There are no syllables in that; it is a noise.
    assert.equal(paced(0.3, '明天下午我在我爸爸的书店。', 'teaching'), false);
    // 1.3s for 10 — eight characters a second, which a learner hears as one word.
    assert.equal(paced(1.3, '我的生日马上就要到了。', 'teaching'), false);
  });

  it('turns down a drawl', () => {
    // 11.6s for 11 characters, with the sentence in pieces by the end of it.
    assert.equal(paced(11.6, '什么。。。？你还是不会开车？', 'teaching'), false);
  });

  it('holds a conversation to a pace you can follow', () => {
    const text = '你好，我是你的中文练习伙伴。今天天气真好';   // 18 characters
    assert.equal(paced(3.5, text, 'talking'), false, '5 characters a second is a blur to a learner');
    assert.equal(paced(5.4, text, 'talking'), true, 'a little over three a second is right');
    assert.equal(paced(12, text, 'talking'), false, 'a conversation partner does not teach');
  });

  it('does not charge the ends to the characters', () => {
    // One character, said slowly, with the silence a clip always carries.
    assert.equal(paced(1.3, '好', 'teaching'), true);
    assert.equal(paced(0.2, '好', 'teaching'), false);
  });

  it('leaves a text with nothing to say alone', () => {
    assert.equal(paced(0.1, '……', 'talking'), true);
  });

  it('reports the pace a refused clip came out at', () => {
    assert.equal(charsPerSecond(0.3, '明天下午我在我爸爸的书店。'), 40);
    assert.equal(charsPerSecond(0, '好'), 0);
  });
});
