import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bookFromFile } from './bookFile';

const file = JSON.stringify({
  name: 'Evening',
  texts: [
    { title: 'Hungry', titleZh: '饿了', lines: [{ zh: '我饿了。', py: 'wǒ è le', en: 'I am hungry.' }], vocab: [{ w: '饿', py: 'è', d: 'hungry', new: true }], questions: [], grammar: [], note: '', teach: [{ c: '饿', py: 'è', d: 'hungry' }] },
    { title: 'Dinner', titleZh: '吃饭', lines: [{ zh: '我们吃饭吧。', py: '', en: 'Let us eat.' }] },
  ],
});

describe('a book file read back in', () => {
  it('gives the book its name and every text, counted against what is known now', () => {
    const book = bookFromFile(file, ['我', '了'], 'From a file');
    assert.ok(!('error' in book));
    assert.equal(book.name, 'Evening');
    assert.deepEqual(book.texts.map((t) => t.titleZh), ['饿了', '吃饭']);
    assert.deepEqual(book.texts[0]!.teach, ['饿']);
    assert.equal(book.texts[0]!.lines[0]!.en, 'I am hungry.');
  });

  it('takes Claude’s fenced answer too, named for the file when it has no name', () => {
    const book = bookFromFile('Here:\n```json\n{"texts":[{"title":"Dinner","lines":[{"zh":"吃饭。","en":"Eat."}]}]}\n```', [], 'dinner.json');
    assert.ok(!('error' in book));
    assert.equal(book.name, 'dinner.json');
  });

  it('says so when there is nothing to read in it', () => {
    assert.ok('error' in bookFromFile('{"hello": 1}', [], 'x'));
  });
});
