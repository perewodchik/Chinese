import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { count, plain } from './numbers';

describe('numbers in Chinese', () => {
  it('says 0–99', () => {
    assert.deepEqual([0, 7, 10, 11, 20, 35, 99].map(plain), ['零', '七', '十', '十一', '二十', '三十五', '九十九']);
  });
  it('says two as 两 before a measure word', () => {
    assert.equal(count(2), '两');
    assert.equal(count(12), '十二');
  });
});
