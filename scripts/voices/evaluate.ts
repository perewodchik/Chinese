/**
 * How often the tone checker agrees with a native speaker.
 *
 *   npx tsx scripts/voices/evaluate.ts [dir]
 *
 * Runs the checker over recordings whose tone is known — by default the
 * public-domain set of every syllable in every tone (github.com/davinfifield/
 * mp3-chinese-pinyin-sound, converted to WAV in .cache/pinyin-sound/wav) —
 * and prints a confusion matrix. This is the number that says whether a red
 * mark on the learner's screen means anything: if the checker cannot agree
 * with a native speaker, it has no business disagreeing with a learner.
 */
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { analyse } from '../../src/domain/pinyin/analyse';
import type { VoiceRange } from '../../src/domain/pinyin/contour';
import { spokenTones } from '../../src/domain/pinyin/sandhi';
import { voicedMask } from '../../src/domain/pinyin/segment';
import { downsample } from '../../src/platform/audio/mic';
import { trackPitch, type PitchFrame } from '../../src/platform/audio/pitch';
import { readWav } from './wav';

const dir = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? '.cache/pinyin-sound/wav');
const files = readdirSync(dir).filter((f) => /^[a-zü]+[1-4]\.wav$/.test(f));

const frames = new Map<string, PitchFrame[]>();
for (const f of files) {
  const { samples, rate } = readWav(join(dir, f));
  frames.set(f, trackPitch(downsample(samples, rate, 16000), { sampleRate: 16000 }));
}

// One speaker: their range is what all of their syllables span.
const all: number[] = [];
for (const fr of frames.values()) {
  const mask = voicedMask(fr);
  fr.forEach((x, i) => mask[i] && all.push(x.hz));
}
all.sort((a, b) => a - b);
const q = (p: number) => all[Math.floor(p * (all.length - 1))]!;
const range: VoiceRange = { floorHz: q(0.03), ceilHz: q(0.97) };
console.log(`${files.length} recordings; range ${range.floorHz.toFixed(0)}–${range.ceilHz.toFixed(0)} Hz`);

const matrix = [1, 2, 3, 4].map(() => [0, 0, 0, 0, 0]);
let right = 0;
const wrong: string[] = [];
for (const [f, fr] of frames) {
  const tone = Number(f.match(/([1-4])\.wav$/)![1]);
  const a = analyse(fr, spokenTones([tone]), range);
  const heard = a.syllables[0]?.judged.guess?.tone ?? 0;
  matrix[tone - 1]![heard]!++;
  if (heard === tone) right++;
  else wrong.push(`${f.replace('.wav', '')}→${heard || '?'}`);
}
console.log(`agreement ${right}/${files.length} = ${((100 * right) / files.length).toFixed(1)}%`);
console.log('said \\ heard   ?    1    2    3    4');
matrix.forEach((row, i) => console.log(`   ${i + 1}        ${row.map((n) => String(n).padStart(4)).join(' ')}`));
if (process.argv.includes('--wrong')) console.log(wrong.slice(0, 80).join(' '));
