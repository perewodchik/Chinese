import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { explainPrompt, explanationOf } from './explainText';
import type { GeneratedText } from './text';

const pasted: GeneratedText = {
  id: 't', title: '我饿了', titleZh: '我饿了', topic: 'Pasted text', length: 'short', level: 'edge', genre: 'story',
  createdAt: 1, model: 'paste', read: false,
  lines: [
    { zh: '我饿了。', py: 'wǒ è le。', en: '', p: true },
    { zh: '我们吃饭吧！', py: 'wǒmen chī fàn ba！', en: '' },
  ],
  vocab: [{ w: '饿', py: 'è', d: 'hungry', isNew: true }],
  questions: [], grammar: [], note: '', teach: ['饿', '吃', '饭'], glosses: {}, basis: ['我', '了', '们', '吧'],
};

const answer = (lines: Array<{ zh: string; en: string }>) =>
  '```json\n' + JSON.stringify({ title: 'Hungry', lines, vocab: [{ w: '吃饭', py: 'chī fàn', d: 'eat a meal' }, { w: '面条', py: 'miàntiáo', d: 'noodles' }], grammar: [{ point: '吧 for a suggestion', zh: '我们吃饭吧！', en: 'Let us eat!' }], questions: [{ zh: '他怎么了？', en: 'What is up with him?', a: '他饿了。' }], note: 'Watch 了.' }) + '\n```';

describe('a pasted text explained by Claude', () => {
  it('asks for the Chinese back unchanged, and says which characters are known', () => {
    const p = explainPrompt(pasted);
    assert.match(p, /Do not change the Chinese/);
    assert.match(p, /already know: 我了们吧/);
    assert.match(p, /1\. 我饿了。\n2\. 我们吃饭吧！/);
  });

  it('takes the English of each line, matched by its characters, and keeps the text’s own Chinese', () => {
    const r = explanationOf(pasted, answer([{ zh: '我饿了.', en: 'I am hungry.' }, { zh: '我们 吃饭吧!', en: 'Let us eat!' }]));
    assert.equal(r.matched, 2);
    assert.deepEqual(r.patch!.lines.map((l) => [l.zh, l.en]), [['我饿了。', 'I am hungry.'], ['我们吃饭吧！', 'Let us eat!']]);
    assert.equal(r.patch!.lines[0]!.p, true);
    assert.equal(r.patch!.title, 'Hungry');
    assert.deepEqual(r.patch!.vocab.map((w) => [w.w, w.isNew]), [['吃饭', true]]);
    assert.equal(r.patch!.questions.length, 1);
    assert.equal(r.patch!.model, 'explained');
  });

  it('names a line Claude changed, and leaves it as it was', () => {
    const r = explanationOf(pasted, answer([{ zh: '我很饿。', en: 'I am very hungry.' }, { zh: '我们吃饭吧！', en: 'Let us eat!' }]));
    assert.deepEqual(r.missing, [1]);
    assert.equal(r.patch!.lines[0]!.en, '');
    assert.match(r.problems[0]!, /Line 1 came back changed/);
  });

  it('refuses an answer for another text', () => {
    const r = explanationOf(pasted, answer([{ zh: '他是老师。', en: 'He is a teacher.' }]));
    assert.equal(r.patch, null);
    assert.match(r.problems[0]!, /changed the Chinese/);
  });
});
