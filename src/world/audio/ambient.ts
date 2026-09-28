/**
 * The street's sounds, made in the browser (prompt G1): no recordings, so
 * nothing to license — pigeon whistles (鸽哨) are a few soft sine tones with
 * a slow glide as the flock passes, a bicycle bell two quick metallic
 * strikes, the murmur of people filtered noise that breathes, and the
 * station's chime three soft notes. `mix.ts` says what plays where.
 *
 * Silent until the page calls `wake()` from a tap (iOS lets audio start
 * only inside a gesture), quiet at volume 0, suspended while the tab is
 * hidden.
 */

import { nextIn, SILENT, type Mix } from './mix';

type Ctor = typeof AudioContext;

export class Ambient {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowd: GainNode | null = null;
  private mix: Mix = SILENT;
  private volume: number;
  private timers: number[] = [];
  private hidden = false;

  constructor(volume: number) {
    this.volume = volume;
  }

  /** From a tap: make (or resume) the audio context and start the current mix. */
  wake() {
    if (this.volume <= 0) return;
    if (!this.ctx) {
      const C = (window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }).AudioContext ??
        (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 0.5;
      this.master.connect(this.ctx.destination);
      this.startCrowd();
      this.schedule();
    }
    if (!this.hidden) void this.ctx.resume();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.2);
    if (v <= 0) void this.ctx?.suspend();
    else if (this.ctx && !this.hidden) void this.ctx.resume();
  }

  setMix(m: Mix) {
    this.mix = m;
    if (this.crowd && this.ctx) this.crowd.gain.setTargetAtTime(m.crowd * 0.18, this.ctx.currentTime, 1.5);
    this.schedule();
  }

  /** The tab went away or came back. */
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else if (this.volume > 0) void this.ctx.resume();
  }

  dispose() {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    void this.ctx?.close();
    this.ctx = null;
  }

  // --------------------------------------------------------------- sounds

  private startCrowd() {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // brown-ish noise: a murmur rather than a hiss
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 700;
    band.Q.value = 0.7;
    this.crowd = ctx.createGain();
    this.crowd.gain.value = this.mix.crowd * 0.18;
    // the murmur breathes: a slow wobble on its level
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.13;
    depth.gain.value = 0.03;
    lfo.connect(depth).connect(this.crowd.gain);
    src.connect(band).connect(this.crowd).connect(this.master!);
    src.start();
    lfo.start();
  }

  private schedule() {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    if (!this.ctx) return;
    const loop = (every: number, play: () => void) => {
      if (!every) return;
      const go = () => {
        if (!this.hidden && this.volume > 0) play();
        this.timers.push(window.setTimeout(go, nextIn(every, Math.random) * 1000));
      };
      this.timers.push(window.setTimeout(go, nextIn(every, Math.random) * 500));
    };
    loop(this.mix.pigeonsEvery, () => this.pigeons());
    loop(this.mix.bellsEvery, () => this.bell());
  }

  /** 鸽哨: the flock's whistles, a soft chord that swells and glides down as it passes. */
  private pigeons() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const dur = 4 + Math.random() * 2;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.05, t + dur * 0.45);
    out.gain.linearRampToValueAtTime(0, t + dur);
    out.connect(this.master!);
    const base = 900 + Math.random() * 300;
    for (const k of [1, 1.5, 2.02]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * k * 1.03, t);
      o.frequency.linearRampToValueAtTime(base * k * 0.97, t + dur);
      const vib = ctx.createOscillator();
      const vd = ctx.createGain();
      vib.frequency.value = 5 + Math.random() * 2;
      vd.gain.value = base * k * 0.006;
      vib.connect(vd).connect(o.frequency);
      o.connect(out);
      o.start(t);
      vib.start(t);
      o.stop(t + dur);
      vib.stop(t + dur);
    }
  }

  /** A bicycle bell: two quick strikes of a few metallic partials. */
  private bell() {
    const ctx = this.ctx!;
    const strike = (at: number) => {
      for (const [f, a] of [[2350, 0.05], [3620, 0.03], [5180, 0.015]] as const) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(a, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
        o.connect(g).connect(this.master!);
        o.start(at);
        o.stop(at + 0.75);
      }
    };
    const t = ctx.currentTime;
    strike(t);
    strike(t + 0.16);
  }

  /** The station's chime: three soft falling notes (not any real line's jingle). */
  chime() {
    if (!this.ctx || this.volume <= 0) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [659.3, 523.3, 392].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const at = t + i * 0.32;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.08, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
      o.connect(g).connect(this.master!);
      o.start(at);
      o.stop(at + 1.2);
    });
  }
}
