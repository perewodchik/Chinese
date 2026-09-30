/**
 * The city's own sounds (§13 N1), made on the spot like G1's pigeons and
 * bells: no recordings, nothing to download. Each takes a context and where
 * to play, so the same code plays in the game and renders offline for the
 * checks (N2: `scripts/world/sound-render.mjs`).
 *
 *   muyu          a temple: the 木鱼's hollow tock under a low chanting hum
 *   jingju        a 京剧 radio in a courtyard: a 京胡-like fiddle phrase over 板 clacks, small and far
 *   mahjong       a 胡同 door in the evening: tiles clattering and being shuffled
 *   dance         广场舞: a bright four-beat tune on a small speaker (a loop while you are there)
 *   cicadas       知了 on a summer day: a shimmering swell
 *   crows         winter dusk: two or three caws
 *   firecrackers  春节: a short string of cracks — a burst, not a barrage
 *
 * Loudness: each peaks at or below the music's level (`LEVEL`), and the city
 * gain ducks while someone talks, as the music does (ambient.ts).
 */

export type Ctx = BaseAudioContext;

/** the loudest any city sound gets, before the street's volume (the music's band peaks near this) */
export const LEVEL = 0.12;

/** a small noise buffer, made once per context */
const noises = new WeakMap<Ctx, AudioBuffer>();
function noise(ctx: Ctx): AudioBuffer {
  let b = noises.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    noises.set(ctx, b);
  }
  return b;
}

/** a tone with a quick attack and an exponential fall */
function tone(ctx: Ctx, out: AudioNode, at: number, f: number, type: OscillatorType, peak: number, len: number, bend = 1) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (bend !== 1) o.frequency.exponentialRampToValueAtTime(f * bend, at + len);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + len + 0.02);
}

/** a burst of filtered noise */
function hiss(ctx: Ctx, out: AudioNode, at: number, len: number, peak: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass') {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.01, len / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random() * 0.5);
  src.stop(at + len + 0.02);
}

/** 木鱼 and chanting: eight even tocks under a soft two-note hum (≈ 6 s). */
export function muyu(ctx: Ctx, out: AudioNode, t = ctx.currentTime): number {
  const beat = 0.62;
  for (let i = 0; i < 8; i++) {
    tone(ctx, out, t + i * beat, 520, 'sine', LEVEL * 0.9, 0.12, 0.7);
    tone(ctx, out, t + i * beat, 1040, 'triangle', LEVEL * 0.2, 0.05);
  }
  // the chant: a low hum, a fifth above it now and then, breathing in and out
  const len = beat * 8 + 0.6;
  for (const [f, a] of [[110, 0.5], [165, 0.25]] as const) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.value = f;
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(LEVEL * a * 0.5, t + 1.2);
    g.gain.linearRampToValueAtTime(LEVEL * a * 0.35, t + len * 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    o.connect(lp).connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
  }
  return len;
}

/** A 京剧 radio, heard through a courtyard wall: a fiddle phrase on the pentatonic scale, 板 clacks between (≈ 4 s). */
export function jingju(ctx: Ctx, out: AudioNode, t = ctx.currentTime): number {
  const far = ctx.createBiquadFilter();
  far.type = 'bandpass';
  far.frequency.value = 1400;
  far.Q.value = 0.9;
  far.connect(out);
  // the 板: two dry clacks, then the fiddle
  hiss(ctx, far, t, 0.05, LEVEL * 0.9, 2600, 3);
  hiss(ctx, far, t + 0.3, 0.05, LEVEL * 0.9, 2600, 3);
  const scale = [587, 659, 784, 880, 988, 1175];
  const phrase = [3, 4, 3, 2, 1, 2, 3, 5, 4, 3];
  let at = t + 0.7;
  phrase.forEach((n, i) => {
    const len = i === phrase.length - 1 ? 0.7 : 0.28;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const vib = ctx.createOscillator();
    const depth = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = scale[n]!;
    vib.frequency.value = 6;
    depth.gain.value = 9;
    vib.connect(depth).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(LEVEL * 0.35, at + 0.04);
    g.gain.linearRampToValueAtTime(0.0001, at + len);
    o.connect(g).connect(far);
    o.start(at);
    vib.start(at);
    o.stop(at + len + 0.02);
    vib.stop(at + len + 0.02);
    at += len * 0.95;
  });
  return at - t + 0.1;
}

