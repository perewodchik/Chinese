import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeStudy } from './text';

describe('listening to a text, as the study record keeps it', () => {
  it('keeps the furthest line heard and the most read-throughs from either device', () => {
    assert.deepEqual(mergeStudy({ listened: 5, listens: 1 }, { listened: 12 }), { listened: 12, listens: 1 });
    assert.deepEqual(mergeStudy({ listens: 3 }, { listens: 2, heard: 9 }), { heard: 9, listens: 3 });
  });
});
