import type { NarratorDto } from '../../../shared/narration';
import { narrationBlob, narrationOf } from '../../api/narration';
import { ANALYSIS_RATE, downsample } from '../../platform/audio/mic';
import { playSamples } from '../../platform/audio/voiceOut';
import type { Narrated } from '../reader/narratedClips';

/**
 * The example to copy, in a narrator's voice, for any line or word — not only
 * a text a narrator has read whole.
 *
 * A text read whole is cut by its timings, as before. Anything else (a line
 * of a text never read, an everyday phrase, one word of a line, a line slowly)
 * is read by MiniMax on its own, as a text of one line: the server keeps it
 * under the narrator and the words, so it is paid for once and fetched after.
 * Slowly is MiniMax reading it slower, not the recording stretched: the tones
 * stay the shape they are.
 *
 * Everything is decoded once to samples and played through the page's audio,
 * which a tap has woken: on iOS a line fetched after the tap still plays.
 */

/** MiniMax reads at 32 kHz; played back at that, scored and shadowed at 16. */
export const MODEL_RATE = 32_000;

const decoded = new Map<string, Promise<Float32Array>>();

async function decode(blob: Blob): Promise<Float32Array> {
  const bytes = await blob.arrayBuffer();
  try {
    const buf = await new OfflineAudioContext(1, 1, MODEL_RATE).decodeAudioData(bytes.slice(0));
    return buf.getChannelData(0).slice();
  } catch {
    // An engine that will not decode at that rate: at its own, then down.
    const buf = await new OfflineAudioContext(1, 1, 44_100).decodeAudioData(bytes.slice(0));
    return downsample(buf.getChannelData(0), buf.sampleRate, MODEL_RATE);
  }
}

function once(id: string, make: () => Promise<Float32Array>): Promise<Float32Array> {
  let p = decoded.get(id);
  if (!p) {
    p = make();
    p.catch(() => decoded.delete(id));
    decoded.set(id, p);
  }
  return p;
}

/** How slowly "slowly" is: seven tenths of the narrator's own pace, never under MiniMax's least. */
export const slowSpeed = (n: Pick<NarratorDto, 'speed'>) => Math.max(0.5, Math.round(n.speed * 0.7 * 100) / 100);

/** A text of one line, read by the narrator (at `speed`, when given) and kept by the server. */
function single(n: NarratorDto, text: string, speed?: number) {
  return once(`one|${n.id}|${n.voiceId}|${n.speed}|${n.pitch}|${n.emotion ?? ''}|${speed ?? ''}|${text}`, async () => {
    const made = await narrationOf(n.id, [text], { generate: true, ...(speed !== undefined ? { speed } : {}) });
    if (!made) throw new Error('MiniMax sent no reading back.');
    return decode(await narrationBlob(made));
  });
}

/**
 * The example for line `index` of a text, or for any words: cut from the
 * narrator's reading of the whole text when there is one and it is not slow,
 * else read on its own.
 */
export async function modelSamples(n: NarratorDto, text: string, o: { slow?: boolean; whole?: Narrated | null; index?: number } = {}): Promise<Float32Array> {
  const w = o.whole;
  const t = w && o.index !== undefined && w.n.narratorId === n.id ? w.n.timings[o.index] : undefined;
  if (!o.slow && w && t && o.index !== undefined) {
    const all = await once(`whole|${w.n.key}|${w.n.createdAt}`, async () => decode(await narrationBlob(w.n)));
    const next = w.n.timings[o.index + 1]?.[0] ?? Infinity;
    const from = Math.max(0, Math.floor(((t[0] - 80) / 1000) * MODEL_RATE));
    const to = Math.min(all.length, Math.ceil((Math.min(t[1] + 220, next) / 1000) * MODEL_RATE));
    if (to > from) return all.subarray(from, to);
  }
  return single(n, text, o.slow ? slowSpeed(n) : undefined);
}

export const playModel = (samples: Float32Array) => playSamples(samples, MODEL_RATE);

/** The example at the rate the microphone records at, for shadowing through the microphone's own audio. */
export const at16k = (samples: Float32Array) => downsample(samples, MODEL_RATE, ANALYSIS_RATE);
