import { naturalVoices as serverVoices, speechAudio, type NaturalVoice } from '../../api/speech';
import { ANALYSIS_RATE, downsample } from '../../platform/audio/mic';
import { speak, stopSpeaking, unlockSpeech } from '../../platform/speech';
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
let meter: AnalyserNode | null = null;
let frames: Uint8Array<ArrayBuffer> | null = null;

const context = () => {
  if (!ctx) {
    ctx = new ((window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }).AudioContext ??
      (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext)();
    // Everything the page plays goes through one meter on its way out, so
    // that a face can be given the shape of the sound rather than a guess at
    // it. An analyser passes what it is given through untouched.
    meter = ctx.createAnalyser();
    meter.fftSize = 1024;
    meter.smoothingTimeConstant = 0.3;
    frames = new Uint8Array(meter.fftSize);
    meter.connect(ctx.destination);
  }
  return ctx;
};

/** Where a clip is played into: the meter, which passes it on to the speakers. */
const output = (): AudioNode => (context(), meter ?? ctx!.destination);

/**
 * How loud the page is at this instant, 0 to 1 — the root mean square of the
 * last few milliseconds of whatever is playing.
 *
 * Used to move a portrait's mouth with the voice coming out of it. It is 0
 * when nothing is playing, and also when the system voice is speaking: that
 * one is spoken by the operating system and never passes through the page,
 * which is why a face has to fall back to making its own shapes.
 */
export function voiceLevel(): number {
  if (!meter || !frames) return 0;
  meter.getByteTimeDomainData(frames);
  let sum = 0;
  for (let i = 0; i < frames.length; i++) {
    const v = (frames[i]! - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / frames.length);
}

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
  /**
   * Play the recording at a fraction of its speed, keeping the pitch.
   *
   * The voice reads a sentence at the speed a person actually talks, which is
   * around six syllables a second — natural, and past what a learner can say
   * along with. Shadowing asks for the same reading slowed down, not for a
   * different, more laboured one: the rhythm of the sentence is the thing
   * being copied, and a voice that pauses between characters has none.
   */
  pace?: number;
}

/** Where the pack keeps a text, for the player that needs a file rather than samples. */
async function packUrl(text: string, opts: SayOptions): Promise<string | null> {
  const p = await loadPack();
  const entry = p?.clips[text];
  if (!entry?.voices.length) return null;
  const wanted = opts.voice ?? preferredVoice();
  const voice = wanted && entry.voices.includes(wanted) ? wanted : entry.voices[0]!;
  return `/voices/${voice}/${entry.name}.mp3`;
}

/**
 * Slowing it down without lowering it.
 *
 * Web Audio's `playbackRate` resamples: at 0.6 the voice is also a fifth
 * lower, which is a different person and the wrong tones. An audio element
 * stretches the time and leaves the pitch where it was, which is the only
 * way to hear the same reading more slowly.
 */
let element: HTMLAudioElement | null = null;

function playSlowly(url: string, pace: number): 'natural' {
  element?.pause();
  const el = new Audio(url);
  // Safari spells it with a prefix, and an older one not at all — where it is
  // missing the rate still works and the voice drops, which is worse than the
  // sentence being fast, so it is left alone.
  const media = el as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };
  if ('preservesPitch' in media || 'webkitPreservesPitch' in media) {
    media.preservesPitch = true;
    media.webkitPreservesPitch = true;
    el.playbackRate = pace;
  }
  element = el;
  void el.play().catch(() => undefined);
  return 'natural';
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
  if (opts.pace && opts.pace !== 1) {
    const url = await packUrl(text, opts);
    if (url) {
      playing?.stop();
      return playSlowly(url, opts.pace);
    }
  }
  const buffer = await clipFor(text, opts);
  if (buffer && c) {
    playing?.stop();
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(output());
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

/**
 * Which voices actually read this text — not which voices exist.
 *
 * The difference is the whole of a bug worth remembering. The native speaker
 * is a set of single-syllable recordings and has nothing longer; ask for a
 * sentence in that voice and the pack quietly hands over the designed voice's
 * clip instead. The picker then says Native Speaker while Chen is talking,
 * which is worse than having no choice at all: a learner copying a voice has
 * been told, wrongly, that this is what a native sounds like. A control that
 * cannot be honoured should not be offered, so the picker asks this first.
 */
export async function voicesFor(text: string): Promise<string[]> {
  const clean = text.trim();
  if (!clean) return [];
  return (await loadPack())?.clips[clean]?.voices ?? [];
}

/**
 * Everything the pack has a recording of.
 *
 * For shadowing, which is copying a voice: a sentence nobody reads is one the
 * system voice reads, and that is the one voice in the app not worth copying
 * — no pitch to draw against yours, and tones it gets right by accident. So
 * the page offers what somebody actually says, and the shelf grows again the
 * next time the pack is built.
 */
export async function packTexts(): Promise<Set<string>> {
  return new Set(Object.keys((await loadPack())?.clips ?? {}));
}

/**
 * Wakes both ways of making a sound inside a tap. iOS starts audio only from
 * a gesture; once woken, a reply that arrives seconds later can still be heard.
 */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  void context().resume();
  unlockSpeech();
}

/**
 * Plays MP3 bytes to the end, at `rate` — 1 unless somebody is skimming.
 * Resolves when it has finished, or was stopped.
 */
export async function playBytes(bytes: ArrayBuffer, rate = 1): Promise<void> {
  const c = context();
  void c.resume();
  const buffer = await c.decodeAudioData(bytes);
  return new Promise((resolve) => {
    playing?.stop();
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    src.connect(output());
    src.onended = () => {
      if (playing === src) playing = null;
      resolve();
    };
    src.start();
    playing = src;
  });
}

/**
 * MP3 bytes played to the end at `pace`, keeping the pitch, resolving when
 * they have finished or been cut off.
 *
 * The conversation's clips are made as they are needed rather than sitting in
 * the pack as files, so they reach the audio element through a blob URL. The
 * element is the player worth the trouble: `playbackRate` on a Web Audio
 * source resamples, which drops the voice along with the speed, and in a
 * language where pitch carries the meaning that is not a slower reading of the
 * sentence — it is a different one, with the tones moved.
 */
export function playBytesAtPace(bytes: ArrayBuffer, pace: number): Promise<void> {
  return new Promise((resolve) => {
    playing?.stop();
    element?.pause();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
    const el = new Audio(url);
    // Safari spells it with a prefix, and an older one not at all; where it is
    // missing the clip still slows and the voice drops with it.
    const media = el as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };
    media.preservesPitch = true;
    media.webkitPreservesPitch = true;
    el.playbackRate = pace;
    // Pausing is how `hush` stops it, and a turn that was cut off is as
    // finished as one that ended. Calling this twice is harmless.
    const done = () => {
      URL.revokeObjectURL(url);
      if (element === el) element = null;
      resolve();
    };
    el.onended = done;
    el.onerror = done;
    el.onpause = done;
    element = el;
    void el.play().catch(done);
  });
}

/** Silence, whichever voice is talking. */
export function hush() {
  playing?.stop();
  playing = null;
  element?.pause();
  element = null;
  stopSpeaking();
}
