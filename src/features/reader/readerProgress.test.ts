import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scrolledShare } from './readerProgress';

test('the share is what has scrolled by over what can', () => {
  assert.equal(scrolledShare(0, 2000, 800), 0);
  assert.equal(scrolledShare(600, 2000, 800), 0.5);
});

test('the bottom is always 100%, even a pixel or two short of it', () => {
  assert.equal(scrolledShare(1200, 2000, 800), 1);
  assert.equal(scrolledShare(1199, 2000, 800), 1);
});

test('a chapter shorter than the screen is all read at once', () => {
  assert.equal(scrolledShare(0, 700, 800), 1);
  assert.equal(scrolledShare(0, 801, 800), 1);
});
