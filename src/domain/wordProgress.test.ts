import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Library, SyllabusWord } from '../data/types';
import { asserted, grade } from './memory';
import { wordBands } from './wordProgress';

const word = (w: string, hsk: number): SyllabusWord => ({ w, py: '', d: '', hsk });
const words = [word('我', 1), word('东西', 1), word('机场', 2), word('打算', 3)];
const lib = { words } as unknown as Library;
const NOW = 1_700_000_000_000;

describe('words on the progress bar', () => {
  it('counts each band’s known words against its size', () => {
    const recall = {
      'w我': { recognise: asserted(NOW, 9) },
      'w东西': { recognise: grade(undefined, 'hard', NOW) },
      'w机场': { recognise: grade(undefined, 'good', NOW) },
    };
    const bands = wordBands(lib, recall);
    assert.deepEqual(
      bands.slice(0, 3).map((b) => [b.band, b.done, b.size]),
      [
        [1, 1, 2],
        [2, 1, 1],
        [3, 0, 1],
      ],
    );
  });

  it('counts as confirmed only what it is told is', () => {
    const answered = grade(undefined, 'good', NOW);
    const recall = { 'w我': { recognise: asserted(NOW, 9) }, 'w机场': { recognise: answered } };
    const bands = wordBands(lib, recall, (r) => r === answered);
    assert.equal(bands[0]!.proven, 0);
    assert.equal(bands[1]!.proven, 1);
  });
});
