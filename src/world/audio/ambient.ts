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
import { nextIn, SILENT, type CitySound, type Mix } from './mix';
import { CITY_SOUNDS, danceBar } from './city';
import type { Mood } from './music';

type Ctor = typeof AudioContext;

export class Ambient {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  /** §13 N1: the city's sounds, under the street's volume; ducked while someone talks, as the music is */
  private cityGain: GainNode | null = null;
  private danceBar = 0;
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
      this.cityGain = this.ctx.createGain();
      this.cityGain.gain.value = this.ducked;
      this.cityGain.connect(this.master);
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
    if (this.cityGain && this.ctx) this.cityGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.3);
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
    // §13 N1: the city's own sounds here now; 广场舞 plays bar after bar while you stay
    for (const [kind, every] of Object.entries(this.mix.sounds ?? {}) as [CitySound, number][]) {
      if (kind === 'dance') continue;
      loop(every, () => CITY_SOUNDS[kind](this.ctx!, this.cityGain!));
    }
    if (this.mix.sounds?.dance) {
      const bar = () => {
        if (!this.hidden && this.volume > 0 && this.ctx) danceBar(this.ctx, this.cityGain!, this.danceBar++);
        this.timers.push(window.setTimeout(bar, 2400));
      };
      bar();
    }
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
    this.strikes([0, 0.16], 1, 1);
  }

  /** Strikes of a bell's metallic partials at these offsets (s), pitched by `k`, loud by `loud`. */
  private strikes(at: readonly number[], k: number, loud: number, pitches: readonly number[] = at.map(() => 1)) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    at.forEach((dt, i) => {
      for (const [f, a] of [[2350, 0.05], [3620, 0.03], [5180, 0.015]] as const) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f * k * pitches[i]!;
        g.gain.setValueAtTime(a * loud, t + dt);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.7);
        o.connect(g).connect(this.master!);
        o.start(t + dt);
        o.stop(t + dt + 0.75);
      }
    });
  }

  /**
   * Your own bike's bell (§13 L2), close by and louder than the street's: the
   * three the 修车摊 fits — 叮 (one strike), 叮当 (high, then lower), 铃铃
   * (a quick run of four).
   */
  ring(bell: number) {
    if (!this.ctx || this.volume <= 0) return;
    if (bell === 1) this.strikes([0, 0.22], 1.05, 2.4, [1, 0.8]);
    else if (bell === 2) this.strikes([0, 0.08, 0.16, 0.24], 0.95, 2);
    else this.strikes([0], 1, 2.6);
  }

  /** 兔儿爷 answers: one short, soft rising blip (at the sound level; silent at 0). */
  blip() {
    if (!this.ctx || this.volume <= 0) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(740, t);
    o.frequency.exponentialRampToValueAtTime(988, t + 0.06);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.14);
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

  /**
   * MT (2026-10-01) — the train's sounds, made on the spot (no real line's jingle):
   * `doors` a two-note ding-dong as the doors open; `closing` quick beeps before they shut;
   * `arrive` / `leave` a rumble that falls or rises over `secs`; `run` a low hum while riding.
   */
  train(kind: 'doors' | 'closing' | 'arrive' | 'leave' | 'run', secs = 2) {
    if (!this.ctx || this.volume <= 0) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const tone = (f: number, at: number, len: number, peak: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + at);
      g.gain.linearRampToValueAtTime(peak, t + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
      o.connect(g).connect(this.master!);
      o.start(t + at);
      o.stop(t + at + len + 0.05);
    };
    if (kind === 'doors') {
      tone(880, 0, 0.6, 0.09);
      tone(698.5, 0.38, 0.9, 0.09);
      return;
    }
    if (kind === 'closing') {
      for (let i = 0; i < 6; i++) tone(1046.5, i * 0.22, 0.12, 0.06, 'square');
      return;
    }
    // a rumble: filtered noise, its loudness and pitch following the train's speed
    const len = Math.max(0.5, secs);
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
      d[i] = last * 6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    const g = ctx.createGain();
    const [g0, g1, f0, f1] = kind === 'arrive' ? [0.5, 0.05, 900, 180] : kind === 'leave' ? [0.05, 0.5, 180, 900] : [0.18, 0.18, 260, 260];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(g0, t + 0.15);
    g.gain.linearRampToValueAtTime(g1, t + len - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    f.frequency.setValueAtTime(f0, t);
    f.frequency.linearRampToValueAtTime(f1, t + len);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + len);
  }

  /**
   * A cutscene's sound (§13 K1), made on the spot: a wood block (a step
   * done), a temple gong, a small bell, a drum beat.
   */
  cue(kind: 'wood' | 'gong' | 'bell' | 'drum') {
    if (!this.ctx || this.volume <= 0) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const tone = (f: number, type: OscillatorType, peak: number, len: number, bend = 1) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (bend !== 1) o.frequency.exponentialRampToValueAtTime(f * bend, t + len);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(this.master!);
      o.start(t);
      o.stop(t + len + 0.02);
    };
    if (kind === 'wood') {
      tone(880, 'sine', 0.12, 0.09, 0.8);
      tone(1320, 'sine', 0.05, 0.05);
    } else if (kind === 'gong') {
      tone(110, 'sine', 0.14, 3.2, 0.97);
      tone(167, 'sine', 0.07, 2.6);
      tone(231, 'triangle', 0.03, 1.8);
    } else if (kind === 'bell') {
      tone(1568, 'sine', 0.06, 1.4);
      tone(2349, 'sine', 0.025, 0.9);
    } else {
      tone(72, 'sine', 0.22, 0.5, 0.6);
      tone(140, 'triangle', 0.05, 0.12);
    }
  }
}