/** 麻将: a shuffle of tiles, then a few clacks as they are laid (≈ 2.5 s). */
export function mahjong(ctx: Ctx, out: AudioNode, t = ctx.currentTime): number {
  for (let i = 0; i < 22; i++) hiss(ctx, out, t + i * 0.045 + Math.random() * 0.03, 0.03, LEVEL * (0.7 + Math.random() * 0.5), 3200 + Math.random() * 1500, 6);
  for (let i = 0; i < 4; i++) hiss(ctx, out, t + 1.3 + i * 0.28 + Math.random() * 0.06, 0.04, LEVEL * 1.6, 2800, 8);
  return 2.5;
}

/** 广场舞: one bar of a bright four-beat tune on a small speaker (the page loops it while you are there, ≈ 2.4 s a bar). */
export function danceBar(ctx: Ctx, out: AudioNode, bar: number, t = ctx.currentTime): number {
  const beat = 0.3;
  const speaker = ctx.createBiquadFilter();
  speaker.type = 'highpass';
  speaker.frequency.value = 220;
  speaker.connect(out);
  // a boom-chick under a pentatonic tune that turns every four bars
  const bass = [196, 196, 247, 220][bar % 4]!;
  const tunes = [
    [784, 880, 988, 880, 784, 659, 784, 659],
    [659, 784, 880, 784, 659, 587, 659, 587],
    [784, 988, 1175, 988, 880, 784, 880, 784],
    [659, 587, 523, 587, 659, 784, 659, 523],
  ];
  const tune = tunes[bar % 4]!;
  for (let i = 0; i < 8; i++) {
    const at = t + i * beat;
    if (i % 2 === 0) tone(ctx, speaker, at, bass, 'triangle', LEVEL * 0.8, 0.22);
    else hiss(ctx, speaker, at, 0.06, LEVEL * 0.35, 6000, 1, 'highpass');
    tone(ctx, speaker, at, tune[i]!, 'square', LEVEL * 0.18, beat * 0.9);
  }
  return beat * 8;
}

/** 知了: a high shimmering swell that rises and falls (≈ 5 s). */
export function cicadas(ctx: Ctx, out: AudioNode, t = ctx.currentTime): number {
  const len = 5;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 5200;
  bp.Q.value = 6;
  const trem = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 38;
  lfoDepth.gain.value = 0.5;
  trem.gain.value = 0.5;
  lfo.connect(lfoDepth).connect(trem.gain);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(LEVEL * 0.6, t + 1.8);
  g.gain.linearRampToValueAtTime(LEVEL * 0.45, t + 3.4);
  g.gain.linearRampToValueAtTime(0.0001, t + len);
  src.connect(bp).connect(trem).connect(g).connect(out);
  src.start(t);
  lfo.start(t);
  src.stop(t + len);
  lfo.stop(t + len);
  return len;
}

/** Crows at a winter dusk: two or three hoarse caws (≈ 2 s). */
export function crows(ctx: Ctx, out: AudioNode, t = ctx.currentTime): number {
  const n = 2 + Math.round(Math.random());
  for (let i = 0; i < n; i++) {
    const at = t + i * 0.55;
    const o = ctx.createOscillator();
    const bp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(640, at);
    o.frequency.exponentialRampToValueAtTime(430, at + 0.32);
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 2.5;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(LEVEL * 0.7, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
    o.connect(bp).connect(g).connect(out);
    o.start(at);
    o.stop(at + 0.36);
    hiss(ctx, out, at, 0.3, LEVEL * 0.2, 1500, 2);
  }
  return n * 0.55;
}

/** 鞭炮: a short string of cracks, a little uneven, then quiet (≈ 1.6 s). */
export function firecrackers(ctx: Ctx, out: AudioNode, t = ctx.currentTime): number {
  let at = t;
  for (let i = 0; i < 26; i++) {
    hiss(ctx, out, at, 0.035, LEVEL * (0.6 + Math.random() * 0.4), 1800 + Math.random() * 2400, 0.7);
    tone(ctx, out, at, 90, 'sine', LEVEL * 0.3, 0.05, 0.6);
    at += 0.035 + Math.random() * 0.05;
  }
  return at - t + 0.1;
}

/** Each sound by its name in the mix (the dance plays bar by bar instead). */
export const CITY_SOUNDS = { muyu, jingju, mahjong, cicadas, crows, firecrackers } as const;
