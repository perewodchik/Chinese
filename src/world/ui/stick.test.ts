import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stickFacing } from './stick';

describe('the joystick', () => {
  it('nothing in the dead zone; the stronger axis wins; the rim runs', () => {
    assert.deepEqual(stickFacing(3, -4), { facing: null, run: false });
    assert.deepEqual(stickFacing(20, 5), { facing: 'right', run: false });
    assert.deepEqual(stickFacing(-5, -30), { facing: 'up', run: false });
    assert.deepEqual(stickFacing(0, 50), { facing: 'down', run: true });
    assert.deepEqual(stickFacing(-50, 10), { facing: 'left', run: true });
  });
});
