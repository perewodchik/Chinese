import type { TextNarrationDto } from '../../../shared/narration';
import { listNarrators, narrationAudio, narrationBlob, readingsOf } from '../../api/narration';
import { ANALYSIS_RATE, downsample } from '../../platform/audio/mic';
import { stopSpeaking } from '../../platform/speech';

/**
 * A text's sentences said by a narrator, one at a time, cut out of the
 * narrator's reading of the whole text by its timings — for dictation, which
 * says a sentence, waits, and says it again.
 */

export interface Narrated {
  n: TextNarrationDto;
  name: string;
}

const found = new Map<string, Promise<Narrated[]>>();

/** The narrators' readings of these lines, asked once a page. */
export function narratedReadings(lines: string[]): Promise<Narrated[]> {
  const id = lines.join('\n');
  let p = found.get(id);
  if (!p) {
    p = Promise.all([listNarrators(), readingsOf(lines)]).then(([narrators, kept]) =>
      kept.map((n) => ({ n, name: narrators.find((x) => x.id === n.narratorId)?.name ?? 'Narrator' })),
    );
    p.catch(() => found.delete(id));
    found.set(id, p);
  }
  return p;
}

/** A reading made just now joins what is known of the text. */
export function addReading(lines: string[], r: Narrated) {
  const id = lines.join('\n');
  const before = found.get(id) ?? Promise.resolve([]);
  found.set(
    id,
    before.then((list) => [...list.filter((x) => x.n.narratorId !== r.n.narratorId), r], () => [r]),
  );
}

/** A reading whose audio is here, so a sentence can be said inside the tap that asks for it (iOS wants that). */
export interface Clips {
  url: string;
  timings: Array<[number, number]>;
  narratorId: string;
}

const ready = new Map<string, Clips>();
export const readyClips = (textId: string) => ready.get(textId) ?? null;

/** Fetches the audio ahead of time; null when the text has no narrator's reading. */
export async function prepareClips(textId: string, r: Narrated): Promise<Clips> {
  const url = await narrationAudio(r.n);
  const c = { url, timings: r.n.timings, narratorId: r.n.narratorId };
  ready.set(textId, c);
  // Loaded ahead, so the first tap can move straight to its line and play.
  const a = audio();
  if (a.paused && a.src !== url) {
    a.src = url;
    a.load();
  }
  return c;
}

/** Which narrator dictation uses; "device" for the device's own voice. */
const VOICE = 'hanzi.dictation.voice';
export function dictationVoice(): string | null {
  try {
    return localStorage.getItem(VOICE);
  } catch {
    return null;
  }
}
export function chooseDictationVoice(id: string) {
  try {
    localStorage.setItem(VOICE, id);
  } catch {
    // forgotten between visits
  }
}
export const pickReading = (list: Narrated[], id = dictationVoice()) =>
  id === 'device' ? null : (list.find((r) => r.n.narratorId === id) ?? list[0] ?? null);

let el: HTMLAudioElement | null = null;
let stopAt = Infinity;
let startAt: number | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

function audio(): HTMLAudioElement {
  if (el) return el;
  const a = new Audio();
  a.preload = 'auto';
  // Before the audio knows its length it cannot be moved in it: put where the
  // sentence starts as soon as it can. Never muted meanwhile — iOS pauses an
  // element unmuted outside the tap that started it, so the line never played.
  a.addEventListener('loadedmetadata', () => {
    if (startAt === null) return;
    a.currentTime = startAt;
    startAt = null;
  });
  el = a;
  return a;
}

// A timer rather than animation frames: frames stop when nothing is drawn,
// and the sentence must stop where it ends all the same.
function watch() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (!el || el.paused) clearInterval(timer);
    else if (el.currentTime * 1000 >= stopAt) {
      el.pause();
      clearInterval(timer);
    }
  }, 30);
}

/**
 * Says line `i`: from where it starts to where it ends, with a breath after,
 * never into the next line.
 */
export function playLine(c: Clips, i: number, rate: number) {
  const t = c.timings[i];
  if (!t) return;
  stopSpeaking();
  const a = audio();
  if (a.src !== c.url) a.src = c.url;
  a.playbackRate = rate;
  const next = c.timings[i + 1]?.[0] ?? Infinity;
  stopAt = Math.min(t[1] + 250, next);
  a.muted = false;
  if (a.readyState >= 1) a.currentTime = t[0] / 1000;
  else startAt = t[0] / 1000;
  void a.play().catch(() => undefined);
  watch();
}

export function stopLine() {
  clearInterval(timer);
  el?.pause();
}

const decoded = new Map<string, Promise<Float32Array>>();

/** A reading decoded to 16 kHz mono, as a recording is: once per reading. */
function readingSamples(n: TextNarrationDto): Promise<Float32Array> {
  const id = `${n.key}:${n.createdAt}`;
  let p = decoded.get(id);
  if (!p) {
    p = narrationBlob(n).then(async (blob) => {
      const bytes = await blob.arrayBuffer();
      try {
        // Decoded straight at the rate the scoring wants.
        const buf = await new OfflineAudioContext(1, 1, ANALYSIS_RATE).decodeAudioData(bytes.slice(0));
        return buf.getChannelData(0).slice();
      } catch {
        // An engine that will not decode at that rate: at its own, then down.
        const ctx = new OfflineAudioContext(1, 1, 44_100);
        const buf = await ctx.decodeAudioData(bytes.slice(0));
        return downsample(buf.getChannelData(0), buf.sampleRate, ANALYSIS_RATE);
      }
    });
    p.catch(() => decoded.delete(id));
    decoded.set(id, p);
  }
  return p;
}

/** Line `i` of a narrator's reading as samples, to be scored like the learner's own recording. */
export async function narratedLine(r: Narrated, i: number): Promise<Float32Array> {
  const t = r.n.timings[i];
  if (!t) throw new Error('This reading has no timing for the line.');
  const all = await readingSamples(r.n);
  const next = r.n.timings[i + 1]?.[0] ?? Infinity;
  const from = Math.max(0, Math.floor(((t[0] - 100) / 1000) * ANALYSIS_RATE));
  const to = Math.min(all.length, Math.ceil((Math.min(t[1] + 200, next) / 1000) * ANALYSIS_RATE));
  return all.slice(from, to);
}
