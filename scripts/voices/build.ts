/**
 * The voice pack: every word and sentence the pronunciation section says,
 * read by natural voices, checked, and shipped as static files.
 *
 *   npm run voices
 *
 * Built on this machine, not fetched from a cloud service: a cloud voice
 * needs an account, and an account can be refused or blocked, where a static
 * file needs nothing at all — it plays the same on the home Wi-Fi, on Vercel,
 * and from the cache with no network.
 *
 * Two sources (scripts/voices/voices.json):
 *
 * - **a native speaker** for every single syllable: the public-domain set of
 *   every syllable in every tone (native.ts). That covers the four tones one
 *   at a time and every minimal pair in the sound lessons.
 * - **Qwen3-TTS** for words and sentences (generate.py), in four of its
 *   Mandarin voices.
 *
 * Every tone-critical machine clip is run through the app's own pitch check,
 * against the tones a native speaker would use and on that voice's own range.
 * A clip that fails is left out: a reference that says the wrong tone is
 * worse than none. Sentences are voiced but not tone-checked — over a whole
 * sentence the check is not precise enough to be a gate.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { checkClip, voiceRanges, type Job } from './check';
import { clipName, libraryFromDisk, practiceItems, sentenceReading, type Sentence } from './items';
import { nativeFile, NATIVE_REPO } from './native';

const ROOT = resolve(import.meta.dirname, '../..');
const PY = join(ROOT, '.cache/tts-venv/bin/python');
const WORK = join(ROOT, '.cache/voices');
const WAV = join(WORK, 'wav');
const OUT = join(ROOT, 'public/voices');

interface VoiceSpec {
  id: string;
  name: string;
  gender: 'female' | 'male';
  source: 'native' | 'qwen3' | 'designed';
  speaker?: string;
  /** for a designed voice: what it should sound like (design.py) */
  description?: string;
}

const VOICES = JSON.parse(readFileSync(join(ROOT, 'scripts/voices/voices.json'), 'utf8')) as VoiceSpec[];
const MACHINE = VOICES.filter((v) => v.source === 'qwen3');
const DESIGN = join(ROOT, 'scripts/voices/design');
/** Designed voices whose reference has been chosen: design.py's pick, kept as scripts/voices/design/<id>.wav. */
const DESIGNED = VOICES.filter((v) => v.source === 'designed' && existsSync(join(DESIGN, `${v.id}.wav`)));

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
}

/** The generator, as `n` processes each taking every n-th job — the model leaves the GPU half idle alone. */
function generate(jobsFile: string, n: number, engine: 'qwen3' | 'clone'): Promise<void> {
  const one = (i: number) =>
    new Promise<void>((done, fail) => {
      const p = spawn(PY, [join(ROOT, 'scripts/voices/generate.py'), jobsFile, WAV, '--engine', engine, '--shard', `${i}/${n}`], {
        stdio: 'inherit',
      });
      p.on('exit', (code) => (code === 0 ? done() : fail(new Error(`generate.py shard ${i} failed`))));
    });
  return Promise.all(Array.from({ length: n }, (_, i) => one(i))).then(() => undefined);
}

