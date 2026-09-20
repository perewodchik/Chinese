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
 * - **Qwen3-TTS** for words and sentences (generate.py), in its Mandarin
 *   voices and in the designed voices cloned from a reference.
 *
 * Every tone-critical machine clip is run through the app's own pitch check,
 * against the tones a native speaker would use and on that voice's own range.
 * A clip that fails is **said again** — the model samples, so another go often
 * comes out right — up to three times, and only then given up on: a reference
 * that says the wrong tone is worse than none. Sentences are voiced but not
 * tone-checked; over a whole sentence the check is not precise enough to be a
 * gate.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { checkClip, speechBounds, voiceRanges, type Job } from './check';
import { clipName, libraryFromDisk, practiceItems, sentenceReading, type Sentence } from './items';
import { nativeFile, NATIVE_REPO } from './native';

const ROOT = resolve(import.meta.dirname, '../..');
const PY = join(ROOT, '.cache/tts-venv/bin/python');
const WORK = join(ROOT, '.cache/voices');
const WAV = join(WORK, 'wav');
const OUT = join(ROOT, 'public/voices');
const DESIGN = join(ROOT, 'scripts/voices/design');

/**
 * How many times a word is said.
 *
 * One. Saying a refused word again and again did raise the count of words
 * with a machine voice, but it is machine practice, not teaching: the tones
 * that matter most are single syllables, and those are a real person's
 * recordings. A word the check refuses on the one attempt falls back to the
 * system voice instead of costing another hour of the GPU.
 */
const TRIES = 1;

interface VoiceSpec {
  id: string;
  name: string;
  gender: 'female' | 'male';
  source: 'native' | 'qwen3' | 'designed';
  /** the model's own name for the speaker */
  speaker?: string;
  /** for a designed voice: what it should sound like (design.py) */
  description?: string;
}

type Task = Job & { tonal: boolean; sentence: boolean };

const VOICES = JSON.parse(readFileSync(join(ROOT, 'scripts/voices/voices.json'), 'utf8')) as VoiceSpec[];
const MACHINE = VOICES.filter((v) => v.source === 'qwen3');
/** Designed voices whose reference has been chosen: design.py's pick, kept as scripts/voices/design/<id>.wav. */
const DESIGNED = VOICES.filter((v) => v.source === 'designed' && existsSync(join(DESIGN, `${v.id}.wav`)));

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
}

/** The generator, as `n` processes each taking every n-th job — one leaves the GPU half idle. */
function generate(jobsFile: string, n: number, engine: 'qwen3' | 'clone'): Promise<void> {
  const one = (i: number) =>
    new Promise<void>((done, fail) => {
      const p = spawn(
        PY,
        [join(ROOT, 'scripts/voices/generate.py'), jobsFile, WAV, '--engine', engine, '--shard', `${i}/${n}`],
        { stdio: 'inherit' },
      );
      p.on('exit', (code) => (code === 0 ? done() : fail(new Error(`generate.py shard ${i} failed`))));
    });
  return Promise.all(Array.from({ length: n }, (_, i) => one(i))).then(() => undefined);
}

interface Said {
  /** the file each task ended up with, by task id */
  won: Map<string, string>;
  /** how the first attempt went, per voice */
  first: Map<string, { ok: number; all: number }>;
}

/**
 * Says a batch, and says again whatever the tone check turns down.
 *
 * The voice's range is measured once, over everything it said on the first
 * pass, and reused: a later attempt is a handful of clips, too few to know
 * how high that voice goes.
 *
 * What survives three refusals is looked at once more, loosely: a clip whose
 * every syllable is either right or *nearly* — the check's own word for a
 * shape it could not split — is better than falling back to the system voice,
 * which gets the tones right by accident only.
 */
async function voice(batch: Task[], engine: 'qwen3' | 'clone', jobsFile: string): Promise<Said> {
  const won = new Map<string, string>();
  const first = new Map<string, { ok: number; all: number }>();
  /** the least-bad attempt at each task, for the loose second look */
  const best = new Map<string, { src: string; wrong: number }>();
  let ranges = new Map<string, { floorHz: number; ceilHz: number }>();
  let pending = batch;

  for (let attempt = 0; attempt < TRIES && pending.length; attempt++) {
    const round = pending.map((j) => (attempt ? { ...j, id: `${j.id}~${attempt}` } : j));
    writeFileSync(jobsFile, JSON.stringify(round));
    await generate(jobsFile, 2, engine);
    if (!attempt) ranges = voiceRanges(round.filter((j) => !j.sentence), WAV);

    const again: Task[] = [];
    round.forEach((job, i) => {
      const task = pending[i]!;
      const src = join(WAV, `${job.id}.wav`);
      if (!existsSync(src)) return; // the model said nothing at all
      let ok = true;
      if (job.tonal) {
        const checked = checkClip(job, WAV, ranges.get(job.voice) ?? null);
        ok = !!checked?.ok;
        const wrong = checked ? checked.verdicts.filter((v) => v !== 'right' && v !== 'light' && v !== 'close').length : 9;
        const had = best.get(task.id);
        if (!had || wrong < had.wrong) best.set(task.id, { src, wrong });
        if (!attempt) {
          const t = first.get(job.voice) ?? { ok: 0, all: 0 };
          t.all++;
          if (ok) t.ok++;
          first.set(job.voice, t);
        }
      }
      if (ok) won.set(task.id, src);
      else again.push(task);
    });
    pending = again;
    if (pending.length) console.log(`  ${pending.length} to say again`);
  }
  let loose = 0;
  for (const task of pending) {
    const b = best.get(task.id);
    if (b && b.wrong === 0) {
      won.set(task.id, b.src);
      loose++;
    }
  }
  if (loose) console.log(`  ${loose} kept on the loose look — nothing worse than “nearly”`);
  return { won, first };
}

