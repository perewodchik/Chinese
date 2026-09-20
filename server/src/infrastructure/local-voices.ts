import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TalkSynthesizer, VoiceInfo } from '../application/ports';

/**
 * The voice pack's voices, reading anything at all — for the conversation,
 * whose sentences do not exist until Claude writes them.
 *
 * The same open models the pack is built with (Qwen3-TTS through MLX), run on
 * this computer by `scripts/voices/speak.py`, which the server starts on
 * first use and keeps running with the models loaded. No account, no key, no
 * cost; the price is that it only exists where the models do — a Mac with
 * Apple silicon that has run `npm run voices` — and never on Vercel.
 *
 * Kept apart from the pronunciation section's own voices on purpose. There,
 * a word the pack has no clip for falls back to the system voice because its
 * machine clip *failed the tone check*; handing that word to a live model
 * would bring back exactly the reading that was thrown out. A conversation is
 * different: the alternative is the system voice, and a natural voice that is
 * occasionally imperfect is still the better partner.
 */

interface VoiceSpec {
  id: string;
  name: string;
  gender: 'female' | 'male';
  source: 'native' | 'qwen3' | 'designed';
}

interface Pending {
  resolve: (answer: WorkerAnswer) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface WorkerAnswer {
  id: string;
  mp3?: string;
  ok?: boolean;
  error?: string;
}

/** The first request waits for a model to load as well; later ones wait behind each other. */
const TIMEOUT_MS = 120_000;
const CACHE_SIZE = 200;

export function localVoices(opts: { python: string; script: string; voices: VoiceInfo[]; cwd: string }) {
  let worker: ChildProcessWithoutNullStreams | null = null;
  let seq = 0;
  const pending = new Map<string, Pending>();
  const cache = new Map<string, Uint8Array>();
  /** voices whose model has been asked to load in the running worker */
  const warmed = new Set<string>();

  const start = () => {
    if (worker) return worker;
    const w = spawn(opts.python, [opts.script], { cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '';
    w.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        let answer: WorkerAnswer;
        try {
          answer = JSON.parse(line) as WorkerAnswer;
        } catch {
          continue;
        }
        const p = pending.get(answer.id);
        if (!p) continue;
        pending.delete(answer.id);
        clearTimeout(p.timer);
        p.resolve(answer);
      }
    });
    // The model libraries talk a lot on stderr; none of it is an answer.
    w.stderr.resume();
    const gone = () => {
      if (worker !== w) return;
      worker = null;
      warmed.clear();
      for (const [id, p] of pending) {
        clearTimeout(p.timer);
        p.reject(new Error('the voice process stopped'));
        pending.delete(id);
      }
    };
    w.on('exit', gone);
    w.on('error', gone);
    worker = w;
    return w;
  };

  const ask = (req: Record<string, unknown>) =>
    new Promise<WorkerAnswer>((resolve, reject) => {
      const id = String(++seq);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('the voice took too long'));
      }, TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      start().stdin.write(`${JSON.stringify({ ...req, id })}\n`);
    });

  const synthesizer: TalkSynthesizer & { close(): void } = {
    voices: opts.voices,

    async synthesize(text, voice, mode) {
      const key = `${voice}|${mode}|${text}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const answer = await ask({ text, voice, mode });
      if (!answer.mp3) throw new Error(answer.error ?? 'no audio');
      const bytes = new Uint8Array(Buffer.from(answer.mp3, 'base64'));
      cache.set(key, bytes);
      if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
      return bytes;
    },

    warm(voice) {
      const id = voice && opts.voices.some((v) => v.id === voice) ? voice : opts.voices[0]!.id;
      if (warmed.has(id) && worker) return;
      warmed.add(id);
      void ask({ warm: true, voice: id }).catch(() => warmed.delete(id));
    },

    close() {
      worker?.stdin.end();
      worker = null;
    },
  };
  return synthesizer;
}

/**
 * Local voices for a server running on the learner's Mac, or null where they
 * cannot run: not Apple silicon, no model environment (`npm run voices` sets
 * it up), on Vercel, or switched off with `HANZI_LOCAL_VOICES=off`.
 */
export function localVoicesFromEnv(env: Record<string, string | undefined>, root: string) {
  if (env.HANZI_LOCAL_VOICES === 'off' || env.VERCEL) return null;
  if (process.platform !== 'darwin' || process.arch !== 'arm64') return null;
  const python = join(root, '.cache/tts-venv/bin/python');
  const script = join(root, 'scripts/voices/speak.py');
  const specFile = join(root, 'scripts/voices/voices.json');
  if (!existsSync(python) || !existsSync(script) || !existsSync(specFile)) return null;

  const specs = JSON.parse(readFileSync(specFile, 'utf8')) as VoiceSpec[];
  const voices = specs
    .filter(
      (v) =>
        v.source === 'qwen3' ||
        (v.source === 'designed' && existsSync(join(root, 'scripts/voices/design', `${v.id}.wav`))),
    )
    .map(({ id, name, gender }) => ({ id, name, gender }));
  return voices.length ? localVoices({ python, script, voices, cwd: root }) : null;
}
