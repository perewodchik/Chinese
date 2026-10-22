import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { senses } from './items';

describe('senses', () => {
  it('keeps the first few', () => {
    assert.equal(senses('a; b; c; d'), 'a; b; c');
  });

  it('brings forward the sense the example uses when it would be cut off', () => {
    assert.equal(senses('to; for; for the benefit of; to give', 3, "I'll give you money."), 'to give; to; for');
  });

  it('leaves the order alone when the example’s sense is already shown', () => {
    assert.equal(senses('to wear; to put on; to dress; to pierce', 3, 'He is wearing a coat.'), 'to wear; to put on; to dress');
  });
});
