import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readWav } from '../../../scripts/voices/wav';
import { trackPitch } from '../../platform/audio/pitch';
import { analyse } from './analyse';
import { compareHeard } from './heard';
import { spokenTones } from './sandhi';

/**
 * A real voice, not a synthetic one.
 *
 * Every other test here feeds the checker clean tones it was designed for.
 * These are recordings of a native speaker (public domain, from the set in
 * scripts/voices/native.ts), including the second tones that shape alone used
 * to call thirds — a real second tone starts with a dip — and a third that
 * goes creaky at the bottom, which a strict pitch tracker cannot follow.
 */

// The speaker's range, measured over all 1,622 of their recordings.
const RANGE = { floorHz: 164, ceilHz: 395 };

const heard = (name: string) => {
  const { samples, rate } = readWav(fileURLToPath(new URL(`./fixtures/${name}.wav`, import.meta.url)));
  assert.equal(rate, 16000);
  const tone = Number(name.slice(-1));
  const a = analyse(trackPitch(samples, { sampleRate: 16000 }), spokenTones([tone]), RANGE);
  return a.syllables[0]?.judged.guess?.tone;
};

describe('a native speaker', () => {
  for (const name of ['ma1', 'ma2', 'ma3', 'ma4', 'hao3', 'xue2', 'qi1', 'bu4', 'luu3', 'luu4']) {
    it(`is heard saying ${name} as that tone`, () => assert.equal(heard(name), Number(name.slice(-1))));
  }

  for (const name of ['bao2', 'da2', 'jia2', 'lan2']) {
    it(`has ${name}, a second tone with a dip at the start, heard as a second and not a third`, () =>
      assert.equal(heard(name), 2));
  }
});

describe('erhua in recognition', () => {
  it('does not count the r of 哪儿 as a syllable to get wrong', () => {
    const r = compareHeard('nǎ r', '哪儿', (ch) => (ch === '哪' ? ['nǎ'] : ch === '儿' ? ['ér'] : []));
    assert.ok(r.clean);
  });
});
