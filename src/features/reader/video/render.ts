import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { VideoPlan } from '../../../domain/textVideo';
import { H, W } from './draw';

/**
 * Makes a text's video faster than it plays, where the browser can encode
 * (WebCodecs: Safari 26, Chrome): every frame is drawn and handed to the
 * encoder as fast as it takes it, and the sound is laid out ahead of time —
 * each paragraph's stretch of the reading at its place, fading in and out over
 * a few hundredths of a second so no cut clicks — then both are put in an MP4.
 * A minute and a half of video is ready in seconds, not in a minute and a half.
 *
 * Where the browser cannot, `record.ts` records it as it plays.
 */

const FPS = 30;
const RATE = 48_000;

/** H.264 where there is an encoder for it (Safari, Chrome on a Mac); VP9 in an MP4 where there is not. */
async function videoConfig(): Promise<{ config: VideoEncoderConfig; codec: 'avc' | 'vp9' } | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  const tries: Array<[string, 'avc' | 'vp9']> = [
    ['avc1.640028', 'avc'],
    ['avc1.4d0028', 'avc'],
    ['avc1.42003e', 'avc'],
    ['vp09.00.40.08', 'vp9'],
  ];
  for (const [codec, kind] of tries) {
    const c: VideoEncoderConfig = { codec, width: W, height: H, bitrate: 3_500_000, framerate: FPS, ...(kind === 'avc' ? { avc: { format: 'avc' } } : {}) };
    try {
      if ((await VideoEncoder.isConfigSupported(c)).supported) return { config: c, codec: kind };
    } catch {
      // the next
    }
  }
  return null;
}

async function audioConfig(channels: number): Promise<{ config: AudioEncoderConfig; codec: 'aac' | 'opus' } | null> {
  if (typeof AudioEncoder === 'undefined') return null;
  for (const [codec, kind] of [
    ['mp4a.40.2', 'aac'],
    ['opus', 'opus'],
  ] as const) {
    const c: AudioEncoderConfig = { codec, sampleRate: RATE, numberOfChannels: channels, bitrate: 128_000 };
    try {
      if ((await AudioEncoder.isConfigSupported(c)).supported) return { config: c, codec: kind };
    } catch {
      // the next
    }
  }
  return null;
}

/** Whether this browser makes the video quickly. */
export async function canRenderFast(): Promise<boolean> {
  if (typeof VideoFrame === 'undefined' || typeof AudioData === 'undefined' || typeof OfflineAudioContext === 'undefined') return false;
  return (await videoConfig()) !== null && (await audioConfig(1)) !== null;
}

const breathe = () => new Promise((r) => setTimeout(r, 0));

export interface Render {
  stop(): void;
  /** a video for each part; null when stopped */
  done: Promise<Blob[] | null>;
}

export function renderFast(o: {
  canvas: HTMLCanvasElement;
  plan: VideoPlan;
  audioUrl: string;
  /** draws the moment at t (ms into the video) on the canvas */
  draw: (t: number) => void;
  onTime?: (t: number) => void;
}): Render {
  let stopped = false;
  const done = (async () => {
    const bytes = await (await fetch(o.audioUrl)).arrayBuffer();
    const reading = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(bytes);
    const channels = Math.min(2, reading.numberOfChannels);
    const vc = await videoConfig();
    const ac = await audioConfig(channels);
    if (!vc || !ac) throw new Error('This browser cannot make the video quickly.');
    const out: Blob[] = [];
    for (const part of o.plan.parts) {
      if (stopped) return null;
      out.push(await renderPart(part, reading, channels, vc, ac));
    }
    return stopped ? null : out;
  })();

  async function renderPart(
    part: { at: number; dur: number },
    reading: AudioBuffer,
    channels: number,
    vc: { config: VideoEncoderConfig; codec: 'avc' | 'vp9' },
    ac: { config: AudioEncoderConfig; codec: 'aac' | 'opus' },
  ): Promise<Blob> {
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: vc.codec, width: W, height: H, frameRate: FPS },
      audio: { codec: ac.codec, numberOfChannels: channels, sampleRate: RATE },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });
    let failed: Error | null = null;
    const fail = (e: Error) => {
      failed = e;
    };

    // The sound: the reading's stretches at their places in the part.
    const length = Math.max(1, Math.ceil((part.dur / 1000) * RATE));
    const mix = new OfflineAudioContext(channels, length, RATE);
    for (const s of o.plan.steps) {
      if (s.kind !== 'para' || s.at < part.at || s.at >= part.at + part.dur || s.to <= s.from) continue;
      const when = (s.at - part.at) / 1000;
      const dur = (s.to - s.from) / 1000;
      const src = mix.createBufferSource();
      src.buffer = reading;
      const gain = mix.createGain();
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(1, when + 0.02);
      gain.gain.setValueAtTime(1, Math.max(when + 0.02, when + dur - 0.06));
      gain.gain.linearRampToValueAtTime(0, when + dur);
      src.connect(gain).connect(mix.destination);
      src.start(when, s.from / 1000, dur);
    }
    const sound = await mix.startRendering();

    const audio = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: fail });
    audio.configure(ac.config);
    for (let i = 0; i < length; i += 1024) {
      const n = Math.min(1024, length - i);
      const data = new Float32Array(n * channels);
      for (let c = 0; c < channels; c++) data.set(sound.getChannelData(c).subarray(i, i + n), c * n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: RATE, numberOfFrames: n, numberOfChannels: channels, timestamp: Math.round((i / RATE) * 1e6), data });
      audio.encode(ad);
      ad.close();
    }
    await audio.flush();
    audio.close();

    // The pictures, a frame at a time, as fast as the encoder takes them.
    const video = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: fail });
    video.configure(vc.config);
    const frames = Math.max(1, Math.round((part.dur / 1000) * FPS));
    for (let i = 0; i < frames; i++) {
      if (stopped) break;
      if (failed) throw failed;
      const t = part.at + (i * 1000) / FPS;
      o.draw(t);
      const frame = new VideoFrame(o.canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      video.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      while (video.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
      if (i % 8 === 0) {
        o.onTime?.(t);
        await breathe();
      }
    }
    await video.flush();
    video.close();
    if (failed) throw failed;
    muxer.finalize();
    return new Blob([target.buffer], { type: 'video/mp4' });
  }

  return {
    stop() {
      stopped = true;
    },
    done,
  };
}
