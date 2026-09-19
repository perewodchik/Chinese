import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hydrate, serialise } from '../store/migrations';
import { emptyState } from '../store/state';
import { buildListPrompt, charsOfWords, emptyListPlan, parseWordList } from './wordlist';

const REPLY = `Here is your list:

\`\`\`json
{
  "title": "At the doctor's",
  "titleZh": "看病",
  "note": "Register first.",
  "words": [
    {
      "w": "挂号", "py": "guà hào", "d": "to register", "hsk": 5,
      "explain": "The first thing you do.",
      "examples": [{ "zh": "我想挂号。", "py": "wǒ xiǎng guà hào.", "tr": "I'd like to register." }]
    },
    { "w": "肚子", "py": "dù zi", "d": "belly", "hsk": "HSK 4", "explain": "", "examples": [] },
  ]
}
\`\`\`

Good luck!`;

describe('reading a word list back from Claude', () => {
  it('reads the words, their examples and the list around them, forgiving a trailing comma', () => {
    const { list, route, problems } = parseWordList(REPLY);
    assert.equal(route, 'repaired');
    assert.deepEqual(problems, []);
    assert.equal(list.title, "At the doctor's");
    assert.equal(list.titleZh, '看病');
    assert.equal(list.note, 'Register first.');
    assert.deepEqual(
      list.words.map((w) => [w.w, w.hsk]),
      [
        ['挂号', 5],
        ['肚子', 4],
      ],
    );
    assert.deepEqual(list.words[0].examples[0], {
      zh: '我想挂号。',
      py: 'wǒ xiǎng guà hào.',
      en: "I'd like to register.",
    });
  });

  it('pulls whole entries out of a reply that was cut off', () => {
    const cut = REPLY.slice(0, REPLY.indexOf('"肚子"') + 20);
    const { list, route } = parseWordList(cut);
    assert.ok(list.words.some((w) => w.w === '挂号'));
    assert.notEqual(route, 'none');
  });

  it('says so when there is nothing in the paste', () => {
    const { list, problems } = parseWordList('Sorry, I cannot help with that.');
    assert.equal(list.words.length, 0);
    assert.equal(problems.length, 1);
  });

  it('collects every character once, in the order the words meet them', () => {
    const { list } = parseWordList(REPLY);
    assert.deepEqual(charsOfWords(list.words), ['挂', '号', '肚', '子']);
  });
});

describe('the prompt', () => {
  it('carries the request, the size and what can already be read', () => {
    const plan = { ...emptyListPlan('p', 0), request: 'Seeing a doctor', size: 15, lang: 'ru' as const };
    const text = buildListPrompt(plan, ['我', '你']);
    assert.match(text, /Seeing a doctor/);
    assert.match(text, /15 entries/);
    assert.match(text, /我你/);
    assert.match(text, /in Russian/);
  });
});

describe('a collection written with Claude, saved and opened again', () => {
  it('keeps its words, what was asked for and the list still being written', () => {
    const state = emptyState();
    state.collections = [
      {
        id: 'a',
        name: 'Doctor',
        items: ['c挂'],
        sheet: hydrate({ collections: [{ id: 'x', items: [] }] }).collections[0].sheet,
        scope: { mode: 'all', from: 1, count: 20 },
        createdAt: 1,
        updatedAt: 1,
        brief: 'Seeing a doctor',
        words: parseWordList(REPLY).list.words,
      },
    ];
    state.listPlan = { ...emptyListPlan('p', 5), request: 'Renting a flat', step: 'prompt', copiedAt: 7 };

    const back = hydrate(JSON.parse(JSON.stringify(serialise(state))));
    assert.equal(back.collections[0].brief, 'Seeing a doctor');
    assert.deepEqual(back.collections[0].words, state.collections[0].words);
    assert.deepEqual(back.listPlan, state.listPlan);
  });

  it('opens a document from before word lists existed', () => {
    const back = hydrate({ version: 6, collections: [{ id: 'a', name: 'HSK 1', items: ['c好'] }] });
    assert.equal(back.listPlan, null);
    assert.equal(back.collections[0].words, undefined);
  });
});
