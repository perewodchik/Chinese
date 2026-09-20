/**
 * Does the machine voice say the tones it should?
 *
 *   npx tsx scripts/voices/check.ts jobs.json wav_dir
 *
 * Every clip is run through the same pitch analysis the learner's voice goes
 * through, against the tones a native speaker would use (sandhi applied), and
 * the result is printed per voice and per clip. A clip the checker disagrees
 * with is either a model that got the tone wrong or a checker that cannot
 * hear it — and in both cases it is no use as a reference, so the build
 * leaves it out.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { analyse } from '../../src/domain/pinyin/analyse';
import type { VoiceRange } from '../../src/domain/pinyin/contour';
import { voicedMask } from '../../src/domain/pinyin/segment';
import { spokenTones } from '../../src/domain/pinyin/sandhi';
import { syllables } from '../../src/domain/pinyin/syllable';
import { downsample } from '../../src/platform/audio/mic';
import { trackPitch } from '../../src/platform/audio/pitch';
import { readWav } from './wav';

export interface Job {
  id: string;
  text: string;
  voice: string;
  speed?: number;
  /** what the clip should say, one syllable per character; skipped when absent */
  word?: string;
  reading?: string;
}

export interface Checked {
  job: Job;
  ok: boolean;
  verdicts: string[];
  heard: Array<number | null>;
}

const framesOf = (file: string) => {
  const { samples, rate } = readWav(file);
  return trackPitch(downsample(samples, rate, 16000), { sampleRate: 16000 });
};

/**
 * Each voice's range, measured over everything it said — the machine's
 * equivalent of the learner saying mā má mǎ mà. Without it a single syllable
 * has nothing to be high or low against.
 */
export function voiceRanges(jobs: Job[], dir: string): Map<string, VoiceRange> {
  const hz = new Map<string, number[]>();
  for (const job of jobs) {
    const file = join(dir, `${job.id}.wav`);
    if (!existsSync(file)) continue;
    const frames = framesOf(file);
    const mask = voicedMask(frames);
    const list = hz.get(job.voice) ?? [];
    frames.forEach((f, i) => mask[i] && list.push(f.hz));
    hz.set(job.voice, list);
  }
  const out = new Map<string, VoiceRange>();
  for (const [voice, list] of hz) {
    list.sort((a, b) => a - b);
    const q = (p: number) => list[Math.floor(p * (list.length - 1))]!;
    out.set(voice, { floorHz: q(0.03), ceilHz: q(0.97) });
  }
  return out;
}

/**
 * Where the speech in a clip starts and ends.
 *
 * A generated voice often begins with a small intake of breath, and silence
 * trimming keeps it: a breath is louder than silence. So the first voiced
 * frame is found, and the consonant in front of it followed back only while
 * the sound runs on without a gap — a breath, being separated by one, is left
 * outside.
 */
export function speechBounds(file: string): { start: number; end: number } | null {
  const frames = framesOf(file);
  if (!frames.length) return null;
  const mask = voicedMask(frames);
  const first = mask.indexOf(true);
  const last = mask.lastIndexOf(true);
  if (first < 0) return null;
  const loudest = Math.max(...frames.map((f) => f.rms));
  const loud = (i: number) => !!frames[i] && frames[i]!.rms > loudest * 0.12;
  let a = first;
  while (a > 0 && loud(a - 1)) a--;
  let b = last;
  while (b < frames.length - 1 && loud(b + 1)) b++;
  return { start: Math.max(0, frames[a]!.t - 0.04), end: frames[b]!.t + 0.09 };
}

export function checkClip(job: Job, dir: string, range: VoiceRange | null = null): Checked | null {
  const file = join(dir, `${job.id}.wav`);
  if (!job.word || !job.reading || !existsSync(file)) return null;
  const frames = framesOf(file);
  const tones = syllables(job.reading).map((s) => s.tone);
  const a = analyse(frames, spokenTones(tones, [...job.word]), range);
  const verdicts = a.problem ? [a.problem] : a.syllables.map((s) => s.judged.verdict);
  const ok = !a.problem && verdicts.every((v) => v === 'right' || v === 'light');
  return { job, ok, verdicts, heard: a.syllables.map((s) => s.judged.guess?.tone ?? null) };
}

async function main() {
  const [jobsFile, dir] = process.argv.slice(2);
  const { readFileSync } = await import('node:fs');
  const jobs = JSON.parse(readFileSync(jobsFile!, 'utf8')) as Job[];
  const byVoice = new Map<string, { ok: number; all: number }>();
  const misses: string[] = [];
  const ranges = voiceRanges(jobs, dir!);
  for (const job of jobs) {
    const c = checkClip(job, dir!, ranges.get(job.voice) ?? null);
    if (!c) continue;
    const v = byVoice.get(job.voice) ?? { ok: 0, all: 0 };
    v.all++;
    if (c.ok) v.ok++;
    else misses.push(`${job.voice} ${job.word} ${job.reading}: ${c.verdicts.join(' ')} (heard ${c.heard.join(' ')})`);
    byVoice.set(job.voice, v);
  }
  const ranked = [...byVoice.entries()].sort((a, b) => b[1].ok / b[1].all - a[1].ok / a[1].all);
  for (const [voice, v] of ranked) console.log(`${voice}  ${v.ok}/${v.all}  ${Math.round((100 * v.ok) / v.all)}%`);
  if (process.argv.includes('--misses')) for (const m of misses) console.log('  ' + m);
}

if (process.argv[1]?.endsWith('check.ts')) void main();
