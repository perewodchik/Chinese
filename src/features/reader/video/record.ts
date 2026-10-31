import { momentAt, partAt, type VideoLook, type VideoMoment, type VideoPlan } from '../../../domain/textVideo';
import { scoreMusic } from './music';

/**
 * Plays a text's video plan — and, when asked, records it — on this device.
 *
 * Everything that is heard is laid out at the start on one Web Audio clock:
 * each paragraph's stretch of the narrator's reading (decoded beforehand into
 * an AudioBuffer), each question's and answer's, and the music; the picture
 * follows the same clock. There is no <audio> element: on an iPhone an element
 * routed through Web Audio came out silent once and doubled another time, and
 * a buffer scheduled on the context's own time can do neither.
 *
 * Recording is in real time: the canvas as a video track and the context's
 * sound into a MediaRecorder — MP4 in Safari, WebM elsewhere. It must start
 * inside a tap, which is where iOS lets a page's audio begin. A plan cut into
 * parts is played once; the recorder is changed where a part begins, so each
 * part is a video of its own.
 */

export interface Run {
  stop(): void;
  /** the recordings, a part each, once the plan has played to the end; null when stopped or not recording */
  done: Promise<Blob[] | null>;
}

export const canRecord = () =>
  typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;

const TYPES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
export const recordingType = () => (typeof MediaRecorder === 'undefined' ? '' : (TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''));

/** A reading decoded for laying out, done before the tap so the tap can start at once. */
export async function decodeReading(blob: Blob): Promise<AudioBuffer> {
  return new OfflineAudioContext(1, 1, 48_000).decodeAudioData(await blob.arrayBuffer());
}

export function run(o: {
  canvas: HTMLCanvasElement;
  plan: VideoPlan;
  timings: Array<[number, number]>;
  /** the narrator's reading */
  reading: AudioBuffer;
  /** the questions' reading, when the plan says them */
  asked?: AudioBuffer | null;
  /** quiet music under it; only when it is played from the start */
  music?: VideoLook['music'];
  draw: (m: VideoMoment) => void;
  record: boolean;
  /** where to start, ms into the video */
  from?: number;
  onTime?: (t: number) => void;
}): Run {
  const from = Math.max(0, Math.min(o.from ?? 0, o.plan.duration - 1));
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new AC();
  void ac.resume();

  // Everything heard goes into `mixed`: to the recording when recording (and
  // to the speakers through a gain of nothing, so the graph runs), else out loud.
  const mixed = ac.createGain();
  let dest: MediaStreamAudioDestinationNode | null = null;
  if (o.record) {
    dest = ac.createMediaStreamDestination();
    mixed.connect(dest);
    const hush = ac.createGain();
    hush.gain.value = 0;
    mixed.connect(hush).connect(ac.destination);
  } else mixed.connect(ac.destination);

  // The video's time 0 on the context's clock, a moment from now.
  const t0 = ac.currentTime + 0.2 - from / 1000;
  const sources: AudioScheduledSourceNode[] = [];
  const voice: Array<[number, number]> = [];
  for (const s of o.plan.steps) {
    const said =
      s.kind === 'para'
        ? { from: s.from, to: s.to, buffer: o.reading, delay: 0 }
        : (s.kind === 'question' || s.kind === 'answer') && s.said && o.asked
          ? { ...s.said, buffer: o.asked, delay: 250 }
          : null;
    if (!said || said.to <= said.from) continue;
    let when = t0 + (s.at + said.delay) / 1000;
    let offset = said.from / 1000;
    let dur = (said.to - said.from) / 1000;
    const now = ac.currentTime + 0.2;
    if (when + dur <= now) continue;
    if (when < now) {
      // Played from the middle of it: from where the video starts.
      offset += now - when;
      dur -= now - when;
      when = now;
    }
    const src = ac.createBufferSource();
    src.buffer = said.buffer;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(1, when + 0.02);
    gain.gain.setValueAtTime(1, Math.max(when + 0.02, when + dur - 0.06));
    gain.gain.linearRampToValueAtTime(0, when + dur);
    src.connect(gain).connect(mixed);
    src.start(when, offset, dur);
    sources.push(src);
    voice.push([(s.at + said.delay) / 1000, (s.at + said.delay) / 1000 + dur]);
  }
  if (o.music && o.music !== 'off' && from === 0) scoreMusic(ac, o.music, o.plan.duration / 1000, voice, mixed, t0);

  let stopped = false;
  let over = false;
  let finish: (b: Blob[] | null) => void = () => undefined;
  const done = new Promise<Blob[] | null>((r) => (finish = r));

  const type = recordingType();
  const tracks = o.record && dest ? [...o.canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()] : [];
  const stream = tracks.length ? new MediaStream(tracks) : null;
  const blobs: Blob[] = [];
  let recording = 0;
  let recorder: MediaRecorder | null = null;
  const settle = () => {
    if (over && recording === 0) finish(stopped || !blobs.length ? null : blobs);
  };
  /** A recorder for the part beginning now. */
  const record = (part: number) => {
    if (!stream) return;
    const chunks: Blob[] = [];
    const r = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 3_500_000 });
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      blobs[part] = new Blob(chunks, { type: r.mimeType || type || 'video/mp4' });
      recording -= 1;
      settle();
    };
    recording += 1;
    r.start(1000);
    recorder = r;
  };

  let frame = 0;
  let part = partAt(o.plan, from);
  const end = () => {
    if (over) return;
    over = true;
    cancelAnimationFrame(frame);
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        // not started yet, or already over
      }
    }
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    settle();
    void done.finally(() => {
      for (const t of tracks) t.stop();
      void ac.close();
    });
  };

  const tick = () => {
    if (over) return;
    const t = Math.max(from, (ac.currentTime - t0) * 1000);
    const m = momentAt(o.plan, Math.min(t, o.plan.duration - 1), o.timings);
    o.draw(m);
    o.onTime?.(Math.min(t, o.plan.duration));
    if (o.record && m.part !== part) {
      // A new part begins with this frame: the last part's video ends, the next one's starts.
      part = m.part;
      recorder?.stop();
      record(part);
    }
    // The last frame held a moment, so the video does not end on a cut.
    if (t >= o.plan.duration + 400) {
      end();
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  // The first frame is on the canvas before the recorder starts.
  o.draw(momentAt(o.plan, from, o.timings));
  if (o.record) record(part);
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      end();
    },
    done,
  };
}
