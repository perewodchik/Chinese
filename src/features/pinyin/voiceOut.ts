import { naturalVoices as serverVoices, speechAudio, type NaturalVoice } from '../../api/speech';
import { ANALYSIS_RATE, downsample } from '../../platform/audio/mic';
import { speak } from '../../platform/speech';
import { preferredVoice } from './voice';

/**
 * Saying things to the learner, in the best voice there is for that text.
 *
 * Three sources, best first:
 *
 * 1. **The voice pack** — every word the section practises, read by natural
 *    voices ahead of time and shipped as static files (`npm run voices`).
 *    Needs no account and no network beyond the page's own, and each clip
 *    has already passed the same tone check the learner's voice goes through.
 * 2. **A speech service on the server**, if one is configured, for anything
 *    the pack does not have.
 * 3. **The system voice**, which always works and is never the one to copy.
 *
 * The first two arrive as audio files, so their pitch can be drawn on the
 * staff beside the learner's. The system voice plays through the operating
 * system and never passes through the page, so with it the staff shows the
 * textbook shape instead.
 */

interface Pack {
  voices: NaturalVoice[];
  clips: Record<string, { name: string; voices: string[] }>;
}

let pack: Promise<Pack | null> | null = null;
const loadPack = () =>
  (pack ??= fetch('/voices/index.json')
    .then((r) => (r.ok ? (r.json() as Promise<Pack>) : null))
    .catch(() => null));

type Ctor = typeof AudioContext;
let ctx: AudioContext | null = null;
const context = () =>
  (ctx ??= new ((window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }).AudioContext ??
    (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext)());

const decoded = new Map<string, Promise<AudioBuffer>>();
let playing: AudioBufferSourceNode | null = null;

function cached(key: string, load: () => Promise<ArrayBuffer>): Promise<AudioBuffer> {
  let p = decoded.get(key);
  if (!p) {
    p = load().then((bytes) => context().decodeAudioData(bytes));
    // A failed fetch should be tried again next time, not remembered.
    p.catch(() => decoded.delete(key));
    decoded.set(key, p);
  }
  return p;
}

export interface SayOptions {
  /** a natural voice by id; the learner's chosen one, or the first available, when left out */
  voice?: string;
  slow?: boolean;
}

/** The recording to use for a text, or null when only the system voice has it. */
async function clipFor(text: string, opts: SayOptions): Promise<AudioBuffer | null> {
  const p = await loadPack();
  const entry = p?.clips[text];
  if (entry?.voices.length) {
    const wanted = opts.voice ?? preferredVoice();
    const voice = wanted && entry.voices.includes(wanted) ? wanted : entry.voices[0]!;
    try {
      return await cached(`pack|${voice}|${text}`, () =>
        fetch(`/voices/${voice}/${entry.name}.mp3`).then((r) => {
          if (!r.ok) throw new Error(`voice ${r.status}`);
          return r.arrayBuffer();
        }),
      );
    } catch {
      // A missing file falls through to the server, then the system voice.
    }
  }
  const server = await serverVoices();
  if (server.length) {
    const voice = opts.voice && server.some((v) => v.id === opts.voice) ? opts.voice : server[0]!.id;
    try {
      return await cached(`server|${voice}|${opts.slow ? 1 : 0}|${text}`, () => speechAudio(text, voice, !!opts.slow));
    } catch {
      // Quota used up, network down: the system voice will do.
    }
  }
  return null;
}

/**
 * Says it — naturally if possible. Resolves to what spoke, so a caller can
 * tell whether there is audio to measure.
 */
export async function say(text: string, opts: SayOptions = {}): Promise<'natural' | 'system' | 'none'> {
  // Resumed before anything is awaited: iOS only lets audio start inside the tap.
  const c = typeof window !== 'undefined' ? context() : null;
  void c?.resume();
  const buffer = await clipFor(text, opts);
  if (buffer && c) {
    playing?.stop();
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    src.start();
    playing = src;
    return 'natural';
  }
  return speak(text, { rate: opts.slow ? 0.7 : 0.85 }) ? 'system' : 'none';
}

/**
 * A natural voice's recording of a text, as samples at the analysis rate —
 * for drawing its pitch — or null when there is none.
 */
export async function referenceSamples(text: string, opts: SayOptions = {}): Promise<Float32Array | null> {
  const buffer = await clipFor(text, opts);
  return buffer ? downsample(buffer.getChannelData(0), buffer.sampleRate, ANALYSIS_RATE) : null;
}

/**
 * A voice for a hearing drill: the learner's chosen one if it has this text,
 * and otherwise one picked at random from those that do — so the ear learns
 * the sound rather than one speaker.
 */
export async function anyVoiceFor(text: string): Promise<string | undefined> {
  const p = await loadPack();
  const ids = p?.clips[text]?.voices ?? (await serverVoices()).map((v) => v.id);
  const chosen = preferredVoice();
  if (chosen && ids.includes(chosen)) return chosen;
  return ids[Math.floor(Math.random() * ids.length)];
}

/** Something a voice says, to hear what it sounds like: a word if it has one. */
export async function sampleFor(voice: string): Promise<string | null> {
  const clips = Object.entries((await loadPack())?.clips ?? {}).filter(([, c]) => c.voices.includes(voice));
  return (clips.find(([text]) => [...text].length > 1) ?? clips[0])?.[0] ?? null;
}

/** The voices the pack has, for choosing between. */
export async function packVoices(): Promise<NaturalVoice[]> {
  return (await loadPack())?.voices ?? [];
}
