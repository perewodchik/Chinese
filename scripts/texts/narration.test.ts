import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { cut, cutsFor, voiceId } from './narration';

describe('cutting a narrated text into its sentences', () => {
  it('cuts at the longest pauses, not at a short pause inside a sentence, and leaves out the silence at either end', () => {
    const silences = [
      { start: 0, end: 0.6 }, // before the first sentence
      { start: 2.0, end: 3.5 }, // a pause between sentences
      { start: 4.2, end: 4.6 }, // a comma inside the second sentence
      { start: 6.0, end: 7.6 }, // a pause between sentences
      { start: 9.0, end: 10.0 }, // after the last
    ];
    const { pieces, shortestCut, longestKept } = cutsFor(silences, 10, 3);
    assert.deepEqual(pieces, [[0.6, 2.0], [3.5, 6.0], [7.6, 9.0]]);
    assert.equal(shortestCut, 1.5);
    assert.ok(Math.abs(longestKept - 0.4) < 1e-9);
  });

  it('says so when the recording has fewer sentences than the text', () => {
    assert.throws(() => cutsFor([{ start: 2, end: 3.5 }], 6, 4), /2 stretches of speech/);
  });

  it('names a voice plainly', () => {
    assert.equal(voiceId('Serene Narrator'), 'minimax-serene-narrator');
  });

  it('cuts a real recording: three tones apart, one with a short gap in it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'narration-test-'));
    try {
      const file = join(dir, 'read.mp3');
      // 0.5 s silence, tone 1 s, pause 1.5 s, tone 0.6 s, gap 0.3 s, tone 0.6 s, pause 1.5 s, tone 1 s, 0.5 s silence
      const parts = ['s=0.5', 't=1', 's=1.5', 't=0.6', 's=0.3', 't=0.6', 's=1.5', 't=1', 's=0.5'];
      const inputs = parts.flatMap((p) => {
        const [kind, d] = p.split('=');
        return ['-f', 'lavfi', '-t', d!, '-i', kind === 't' ? 'sine=frequency=440:sample_rate=24000' : 'anullsrc=r=24000:cl=mono'];
      });
      const filter = `${parts.map((_, i) => `[${i}:a]`).join('')}concat=n=${parts.length}:v=0:a=1[out]`;
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-ac', '1', file]);
      const { pieces } = cut(file, 3);
      assert.equal(pieces.length, 3);
      const lengths = pieces.map((p) => p.to - p.from);
      assert.ok(lengths[1]! > lengths[0]!, 'the middle sentence keeps its inner gap');
      assert.ok(pieces.every((p) => p.mp3.length > 1000));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
