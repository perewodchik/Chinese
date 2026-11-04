import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { trimToVoice } from './mic';

const RATE = 16_000;
/** quiet, then a tone loud as a voice, then quiet again: seconds of each */
function recording(before: number, voice: number, after: number): Float32Array {
  const out = new Float32Array(Math.round((before + voice + after) * RATE));
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    out[i] = 0.0005 * Math.sin(i * 1.7) + (t >= before && t < before + voice ? 0.2 * Math.sin((2 * Math.PI * 220 * i) / RATE) : 0);
  }
  return out;
}

describe('a recording cut to the voice in it', () => {
  it('keeps the voice with room either side, and takes the quiet off both ends', () => {
    const cut = trimToVoice(recording(1, 1.5, 1.2));
    // 1.5 s of voice, 0.2 s before it, up to 0.4 s after
    assert.ok(cut.length / RATE > 1.6 && cut.length / RATE < 2.2, `${cut.length / RATE}`);
  });

  it('leaves a recording with no voice in it whole', () => {
    const quiet = recording(2, 0, 0);
    assert.equal(trimToVoice(quiet).length, quiet.length);
  });

  it('never cuts into a voice that starts at the very beginning', () => {
    const cut = trimToVoice(recording(0, 1, 1));
    assert.ok(cut.length / RATE >= 1, `${cut.length / RATE}`);
  });
});
