import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { firstUnread, mergeStudy, type GeneratedText, type TextSet } from './text';

describe('listening to a text, as the study record keeps it', () => {
  it('keeps the furthest line heard and the most read-throughs from either device', () => {
    assert.deepEqual(mergeStudy({ listened: 5, listens: 1 }, { listened: 12 }), { listened: 12, listens: 1 });
    assert.deepEqual(mergeStudy({ listens: 3 }, { listens: 2, heard: 9 }), { heard: 9, listens: 3 });
  });
});

describe('the first text not read yet', () => {
  const text = (id: string, setId: string, read: boolean, createdAt: number) =>
    ({ id, setId, title: id, titleZh: id, lines: [{ zh: '好。', py: 'hǎo', en: 'Good.' }], read, createdAt, vocab: [], questions: [], grammar: [], teach: [], glosses: {}, basis: [], note: '', topic: '', length: 'short', level: 'edge', genre: 'story', model: '' }) as unknown as GeneratedText;
  const sets: TextSet[] = [{ id: 'a', name: 'A', createdAt: 2 }, { id: 'b', name: 'B', createdAt: 1 }];

  it('is the first unread chapter of the first book that has one, with its page', () => {
    const found = firstUnread([text('a1', 'a', true, 1), text('a2', 'a', true, 2), text('b1', 'b', true, 1), text('b2', 'b', false, 2)], sets);
    assert.deepEqual([found?.set.id, found?.page, found?.text.id], ['b', 2, 'b2']);
  });

  it('is nothing when everything is read, or nothing is there', () => {
    assert.equal(firstUnread([text('a1', 'a', true, 1)], sets), null);
    assert.equal(firstUnread([], []), null);
  });
});
