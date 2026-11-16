import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newTextSchema } from '../../shared/text';
import { bookFromFile } from './bookFile';

describe('a book file checked as the catalogue checks a text (T6)', () => {
  const book = (zh: string) => bookFromFile(JSON.stringify({ texts: [{ title: 'T', lines: [{ zh, en: 'x' }] }] }), [], 'f');

  it('passes a text of ordinary size', () => {
    const b = book('我饿了。');
    assert.ok(!('error' in b));
    assert.ok(newTextSchema.safeParse(b.texts[0]).success);
  });

  it('turns away a line past the limit', () => {
    const b = book('饿'.repeat(700));
    assert.ok(!('error' in b));
    assert.equal(newTextSchema.safeParse(b.texts[0]).success, false);
  });
});
