import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library } from '../data/types';
import { readCheck } from './answer';
import { parseResponse } from './parse';
import { alignPinyin, bandSpread, paragraphs, tokenize, wordBands } from './reading';
import type { TextLine } from './text';

const entry = (c: string, hsk: number, py: string, words: Array<[string, number | null]> = []): CharacterEntry => ({
  c,
  i: 0,
  py: [py],
  def: '',
  rad: null,
  radNum: null,
  sc: null,
  ids: null,
  parts: [],
  leaves: [],
  ety: null,
  trad: null,
  hsk,
  freq: 1,
  layer: 0,
  words: words.map(([w, h]) => ({ w, p: '', d: '', hsk: h })),
  sent: null,
  conf: [],
});

const lib = (entries: CharacterEntry[]): Library => ({
  characters: entries,
  themes: [],
  components: {},
  strokes: {},
  byChar: new Map(entries.map((e) => [e.c, e])),
});

const L = lib([
  entry('我', 1, 'wǒ'),
  entry('喜', 1, 'xǐ', [['喜欢', 1]]),
  entry('欢', 1, 'huān'),
  entry('咖', 4, 'kā', [['咖啡', 4]]),
  entry('啡', 4, 'fēi'),
  entry('了', 1, 'le'),
]);

const line = (zh: string, py = '', extra: Partial<TextLine> = {}): TextLine => ({ zh, py, en: '', ...extra });

describe('paragraphs', () => {
  it('follows the writer’s marks', () => {
    const lines = [line('一。', '', { p: true }), line('二。'), line('三。', '', { p: true })];
    assert.deepEqual(paragraphs({ lines, genre: 'story' }), [[0, 1], [2]]);
  });

  it('reads an unmarked story as one paragraph and an unmarked dialogue as turns', () => {
    const lines = [line('一。'), line('二。')];
    assert.deepEqual(paragraphs({ lines, genre: 'story' }), [[0, 1]]);
    assert.deepEqual(paragraphs({ lines, genre: 'dialogue' }), [[0], [1]]);
  });
});

describe('alignPinyin', () => {
  it('puts the writer’s syllable over each character when the counts agree', () => {
    assert.deepEqual(alignPinyin(line('我喜欢了。', 'wǒ xǐ huan le')), ['wǒ', 'xǐ', 'huan', 'le']);
  });

  it('falls back to the library when they do not', () => {
    assert.deepEqual(alignPinyin(line('我喜欢', 'wǒ xǐhuan'), L), ['wǒ', 'xǐ', 'huān']);
  });
});

describe('tokenize', () => {
  const bands = wordBands(L);

  it('cuts known words and gives each its band', () => {
    const tokens = tokenize('我喜欢咖啡。', L, bands);
    assert.deepEqual(
      tokens.map((t) => [t.text, t.band, t.word]),
      [
        ['我', 1, true],
        ['喜欢', 1, true],
        ['咖啡', 4, true],
        ['。', 0, false],
      ],
    );
    assert.equal(tokens[2].at, 3);
  });

  it('lets the passage’s own vocabulary win', () => {
    const tokens = tokenize('欢了', L, bands, new Set(['欢了']));
    assert.deepEqual(
      tokens.map((t) => t.text),
      ['欢了'],
    );
  });
});

describe('bandSpread', () => {
  it('counts each distinct character once, by band', () => {
    const spread = bandSpread({ lines: [line('我喜欢咖啡，我喜欢猫。')] }, L);
    assert.equal(spread.get(1), 3);
    assert.equal(spread.get(4), 2);
    assert.equal(spread.get(0), 1);
  });
});

describe('parsing the reader’s metadata', () => {
  it('keeps paragraph marks, traditional lines, model answers and the band count', () => {
    const raw = JSON.stringify({
      texts: [
        {
          id: 't1',
          title: 'Cat',
          lines: [{ zh: '我喜欢猫。', zht: '我喜歡貓。', py: 'wǒ xǐ huan māo', en: 'I like cats.', p: true }],
          questions: [{ zh: '我喜欢什么？', py: '', en: '', a: '猫。' }],
          hsk: { '1': 3, '4': 1 },
        },
      ],
    });
    const [draft] = parseResponse('```json\n' + raw + '\n```').drafts;
    assert.equal(draft.lines[0].p, true);
    assert.equal(draft.lines[0].zht, '我喜歡貓。');
    assert.equal(draft.questions[0].a, '猫。');
    assert.deepEqual(draft.hsk, { '1': 3, '4': 1 });
  });

  it('still reads `p` as pinyin in an answer that uses it that way', () => {
    const raw = JSON.stringify({ texts: [{ title: 'x', lines: [{ zh: '我。', p: 'wǒ' }] }] });
    const [draft] = parseResponse(raw).drafts;
    assert.equal(draft.lines[0].py, 'wǒ');
    assert.equal(draft.lines[0].p, undefined);
  });
});

describe('reading an answer check', () => {
  it('takes the verdict from a fenced block with prose around it', () => {
    const got = readCheck('Here you go:\n```json\n{"verdict":"Nearly","feedback":"Close.","better":"它在屋上睡觉。"}\n```');
    assert.deepEqual(got, { verdict: 'nearly', feedback: 'Close.', better: '它在屋上睡觉。' });
  });

  it('gives up on something that is not a verdict', () => {
    assert.equal(readCheck('I think it is fine.'), null);
  });
});
