/**
 * The pitch of a voice, frame by frame.
 *
 * YIN (de Cheveigné & Kawahara, 2002): for each short window, find the lag at
 * which the signal best matches a shifted copy of itself — that lag is one
 * period of the voice. It is old, small and dependable on speech, needs no
 * model and no download, and runs well inside a frame budget on an iPad.
 *
 * Pure arithmetic on samples, so it runs the same in the browser and in a
 * test. The recording is resampled to 16 kHz before it gets here; that is
 * plenty for a voice whose pitch tops out well under 1 kHz, and it makes the
 * search four times cheaper than at 48 kHz.
 */

export interface PitchFrame {
  /** seconds from the start */
  t: number;
  /** Hz, or 0 where there is no voiced pitch */
  hz: number;
  /** loudness, root mean square of the window */
  rms: number;
}

export interface PitchOptions {
  sampleRate: number;
  /** seconds between frames */
  hop?: number;
  /** seconds per analysis window */
  window?: number;
  minHz?: number;
  maxHz?: number;
  /** YIN's aperiodicity threshold; lower is stricter */
  threshold?: number;
}

export function trackPitch(samples: Float32Array, opts: PitchOptions): PitchFrame[] {
  const { sampleRate } = opts;
  const hop = Math.round((opts.hop ?? 0.01) * sampleRate);
  const size = Math.round((opts.window ?? 0.04) * sampleRate);
  const minLag = Math.floor(sampleRate / (opts.maxHz ?? 500));
  const maxLag = Math.min(Math.ceil(sampleRate / (opts.minHz ?? 70)), size - 1);
  const threshold = opts.threshold ?? 0.15;
  const frames: PitchFrame[] = [];
  const diff = new Float32Array(maxLag + 1);
  const width = size - maxLag;

  for (let start = 0; start + size <= samples.length; start += hop) {
    let energy = 0;
    for (let i = 0; i < size; i++) energy += samples[start + i]! ** 2;
    const rms = Math.sqrt(energy / size);

    // Difference function, then cumulative-mean normalised.
    diff[0] = 1;
    let running = 0;
    let lag = -1;
    for (let tau = 1; tau <= maxLag; tau++) {
      let d = 0;
      for (let i = 0; i < width; i++) {
        const delta = samples[start + i]! - samples[start + i + tau]!;
        d += delta * delta;
      }
      running += d;
      diff[tau] = running ? (d * tau) / running : 1;
    }
    // The first dip under the threshold, followed to the bottom of that dip.
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (diff[tau]! < threshold) {
        while (tau + 1 <= maxLag && diff[tau + 1]! < diff[tau]!) tau++;
        lag = tau;
        break;
      }
    }
    let hz = 0;
    if (lag > 0) {
      // Parabolic interpolation between the neighbouring lags for sub-sample accuracy.
      const a = diff[lag - 1] ?? diff[lag]!;
      const b = diff[lag]!;
      const c = diff[lag + 1] ?? diff[lag]!;
      const denom = a - 2 * b + c;
      const shift = denom ? (0.5 * (a - c)) / denom : 0;
      hz = sampleRate / (lag + Math.max(-1, Math.min(1, shift)));
    }
    frames.push({ t: (start + size / 2) / sampleRate, hz, rms });
  }
  return smooth(frames);
}

/**
 * Takes out the two mistakes a pitch tracker makes on speech.
 *
 * Octave jumps — a frame read at half or double the real pitch — are folded
 * back towards their neighbours. Lone voiced frames in silence, and lone
 * silent frames inside a vowel, are removed or filled. Then a three-point
 * median takes off the last of the jitter without rounding off a real fall.
 */
function smooth(frames: PitchFrame[]): PitchFrame[] {
  const hz = frames.map((f) => f.hz);
  const n = hz.length;
  const around = (i: number) => {
    const xs: number[] = [];
    for (let k = Math.max(0, i - 5); k <= Math.min(n - 1, i + 5); k++) if (k !== i && hz[k]! > 0) xs.push(hz[k]!);
    xs.sort((a, b) => a - b);
    return xs.length ? xs[xs.length >> 1]! : 0;
  };
  for (let i = 0; i < n; i++) {
    const f = hz[i]!;
    const m = around(i);
    if (!f || !m) continue;
    const ratio = f / m;
    if (ratio > 1.8 && ratio < 2.2) hz[i] = f / 2;
    else if (ratio > 0.45 && ratio < 0.55) hz[i] = f * 2;
  }
  for (let i = 1; i < n - 1; i++) {
    if (hz[i]! > 0 && !hz[i - 1] && !hz[i + 1]) hz[i] = 0;
    else if (!hz[i] && hz[i - 1]! > 0 && hz[i + 1]! > 0) hz[i] = (hz[i - 1]! + hz[i + 1]!) / 2;
  }
  const out = hz.map((f, i) => {
    if (!f || i === 0 || i === n - 1 || !hz[i - 1] || !hz[i + 1]) return f;
    return [hz[i - 1]!, f, hz[i + 1]!].sort((a, b) => a - b)[1]!;
  });
  return frames.map((fr, i) => ({ ...fr, hz: out[i]! }));
}
