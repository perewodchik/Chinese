import { naturalVoices, speechAudio, type NaturalVoice } from '../../api/speech';
import { ANALYSIS_RATE, downsample } from '../../platform/audio/mic';
import { speak } from '../../platform/speech';

/**
 * Saying things to the learner: a natural voice when the server has one, the
 * system voice when it does not.
 *
 * The natural voice is the one worth imitating, and it is also the one that
 * can be *measured* — its audio arrives as a file, so its pitch can be drawn
 * on the staff beside the learner's. The system voice plays through the
 * operating system and never passes through the page at all, so with it the
 * staff shows the textbook shape instead.
 */

type Ctor = typeof AudioContext;
let ctx: AudioContext | null = null;
const context = () =>
  (ctx ??= new ((window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }).AudioContext ??
    (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext)());

const decoded = new Map<string, Promise<AudioBuffer>>();
let playing: AudioBufferSourceNode | null = null;

function clip(text: string, voice: string, slow: boolean): Promise<AudioBuffer> {
  const key = `${voice}|${slow ? 1 : 0}|${text}`;
  let p = decoded.get(key);
  if (!p) {
    p = speechAudio(text, voice, slow).then((bytes) => context().decodeAudioData(bytes));
    // A failed fetch should be tried again next time, not remembered.
    p.catch(() => decoded.delete(key));
    decoded.set(key, p);
  }
  return p;
}

export interface SayOptions {
  /** a natural voice by id; the first one when left out */
  voice?: string;
  slow?: boolean;
}

/**
 * Says it — naturally if possible. Resolves to what spoke, so a caller can
 * tell whether there is audio to measure.
 */
export async function say(text: string, opts: SayOptions = {}): Promise<'natural' | 'system' | 'none'> {
  const voices = await naturalVoices();
  if (voices.length) {
    try {
      const c = context();
      void c.resume();
      const buffer = await clip(text, opts.voice ?? voices[0]!.id, !!opts.slow);
      playing?.stop();
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.connect(c.destination);
      src.start();
      playing = src;
      return 'natural';
    } catch {
      // Quota used up, network down, key revoked: fall through to the system voice.
    }
  }
  return speak(text, { rate: opts.slow ? 0.7 : 0.85 }) ? 'system' : 'none';
}

/**
 * The natural voice's recording of a text, as samples at the analysis rate —
 * for drawing its pitch — or null when there is no natural voice.
 */
export async function referenceSamples(text: string, opts: SayOptions = {}): Promise<Float32Array | null> {
  const voices = await naturalVoices();
  if (!voices.length) return null;
  try {
    const buffer = await clip(text, opts.voice ?? voices[0]!.id, !!opts.slow);
    return downsample(buffer.getChannelData(0), buffer.sampleRate, ANALYSIS_RATE);
  } catch {
    return null;
  }
}

/** A voice picked at random, so the ear learns the sound rather than the speaker. */
export async function anyVoice(): Promise<NaturalVoice | undefined> {
  const voices = await naturalVoices();
  return voices[Math.floor(Math.random() * voices.length)];
}

export { naturalVoices };
