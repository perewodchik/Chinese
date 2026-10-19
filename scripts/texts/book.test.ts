import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GeneratedText, TextSet } from '../../src/domain/text';
import { adaptedModel, addBookTexts, checkBookTexts, describeShelf, runningCoverage, type BookOptions } from './book';

const reply = JSON.stringify({
  texts: [
    {
      title: 'Why is the sky blue?',
      titleZh: '天为什么是蓝的？',
      teach: [{ c: '蓝', py: 'lán', d: 'blue' }],
      lines: [
        { zh: '天是蓝的。', py: 'tiān shì lán de', en: 'The sky is blue.', p: true },
        { zh: '为什么天是蓝的？', py: 'wèishénme tiān shì lán de', en: 'Why is the sky blue?' },
      ],
      vocab: [{ w: '蓝', py: 'lán', d: 'blue' }],
      questions: [{ zh: '天是什么颜色的？', py: 'tiān shì shénme yánsè de', en: 'What colour is the sky?', a: '天是蓝的。' }],
      grammar: [{ point: '是…的', zh: '天是蓝的。', en: 'The sky is blue.' }],
      note: 'The book asks first and answers after.',
    },
    {
      title: 'Why do cats sleep so much?',
      titleZh: '猫为什么爱睡觉？',
      lines: [{ zh: '猫爱睡觉。', py: 'māo ài shuìjiào', en: 'Cats love to sleep.', p: true }],
    },
  ],
});

const older: GeneratedText = {
  id: 'old',
  setId: 's1',
  title: 'Old',
  titleZh: '旧',
  topic: 'A day at home',
  length: 'short',
  level: 'edge',
  genre: 'story',
  createdAt: 5,
  model: 'claude',
  lines: [{ zh: '我是人。', py: 'wǒ shì rén', en: 'I am a person.' }],
  vocab: [],
  questions: [],
  grammar: [],
  note: '',
  teach: ['猫'],
  glosses: {},
  basis: [],
  read: true,
};
const set: TextSet = { id: 's1', name: 'Evening', createdAt: 1 };
const doc = () => ({
  version: 10,
  learned: ['c天', 'c是', 'c的', 'c为', 'c什', 'c么', 'w天'],
  texts: [older],
  sets: [set],
  settings: { kept: true },
});

let n = 0;
const options = (o: Partial<BookOptions>): BookOptions => ({
  source: '十万个为什么',
  genre: 'description',
  now: 1000,
  id: () => `id${++n}`,
  ...o,
});

