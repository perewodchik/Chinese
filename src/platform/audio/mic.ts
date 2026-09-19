/**
 * The microphone, as raw samples.
 *
 * Not MediaRecorder: that hands back a compressed file which then has to be
 * decoded again, differently on every browser (Safari records MP4, Chrome
 * WebM), before a single pitch can be read. Taking the samples straight off
 * the audio graph skips all of it and keeps them exact.
 *
 * Three things the browser does to a voice by default are switched off —
 * echo cancellation, noise suppression and automatic gain. They are built for
 * calls, and all three bend pitch and loudness in ways that look like tone.
 *
 * A microphone needs a secure page: https, or localhost. On the home Wi-Fi
 * address (http://192.168…) the browser simply does not offer one, and the
 * message says so rather than failing silently.
 */

export type MicProblem = 'insecure' | 'unsupported' | 'denied' | 'no-device' | 'failed';

export class MicError extends Error {
  constructor(readonly problem: MicProblem, message: string) {
    super(message);
  }
}

export const MIC_MESSAGE: Record<MicProblem, string> = {
  insecure:
    'The microphone only works on a secure address. Open the app over https (the online version), or on this computer at localhost.',
  unsupported: 'This browser cannot record audio. Safari on iPadOS 14.5 or later, Chrome or Edge will.',
  denied:
    'The microphone was refused. On an iPad: Settings › Safari › Microphone, or the “aA” menu in the address bar › Website Settings.',
  'no-device': 'No microphone was found.',
  failed: 'The microphone could not be opened.',
};

/** Why recording will not work here, before anything is asked of the user. */
export function micUnavailable(): MicProblem | null {
  if (typeof window === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia || !('AudioContext' in window || 'webkitAudioContext' in window)) {
    return 'unsupported';
  }
  return null;
}

type Ctor = typeof AudioContext;
const AudioCtx = (): Ctor =>
  (window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }).AudioContext ??
  (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext;

/** The sample rate analysis runs at. */
export const ANALYSIS_RATE = 16000;

/**
 * An open microphone, kept open for a whole practice sitting.
 *
 * Opening it is the slow part and, on iOS, the part that can ask permission
 * again; keeping one session for the sitting makes every recording after the
 * first start the instant the button is touched.
 */
export class MicSession {
  private chunks: Float32Array[] = [];
  private recording = false;
  private constructor(
    private readonly ctx: AudioContext,
    private readonly stream: MediaStream,
    private readonly nodes: AudioNode[],
    /** latest loudness, 0–1, for a level meter */
    public onLevel: (rms: number) => void = () => undefined,
  ) {}

  /** Must be called from a tap or a click: iOS will not start audio otherwise. */
  static async open(): Promise<MicSession> {
    const why = micUnavailable();
    if (why) throw new MicError(why, MIC_MESSAGE[why]);

    const ctx = new (AudioCtx())();
    // Resume inside the gesture, before any await, or Safari keeps it suspended.
    const resumed = ctx.resume();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch (e) {
      void ctx.close();
      const name = (e as DOMException)?.name;
      const problem: MicProblem =
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'no-device'
            : 'failed';
      throw new MicError(problem, MIC_MESSAGE[problem]);
    }
    await resumed;

    const source = ctx.createMediaStreamSource(stream);
    let session!: MicSession;
    const take = (block: Float32Array) => session.take(block);

    let tap: AudioNode;
    if (ctx.audioWorklet) {
      await ctx.audioWorklet.addModule('/audio/capture-worklet.js');
      const node = new AudioWorkletNode(ctx, 'capture');
      node.port.onmessage = (e: MessageEvent<Float32Array>) => take(e.data);
      tap = node;
    } else {
      // Older Safari: the deprecated processor, which every engine still runs.
      const node = ctx.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = (e) => take(new Float32Array(e.inputBuffer.getChannelData(0)));
      tap = node;
    }
    // The tap has to reach the destination to be pulled; a muted gain keeps
    // the microphone out of the speakers.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(tap);
    tap.connect(mute);
    mute.connect(ctx.destination);

    session = new MicSession(ctx, stream, [source, tap, mute]);
    return session;
  }

  get sampleRate() {
    return this.ctx.sampleRate;
  }

  private take(block: Float32Array) {
    let sum = 0;
    for (let i = 0; i < block.length; i++) sum += block[i]! * block[i]!;
    this.onLevel(Math.sqrt(sum / block.length));
    if (this.recording) this.chunks.push(block);
  }

  start() {
    void this.ctx.resume();
    this.chunks = [];
    this.recording = true;
  }

  /** The recording so far, at the analysis rate. */
  stop(): Float32Array {
    this.recording = false;
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const all = new Float32Array(total);
    let at = 0;
    for (const c of this.chunks) {
      all.set(c, at);
      at += c.length;
    }
    this.chunks = [];
    return downsample(all, this.ctx.sampleRate, ANALYSIS_RATE);
  }

  /** Plays samples back, at the analysis rate. Returns a function that stops it. */
  play(samples: Float32Array, rate = ANALYSIS_RATE): () => void {
    void this.ctx.resume();
    const buffer = this.ctx.createBuffer(1, samples.length, rate);
    buffer.copyToChannel(new Float32Array(samples), 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    src.start();
    return () => {
      try {
        src.stop();
      } catch {
        void 0;
      }
    };
  }

  close() {
    this.recording = false;
    for (const n of this.nodes) n.disconnect();
    for (const t of this.stream.getTracks()) t.stop();
    void this.ctx.close();
  }
}

/**
 * Down to a lower sample rate by averaging each output sample's share of the
 * input — a box filter, which is crude as audio but keeps everything a pitch
 * tracker cares about and removes what would alias.
 */
export function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let k = a; k < b; k++) sum += input[k]!;
    out[i] = sum / Math.max(1, b - a);
  }
  return out;
}
