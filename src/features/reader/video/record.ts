import { momentAt, partAt, type VideoMoment, type VideoPlan } from '../../../domain/textVideo';

/**
 * Plays a text's video plan — and, when asked, records it — on this device.
 *
 * The narrator's reading is one recording: a paragraph plays its stretch of
 * it, and the video's clock follows the audio there, so the subtitles change
 * exactly when the narrator moves on. Between paragraphs (the title, the
 * pauses, the questions) the clock is the wall clock and the audio waits.
 *
 * Recording is in real time: the canvas as a video track and the audio, taken
 * from the element through Web Audio, into a MediaRecorder — MP4 in Safari,
 * WebM elsewhere. It must start inside a tap: iOS lets a page make sound only
 * there, and the first tap is what unlocks the audio for the rest.
 *
 * A plan cut into parts is still played once, the reading going straight on;
 * the recorder is only changed where a part begins, so each part is a video
 * of its own.
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

export function run(o: {
  canvas: HTMLCanvasElement;
  plan: VideoPlan;
  timings: Array<[number, number]>;
  audioUrl: string;
  draw: (m: VideoMoment) => void;
  record: boolean;
  /** where to start, ms into the video */
  from?: number;
  onTime?: (t: number) => void;
}): Run {
  const audio = new Audio(o.audioUrl);
  audio.preload = 'auto';
  let stopped = false;
  let finish: (b: Blob[] | null) => void = () => undefined;
  const done = new Promise<Blob[] | null>((r) => (finish = r));

  let recorder: MediaRecorder | null = null;
  let ac: AudioContext | null = null;
  let tracks: MediaStreamTrack[] = [];
  let stream: MediaStream | null = null;
  const type = recordingType();
  const blobs: Blob[] = [];
  let recording = 0;
  let over = false;
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
  if (o.record) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ac = new AC();
    void ac.resume();
    const source = ac.createMediaElementSource(audio);
    const dest = ac.createMediaStreamDestination();
    source.connect(dest);
    source.connect(ac.destination);
    const video = o.canvas.captureStream(30);
    tracks = [...video.getVideoTracks(), ...dest.stream.getAudioTracks()];
    stream = new MediaStream(tracks);
  }
  // Unlocked inside the tap; played for real when the first paragraph comes.
  void audio.play().then(
    () => {
      if (!playingAudio) audio.pause();
    },
    () => undefined,
  );

  const steps = o.plan.steps;
  let index = Math.max(0, steps.findIndex((s) => (o.from ?? 0) < s.at + s.dur));
  let enteredAt = performance.now() - Math.max(0, (o.from ?? 0) - (steps[index]?.at ?? 0));
  let entered = false;
  let playingAudio = false;
  let frame = 0;
  let part = partAt(o.plan, o.from ?? 0);

  const end = () => {
    if (over) return;
    over = true;
    cancelAnimationFrame(frame);
    audio.pause();
    playingAudio = false;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    settle();
    // The tracks end once the last recorder has its data.
    void done.finally(() => {
      for (const t of tracks) t.stop();
      void ac?.close();
    });
  };

  const tick = () => {
    if (over) return;
    const step = steps[index];
    if (!step) {
      o.draw(momentAt(o.plan, o.plan.duration, o.timings));
      o.onTime?.(o.plan.duration);
      frame = requestAnimationFrame(tick);
      return;
    }
    let t: number;
    if (step.kind === 'para') {
      if (!entered) {
        entered = true;
        const into = Math.max(0, performance.now() - enteredAt);
        const start = (step.from + Math.min(into, step.dur)) / 1000;
        if (Math.abs(audio.currentTime - start) > 0.08) audio.currentTime = start;
        playingAudio = true;
        void audio.play().catch(() => undefined);
      }
      const ms = audio.currentTime * 1000;
      t = step.at + Math.max(0, ms - step.from);
      if (ms >= step.to - 10 || audio.ended) {
        // On to the next step; the audio goes on only if the next paragraph follows at once.
        if (steps[index + 1]?.kind !== 'para') {
          audio.pause();
          playingAudio = false;
        }
        next();
      }
    } else {
      entered = true;
      const into = performance.now() - enteredAt;
      t = step.at + Math.min(into, step.dur);
      if (into >= step.dur) next();
    }
    const m = momentAt(o.plan, t, o.timings);
    o.draw(m);
    if (o.record && m.part !== part) {
      // A new part begins with this frame: the last part's video ends, the next one's starts.
      part = m.part;
      recorder?.stop();
      record(part);
    }
    o.onTime?.(t);
    frame = requestAnimationFrame(tick);
  };

  const next = () => {
    index += 1;
    entered = false;
    enteredAt = performance.now();
    if (index >= steps.length) {
      // The last frame held a moment, so the video does not end on a cut.
      setTimeout(end, 400);
      index = steps.length;
    }
  };

  // The first frame is on the canvas before the recorder starts.
  o.draw(momentAt(o.plan, o.from ?? 0, o.timings));
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
