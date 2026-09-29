/**
 * The street's sounds and the music, made in the browser (prompt G1): no
 * recordings, so nothing to license — pigeon whistles (鸽哨) are a few soft
 * sine tones in a bright chord that rise and fall as the flock passes, a
 * bicycle bell two quick metallic strikes, the murmur of people filtered
 * noise that breathes, and the station's chime three soft notes. `mix.ts`
 * says what plays where; the music (`music.ts`, played by `band.ts`) has its
 * own level.
 *
 * Silent until the page calls `wake()` from a tap (iOS lets audio start
 * only inside a gesture), quiet when both levels are 0, suspended while the
 * tab is hidden.
 */

import { Band } from './band';
import { nextIn, SILENT, type Mix } from './mix';
import type { Mood } from './music';

type Ctor = typeof AudioContext;

export class Ambient {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private crowd: GainNode | null = null;
  private band: Band | null = null;
  private mix: Mix = SILENT;
  private mood: Mood | null = null;
  private ducked = 1;
  private volume: number;
  private music: number;
  private timers: number[] = [];
  private hidden = false;

  constructor(volume: number, music: number) {
    this.volume = volume;
    this.music = music;
  }

  private get silent() {
    return this.volume <= 0 && this.music <= 0;
  }

  /** From a tap: make (or resume) the audio context and start the current mix. */
  wake() {
    if (this.silent) return;
    if (!this.ctx) {
      const C = (window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }).AudioContext ??
        (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.music * 1.6;
      this.musicGain.connect(this.ctx.destination);
      this.band = new Band(this.ctx, this.musicGain);
      this.band.setMood(this.mood);
      this.band.duck(this.ducked);
      this.startCrowd();
      this.schedule();
    }
    if (!this.hidden) void this.ctx.resume();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.2);
    this.suspendIfSilent();
  }

  setMusicVolume(v: number) {
    this.music = v;
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(v * 1.6, this.ctx.currentTime, 0.3);
    this.suspendIfSilent();
  }

  private suspendIfSilent() {
    if (this.silent) void this.ctx?.suspend();
    else if (this.ctx && !this.hidden) void this.ctx.resume();
  }

  /** The music for where you are now (`moodFor`); the same mood plays on. */
  setMood(m: Mood | null) {
    this.mood = m;
    this.band?.setMood(m);
  }

  /** Quieter music while someone is talking or a panel is open (1 = full). */
  duck(level: number) {
    this.ducked = level;
    this.band?.duck(level);
  }

  setMix(m: Mix) {
    this.mix = m;
    if (this.crowd && this.ctx) this.crowd.gain.setTargetAtTime(m.crowd * 0.1, this.ctx.currentTime, 1.5);
    this.schedule();
  }

  /** The tab went away or came back. */
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else if (!this.silent) void this.ctx.resume();
  }

  dispose() {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    this.band?.dispose();
    this.band = null;
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
    band.frequency.value = 500;
    band.Q.value = 0.5;
    this.crowd = ctx.createGain();
    this.crowd.gain.value = this.mix.crowd * 0.1;
    // the murmur breathes: a slow wobble on its level
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.13;
    depth.gain.value = 0.015;
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

  /**
   * 鸽哨: the flock's whistles passing over — a bright chord (do mi sol) that
   * rises a little as it comes and falls as it goes, never a slow wail.
   */
  private pigeons() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const dur = 2.2 + Math.random() * 1.2;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.025, t + dur * 0.5);
    out.gain.linearRampToValueAtTime(0, t + dur);
    out.connect(this.master!);
    const base = 1100 + Math.random() * 250;
    for (const k of [1, 1.26, 1.5]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * k * 0.99, t);
      o.frequency.linearRampToValueAtTime(base * k * 1.01, t + dur * 0.5);
      o.frequency.linearRampToValueAtTime(base * k * 0.985, t + dur);
      o.connect(out);
      o.start(t);
      o.stop(t + dur);
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
    if (!this.ctx || this.silent) return;
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