describe('book passages onto the shelf', () => {
  it('a new session goes first, its passages in the order given, everything else untouched', () => {
    const r = addBookTexts(doc(), reply, options({ newSet: 'Why? (book)' }));
    assert.equal(r.madeSet, true);
    const sets = r.document.sets as TextSet[];
    const texts = r.document.texts as GeneratedText[];
    assert.deepEqual(sets.map((s) => s.name), ['Why? (book)', 'Evening']);
    // Newest first on the shelf, as text/add keeps it: the second passage is on top.
    assert.deepEqual(texts.map((t) => t.titleZh), ['猫为什么爱睡觉？', '天为什么是蓝的？', '旧']);
    assert.deepEqual(r.document.settings, { kept: true });
    assert.deepEqual(r.document.learned, doc().learned);

    const [sky, cat] = r.added.map((a) => a.text);
    assert.equal(sky.setId, sets[0].id);
    assert.equal(sky.createdAt, 1000);
    assert.equal(cat.createdAt, 1001);
    assert.equal(sky.model, 'Book · 十万个为什么');
    assert.equal(sky.topic, '十万个为什么');
    assert.equal(sky.genre, 'description');
    assert.equal(sky.length, 'short');
    assert.equal(sky.read, false);
    // 蓝 and 颜色 are new; 猫 was taught by an earlier passage, so it is not.
    assert.deepEqual(sky.teach, ['蓝', '颜', '色']);
    assert.deepEqual(sky.glosses, { 蓝: { py: 'lán', d: 'blue' } });
    assert.equal(sky.vocab[0].isNew, true);
    assert.deepEqual(cat.teach, ['爱', '睡', '觉']);
    assert.equal(sky.level, 'beyond');
  });

  it('an existing session by name or id, and a new-set name that is already taken reuses it', () => {
    for (const o of [{ set: 'evening' }, { set: 's1' }, { newSet: 'Evening' }]) {
      const r = addBookTexts(doc(), reply, options(o));
      assert.equal(r.madeSet, false);
      assert.equal((r.document.sets as TextSet[]).length, 1);
      assert.ok(r.added.every((a) => a.text.setId === 's1'));
    }
  });

  it('a passage already on the shelf is left alone', () => {
    const once = addBookTexts(doc(), reply, options({ set: 's1' }));
    const twice = addBookTexts(once.document, reply, options({ set: 's1' }));
    assert.equal(twice.added.length, 0);
    assert.deepEqual(twice.skipped, ['天为什么是蓝的？', '猫为什么爱睡觉？']);
    assert.equal((twice.document.texts as GeneratedText[]).length, 3);
  });

  it('refuses an unknown session, JSON that needed repairs, and a newer workspace', () => {
    assert.throws(() => addBookTexts(doc(), reply, options({ set: 'nope' })), /No reading session “nope”/);
    assert.throws(() => addBookTexts(doc(), reply, options({})), /Which reading session/);
    assert.throws(() => addBookTexts(doc(), reply.replace('}]', '},]'), options({ set: 's1' })), /valid JSON/);
    assert.throws(() => addBookTexts({ ...doc(), version: 11 }, reply, options({ set: 's1' })), /pull main/);
  });

  it('describes the sessions, newest first, and suggests where the last book passage went', () => {
    const r = addBookTexts(doc(), reply, options({ newSet: 'Why? (book)' }));
    const shelf = describeShelf(r.document);
    assert.deepEqual(shelf.sessions.map((s) => [s.name, s.texts, s.fromBook, s.books, s.latest]), [
      ['Why? (book)', 2, 2, ['十万个为什么'], '猫为什么爱睡觉？'],
      ['Evening', 1, 0, [], '旧'],
    ]);
    assert.equal(shelf.suggested, shelf.sessions[0].id);
    assert.equal(shelf.knownChars, '天是的为什么');
    assert.deepEqual(shelf.knownWords, ['天']);
    // What a book passage met stays new: only the generated passage's 猫 is.
    assert.equal(shelf.met, '猫');
    assert.equal(describeShelf(doc()).suggested, null);
  });

  it('measures without saving: the running text, each character counted every time it appears', () => {
    assert.equal(runningCoverage([{ zh: '蓝蓝的天。' }], new Set(['的', '天'])), 0.5);
    const [sky, cat] = checkBookTexts(doc(), reply, { source: '十万个为什么', genre: 'description' });
    // 天是蓝的 · 为什么天是蓝的: eleven characters, 蓝 twice the only ones not known.
    assert.equal(sky.running, 9 / 11);
    assert.deepEqual(sky.text.teach, ['蓝', '颜', '色']);
    assert.equal(cat.text.titleZh, '猫为什么爱睡觉？');
    assert.equal(sky.text.model, 'Book · 十万个为什么');
  });

  it('an easier retelling teaches: what it brought in is not new again in the book passage after it', () => {
    const easier = JSON.stringify({
      texts: [{ title: 'Why is the sky blue? (easier)', titleZh: '天为什么是蓝的？', lines: [{ zh: '天是蓝的。蓝天很好。' }] }],
    });
    const first = addBookTexts(doc(), easier, options({ set: 's1', adapted: true }));
    assert.equal(first.added[0].text.model, adaptedModel('十万个为什么'));
    assert.deepEqual(first.added[0].text.teach, ['蓝', '很', '好']);
    const then = addBookTexts(first.document, reply, options({ set: 's1' }));
    assert.deepEqual(then.added[0].text.teach, ['颜', '色']);
    assert.equal(describeShelf(then.document).sessions[0].fromBook, 2);
  });
});
