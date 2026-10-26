import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Library } from '../data/types';
import { wordsFromTexts } from './words';

const lib = {
  characters: [],
  themes: [],
  components: {},
  strokes: {},
  byChar: new Map(),
  words: [],
  byWord: new Map([['暖和', { w: '暖和', py: 'nuǎn huo', d: 'warm', hsk: 4 }]]),
} as unknown as Library;

const text = (createdAt: number, vocab: Array<{ w: string; py: string; d: string }>) => ({ createdAt, vocab });

describe('wordsFromTexts', () => {
  it('keeps the words the lists do not have, once each, with the newest text’s gloss', () => {
    const got = wordsFromTexts(lib, [
      text(1, [{ w: '热汤', py: 'rètāng', d: 'soup' }, { w: '暖和', py: 'nuǎnhuo', d: 'warm' }]),
      text(2, [{ w: '热汤', py: 'rètāng', d: 'hot soup' }, { w: '雪地', py: 'xuědì', d: 'snowfield' }]),
      text(3, [{ w: '小智', py: 'Xiǎozhì', d: '' }, { w: 'OK', py: '', d: 'okay' }]),
    ]);
    assert.deepEqual(
      got.map((w) => [w.w, w.d, w.hsk]),
      [
        ['热汤', 'hot soup', null],
        ['雪地', 'snowfield', null],
      ],
    );
  });
});
