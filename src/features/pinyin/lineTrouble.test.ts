import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '../../api/http';
import { troubleOf } from './lineTrouble';

describe('what a failed scoring tells the learner', () => {
  it('sends expired keys to Settings, without a Try again that would fail the same way', () => {
    const t = troubleOf(new ApiError(503, 'unavailable', 'SpeechSuper says the keys have expired (invalid expired, 41030). Renew them in the SpeechSuper console, then paste them again in Settings.'));
    assert.equal(t.title, 'The pronunciation keys have expired');
    assert.equal(t.retry, false);
    assert.equal(t.settings, true);
    assert.doesNotMatch(t.text, /try again/i);
  });

  it('keeps Try again for a service that merely failed', () => {
    const t = troubleOf(new ApiError(503, 'unavailable', 'SpeechSuper did not answer in time.'));
    assert.equal(t.retry, true);
    assert.equal(t.settings, false);
  });
});
