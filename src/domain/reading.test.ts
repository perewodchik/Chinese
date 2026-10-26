import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library } from '../data/types';
import { parseResponse } from './parse';
import { alignPinyin, bandSpread, paragraphs, stepsAbove, tokenize, wordBands } from './reading';
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
  words: [],
  byWord: new Map(),
});

const L = lib([
  entry('我', 1, 'wǒ'),
  entry('喜', 1, 'xǐ', [['喜欢', 1]]),
  entry('欢', 1, 'huān'),
  entry('咖', 4, 'kā', [['咖啡', 4]]),
  entry('啡', 4, 'fēi'),
  entry('了', 1, 'le'),
  entry('深', 4, 'shēn'),
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

  it('cuts a word the writer ran together along the library’s readings, keeping the writer’s tones', () => {
    assert.deepEqual(alignPinyin(line('我喜欢', 'wǒ xǐhuan'), L), ['wǒ', 'xǐ', 'huan']);
  });

  it('gives a character the library does not know its syllable from the writer’s word', () => {
    assert.deepEqual(alignPinyin(line('深圳很好', 'Shēnzhèn hěn hǎo'), L), ['shēn', 'zhèn', 'hěn', 'hǎo']);
    assert.deepEqual(alignPinyin(line('圳深', 'zhènshēn'), L), ['zhèn', 'shēn']);
  });

  it('reads a syllabus word as the syllabus does when the writer gave it another character reading', () => {
    const W = lib([entry('暖', 4, 'nuǎn'), { ...entry('和', 1, 'hé'), py: ['hé', 'huo'] }, entry('了', 1, 'le')]);
    W.byWord.set('暖和', { w: '暖和', py: 'nuǎn huo', d: 'warm', hsk: 4 });
    assert.deepEqual(alignPinyin(line('暖和了', 'nuǎnhé le'), W), ['nuǎn', 'huo', 'le']);
    assert.deepEqual(alignPinyin(line('暖和了', 'nuǎnhuo le'), W), ['nuǎn', 'huo', 'le']);
    // A reading the syllabus lists for the word is the writer's to choose.
    W.byWord.set('暖和', { w: '暖和', py: 'nuǎn huo', d: 'warm', hsk: 4, alt: [{ py: 'nuǎn hé', d: '' }] });
    assert.deepEqual(alignPinyin(line('暖和了', 'nuǎnhé le'), W), ['nuǎn', 'hé', 'le']);
  });

  it('falls back to the library only for a word it cannot cut', () => {
    assert.deepEqual(alignPinyin(line('我喜欢', 'wǒ zzzz'), L), ['wǒ', 'xǐ', 'huān']);
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

describe('stepsAbove', () => {
  it('counts bands above the reader, capped at four, with unlisted words at the top', () => {
    const at = (band: number) => stepsAbove({ word: true, band }, 1);
    assert.deepEqual([1, 2, 3, 4, 5, 7, 0].map(at), [0, 1, 2, 3, 4, 4, 4]);
    assert.equal(stepsAbove({ word: false, band: 0 }, 1), 0);
  });
});