function main() {
  const lib = libraryFromDisk(ROOT);
  const items = practiceItems(lib);
  const wordItems = items.filter((it) => [...it.text].length > 1 || !(it.reading && nativeFile(ROOT, it.reading)));

  if (!existsSync(join(WORK, 'sentences.json'))) run(PY, [join(ROOT, 'scripts/voices/sentences.py')]);
  const sentences = (JSON.parse(readFileSync(join(WORK, 'sentences.json'), 'utf8')) as Sentence[]).map((s) => ({
    ...s,
    py: sentenceReading(s.zh, s.py, lib),
  }));

  const wordTasks = (voiceId: string, speaker: string): Task[] =>
    wordItems.map((it) => ({
      id: `${voiceId}_${clipName(it.text)}`,
      text: it.text,
      voice: speaker,
      word: it.text,
      reading: it.reading,
      tonal: it.tonal,
      sentence: false,
    }));
  const sentenceTask = (voiceId: string, speaker: string, s: Sentence): Task => ({
    id: `${voiceId}_${clipName(s.zh)}`,
    text: s.zh,
    voice: speaker,
    tonal: false,
    sentence: true,
  });

  // Every word in every machine voice, and each sentence in one of them,
  // taken in turn so the shelf has all of them.
  const machine: Task[] = [
    ...MACHINE.flatMap((v) => wordTasks(v.id, v.speaker!)),
    ...sentences.map((s, i) => {
      const v = MACHINE[i % MACHINE.length]!;
      return sentenceTask(v.id, v.speaker!, s);
    }),
  ];
  // A designed voice reads the sentences, which is where a voice you like
  // matters: shadowing is minutes of listening and copying. The words of the
  // tone drills are left to the voices that already have them.
  const designed: Task[] = DESIGNED.flatMap((v) => sentences.map((s) => sentenceTask(v.id, v.id, s)));

  mkdirSync(WORK, { recursive: true });
  console.log(`${wordItems.length} words × ${MACHINE.length} voices, and ${sentences.length} sentences`);
  if (DESIGNED.length) console.log(`  and everything again in ${DESIGNED.map((v) => v.name).join(', ')}`);

  return (async () => {
    const said = await voice(machine, 'qwen3', join(WORK, 'jobs.json'));
    const saidDesigned = designed.length
      ? await voice(designed, 'clone', join(WORK, 'designed.json'))
      : { won: new Map<string, string>(), first: new Map<string, { ok: number; all: number }>() };

    const idOf = new Map<string, string>([
      ...MACHINE.map((v) => [v.speaker!, v.id] as const),
      ...DESIGNED.map((v) => [v.id, v.id] as const),
    ]);
    const kept = new Map<string, string[]>();
    const encode: Array<{ src: string; dst: string; start?: number; end?: number }> = [];
    const keep = (text: string, voiceId: string, src: string, trim: boolean) => {
      kept.set(text, [...(kept.get(text) ?? []), voiceId]);
      const bounds = trim ? speechBounds(src) : null;
      encode.push({ src, dst: join(OUT, voiceId, `${clipName(text)}.mp3`), ...(bounds ?? {}) });
    };

    // The native speaker first, so it is the voice a single syllable opens with.
    let native = 0;
    for (const it of items) {
      const file = it.reading && [...it.text].length === 1 ? nativeFile(ROOT, it.reading) : null;
      if (file) {
        keep(it.text, 'native', file, false);
        native++;
      }
    }

    for (const [tasks, out] of [
      [machine, said],
      [designed, saidDesigned],
    ] as const) {
      for (const task of tasks) {
        const src = out.won.get(task.id);
        if (src) keep(task.text, idOf.get(task.voice)!, src, true);
      }
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
    for (const [speaker, t] of [...said.first, ...saidDesigned.first]) {
      console.log(`  ${idOf.get(speaker)}: ${t.ok}/${t.all} tonal clips passed first time`);
    }
    const tonal = items.filter((i) => i.tonal);
    const none = tonal.filter((i) => !kept.has(i.text));
    console.log(`  ${tonal.length - none.length}/${tonal.length} tonal texts have a voice; ${encode.length} clips`);
    if (none.length) console.log(`  on the system voice: ${none.map((i) => i.text).join(' ')}`);
  })();
}

void main();
