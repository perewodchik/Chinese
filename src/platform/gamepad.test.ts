import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pressed } from './gamepad';

const pad = (...down: number[]) => Array.from({ length: 17 }, (_, i) => down.includes(i));

describe('a game controller', () => {
  it('goes on with A wherever the system puts it: on the right or at the bottom', () => {
    assert.deepEqual(pressed(pad(), pad(1)), ['next']);
    assert.deepEqual(pressed(pad(), pad(0)), ['next']);
  });

  it('goes on with R and the d-pad right, back with L and the d-pad left', () => {
    assert.deepEqual(pressed(pad(), pad(5)), ['next']);
    assert.deepEqual(pressed(pad(), pad(15)), ['next']);
    assert.deepEqual(pressed(pad(), pad(4)), ['back']);
    assert.deepEqual(pressed(pad(), pad(14)), ['back']);
  });

  it('counts a press once, not for as long as the button is held', () => {
    assert.deepEqual(pressed(pad(1), pad(1)), []);
    assert.deepEqual(pressed(pad(1), pad()), []);
  });

  it('ignores the other buttons', () => {
    assert.deepEqual(pressed(pad(), pad(2, 3, 8, 9)), []);
  });
});
