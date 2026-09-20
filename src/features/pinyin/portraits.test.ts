import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chatter, lookFor, mouthOpen, SILENT } from './portraits';

describe('the look of a voice', () => {
  it('gives each of the pack’s voices a face of its own', () => {
    const ids = ['chen', 'native'];
    const looks = ids.map((id) => JSON.stringify(lookFor(id)));
    assert.equal(new Set(looks).size, ids.length, 'two voices share a face');
  });

  it('keeps the same face for a voice every time it is asked', () => {
    assert.deepEqual(lookFor('a-new-voice', 'female'), lookFor('a-new-voice', 'female'));
    assert.deepEqual(lookFor('chen'), lookFor('chen'));
  });

  it('gives a voice it has never heard of a face anyway', () => {
    const look = lookFor('qwen3-someone', 'male');
    assert.ok(['crop', 'part'].includes(look.hair), 'a man’s hair for a man’s voice');
    assert.equal(look.earrings, false);
    assert.ok(look.skin >= 1 && look.skin <= 3);
    assert.ok(look.cloth >= 1 && look.cloth <= 5);
  });

  it('starts the faces at different points, so they do not blink together', () => {
    const beats = ['chen', 'native', 'a-voice-from-later'].map((id) => lookFor(id).beat);
    assert.equal(new Set(beats).size, beats.length);
  });
});

describe('a mouth following a voice', () => {
  it('is shut in silence and wide when shouted at', () => {
    assert.equal(mouthOpen(0), 0);
    assert.ok(mouthOpen(SILENT) < 0.2, 'room noise barely moves it');
    assert.equal(mouthOpen(1), 1);
  });

  it('opens further the louder it gets', () => {
    const steps = [0.001, 0.005, 0.02, 0.08, 0.3].map(mouthOpen);
    for (let i = 1; i < steps.length; i++) assert.ok(steps[i]! > steps[i - 1]!, `${i} did not open further`);
  });

  it('gives ordinary speech most of its range, not the top of it', () => {
    // Speech sits around an RMS of a twentieth; a mouth that only moves above
    // that is a face that barely moves at all.
    assert.ok(mouthOpen(0.05) > 0.6 && mouthOpen(0.05) < 0.95);
  });
});

describe('a mouth with nothing to follow', () => {
  const frames = Array.from({ length: 600 }, (_, i) => chatter(i * 16.7));

  it('stays within a mouth’s range', () => {
    for (const f of frames) assert.ok(f >= 0 && f <= 1, `${f} is not a mouth`);
  });

  it('shuts and opens rather than hanging half-open', () => {
    assert.ok(frames.some((f) => f === 0), 'never shuts');
    assert.ok(frames.some((f) => f > 0.8), 'never opens properly');
  });

  it('does not fall into a loop a viewer would notice', () => {
    // The same face, a second apart, should not be making the same shape.
    const drift = frames.slice(0, 120).map((f, i) => Math.abs(f - frames[i + 60]!));
    assert.ok(drift.reduce((a, b) => a + b, 0) / drift.length > 0.15);
  });
});