async function main() {
  const only = process.argv.includes('--words-only');
  const lib = libraryFromDisk(ROOT);
  const items = practiceItems(lib);

  if (!existsSync(join(WORK, 'sentences.json'))) run(PY, [join(ROOT, 'scripts/voices/sentences.py')]);
  const sentences = only
    ? []
    : (JSON.parse(readFileSync(join(WORK, 'sentences.json'), 'utf8')) as Sentence[]).map((s) => ({
        ...s,
        py: sentenceReading(s.zh, s.py, lib),
      }));

  // Machine jobs: every practice item in every machine voice, and each
  // sentence in one voice, taken in turn so the shelf has all of them.
  const jobs: Array<Job & { tonal: boolean; sentence: boolean }> = [
    // A single syllable has the native speaker; the machine voices are for
    // words, where a recording of each syllable alone would lose the sandhi.
    ...MACHINE.flatMap((v) =>
      items.filter((it) => [...it.text].length > 1 || !(it.reading && nativeFile(ROOT, it.reading))).map((it) => ({
        id: `${v.id}_${clipName(it.text)}`,
        text: it.text,
        voice: v.speaker!,
        word: it.text,
        reading: it.reading,
        tonal: it.tonal,
        sentence: false,
      })),
    ),
    ...sentences.map((s, i) => {
      const v = MACHINE[i % MACHINE.length]!;
      return { id: `${v.id}_${clipName(s.zh)}`, text: s.zh, voice: v.speaker!, tonal: false, sentence: true };
    }),
  ];
  // A designed voice reads everything — every word and every sentence — so
  // that choosing it means hearing it everywhere.
  const designed: typeof jobs = DESIGNED.flatMap((v) => [
    ...items
      .filter((it) => [...it.text].length > 1 || !(it.reading && nativeFile(ROOT, it.reading)))
      .map((it) => ({
        id: `${v.id}_${clipName(it.text)}`,
        text: it.text,
        voice: v.id,
        word: it.text,
        reading: it.reading,
        tonal: it.tonal,
        sentence: false,
      })),
    ...sentences.map((s) => ({ id: `${v.id}_${clipName(s.zh)}`, text: s.zh, voice: v.id, tonal: false, sentence: true })),
  ]);

  mkdirSync(WORK, { recursive: true });
  writeFileSync(join(WORK, 'jobs.json'), JSON.stringify(jobs));
  writeFileSync(join(WORK, 'designed.json'), JSON.stringify(designed));
  console.log(`${items.length} practice texts × ${MACHINE.length} voices, and ${sentences.length} sentences`);
  if (DESIGNED.length) console.log(`  and everything again in ${DESIGNED.map((v) => v.name).join(', ')}`);
  await generate(join(WORK, 'jobs.json'), 2, 'qwen3');
  if (designed.length) await generate(join(WORK, 'designed.json'), 2, 'clone');
  jobs.push(...designed);

  const idOf = new Map<string, string>([...MACHINE.map((v) => [v.speaker!, v.id] as const), ...DESIGNED.map((v) => [v.id, v.id] as const)]);
  const ranges = voiceRanges(
    jobs.filter((j) => !j.sentence),
    WAV,
  );
  const kept = new Map<string, string[]>();
  const encode: Array<{ src: string; dst: string }> = [];
  const keep = (text: string, voice: string, src: string) => {
    kept.set(text, [...(kept.get(text) ?? []), voice]);
    encode.push({ src, dst: join(OUT, voice, `${clipName(text)}.mp3`) });
  };

  // The native speaker first, so it is the voice a single syllable opens with.
  let native = 0;
  for (const it of items) {
    const file = it.reading && [...it.text].length === 1 ? nativeFile(ROOT, it.reading) : null;
    if (file) {
      keep(it.text, 'native', file);
      native++;
    }
  }

  const tally = new Map<string, { ok: number; all: number }>();
  for (const job of jobs) {
    const src = join(WAV, `${job.id}.wav`);
    if (!existsSync(src)) continue;
    const voice = idOf.get(job.voice)!;
    if (job.tonal) {
      const ok = !!checkClip(job, WAV, ranges.get(job.voice) ?? null)?.ok;
      const t = tally.get(voice) ?? { ok: 0, all: 0 };
      t.all++;
      if (ok) t.ok++;
      tally.set(voice, t);
      if (!ok) continue;
    }
    keep(job.text, voice, src);
  }

  rmSync(OUT, { recursive: true, force: true });
  writeFileSync(join(WORK, 'encode.json'), JSON.stringify(encode));
  run(PY, [join(ROOT, 'scripts/voices/encode.py'), join(WORK, 'encode.json')]);

  const used = new Set([...kept.values()].flat());
  const clips: Record<string, { name: string; voices: string[] }> = {};
  for (const [text, voices] of [...kept.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    clips[text] = { name: clipName(text), voices };
  }
  writeFileSync(
    join(OUT, 'index.json'),
    JSON.stringify({
      sources: {
        native: `One native speaker, every syllable in every tone — public domain (${NATIVE_REPO}).`,
        qwen3: 'Qwen3-TTS 0.6B CustomVoice (Apache-2.0), generated with scripts/voices/build.ts.',
        designed:
          'Voices designed from a description with Qwen3-TTS VoiceDesign and cloned with Qwen3-TTS Base (Apache-2.0) — a kind of voice, not a copy of anyone.',
      },
      voices: VOICES.filter((v) => used.has(v.id)).map(({ id, name, gender }) => ({ id, name, gender })),
      clips,
    }),
  );
  writeFileSync(
    join(OUT, 'sentences.json'),
    JSON.stringify(sentences.filter((s) => kept.has(s.zh)).map(({ len: _len, ...s }) => s)),
  );

  console.log(`  native: ${native} single syllables`);
  for (const [voice, t] of tally) console.log(`  ${voice}: ${t.ok}/${t.all} tonal clips passed the check`);
  const tonal = items.filter((i) => i.tonal);
  const none = tonal.filter((i) => !kept.has(i.text));
  console.log(`  ${tonal.length - none.length}/${tonal.length} tonal texts have a voice; ${encode.length} clips`);
  if (none.length) console.log(`  on the system voice: ${none.map((i) => i.text).join(' ')}`);
}

void main();
