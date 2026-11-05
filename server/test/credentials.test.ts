import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { passwordProblem } from '../../shared/credentials';

describe('a password', () => {
  it('is refused when it is one of the first a guesser tries, in any case', () => {
    for (const p of ['password', 'Qwerty123', '12345678', 'woaini1314']) assert.match(passwordProblem(p) ?? '', /everyone tries first/, p);
  });

  it('is taken when it is long enough and nobody’s first guess', () => {
    assert.equal(passwordProblem('correct horse battery'), null);
    assert.equal(passwordProblem('ma shang hui jia'), null);
  });

  it('still says the length first, and not the name', () => {
    assert.equal(passwordProblem('short'), 'At least 8 characters.');
    assert.equal(passwordProblem('kirill2026', 'Kirill2026'), 'Not the same as the name.');
  });
});
