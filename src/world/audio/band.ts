/**
 * The folk band that plays `music.ts`, made in the browser like the street
 * sounds: no recordings, nothing to license. Each instrument is a few
 * oscillators and an envelope — the 古筝 a bright pluck that darkens as it
 * rings, the 笛子 a breathy flute with a late vibrato and a grace note, the
 * 琵琶 a pluck that trembles (轮指) on long notes, the 笙 a soft reed chord,
 * the bells and music box sine partials, the 梆子 a hollow knock, the 锣鼓 a
 * drum, a cymbal's hiss and the small gong's rising "tai". A short room
 * reverb puts them in one place.
 *
 * Notes are scheduled a little ahead on the audio clock (never late, never
 * bunched). A new mood crossfades: the old song fades out on its own bus while
 * the new one starts.
 */

import { song, type Mood, type Note, type Phrase, type Voice } from './music';

const LOOKAHEAD = 0.5;
const FADE = 2.5;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

interface Bus {
  mood: Mood;
  gain: GainNode;
  queue: Phrase[];
  /** audio time the next phrase starts */
  next: number;
  /** seconds per beat for the song now playing */
  beat: number;
  songs: number;
  dying: boolean;
}

export class Band {
  private out: GainNode;
  private duckGain: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private noise: AudioBuffer;
  private buses: Bus[] = [];
  private timer: number | null = null;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = 1;
    // gentle glue so festival drums never jump out
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    this.dry = ctx.createGain();
    this.dry.gain.value = 0.85;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.28;
    const verb = ctx.createConvolver();
    verb.buffer = this.room(2.4);
    this.out.connect(this.dry).connect(this.duckGain);
    this.out.connect(verb).connect(this.wet).connect(this.duckGain);
    this.duckGain.connect(comp).connect(dest);
    this.noise = this.makeNoise();
  }

  /** Play this mood (null for none); a different one crossfades. */
  setMood(m: Mood | null) {
    const live = this.buses.find((b) => !b.dying);
    if (live && m && live.mood.id === m.id) return;
    const t = this.ctx.currentTime;
    if (live) {
      live.dying = true;
      live.gain.gain.cancelScheduledValues(t);
      live.gain.gain.setValueAtTime(live.gain.gain.value, t);
      live.gain.gain.linearRampToValueAtTime(0, t + FADE);
      const g = live.gain;
      window.setTimeout(() => {
        g.disconnect();
        this.buses = this.buses.filter((b) => b !== live);
      }, (FADE + 4) * 1000);
    }
    if (!m) return;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(m.level, t + (live ? FADE : 1.2));
    gain.connect(this.out);
    this.buses.push({ mood: m, gain, queue: [], next: t + (live ? 0.8 : 0.3), beat: 60 / m.bpm, songs: 0, dying: false });
    this.start();
  }

  /** Softer while someone is talking, or a panel is open. */
  duck(level: number) {
    this.duckGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.4);
  }

  dispose() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    for (const b of this.buses) b.gain.disconnect();
    this.buses = [];
  }

  private start() {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), 120);
    this.tick();
  }

  private tick() {
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    for (const b of this.buses) {
      if (b.dying) continue;
      // the tab slept: start afresh rather than play a backlog
      if (b.next < now - 0.2) b.next = now + 0.1;
      while (b.next < now + LOOKAHEAD) {
        if (!b.queue.length) {
          b.songs++;
          const s = song(b.mood, Math.random, b.songs);
          b.queue = s.phrases;
          b.beat = 60 / (b.mood.bpm * s.tempo);
        }
        const p = b.queue.shift()!;
        for (const n of p.notes) this.play(n, b.next + n.at * b.beat, b.beat, b.gain);
        b.next += p.beats * b.beat;
      }
    }
  }

  // ------------------------------------------------------------ instruments

  private play(n: Note, t: number, beat: number, bus: GainNode) {
    const dur = n.len * beat;
    const v = n.voice as Voice;
    if (v === 'zheng' || v === 'bass') this.zheng(n.midi, t, n.vel * (v === 'bass' ? 0.55 : 1), v === 'bass' ? 2.2 : Math.max(1.4, dur * 1.6), bus, v === 'zheng' && dur >= beat * 1.5);
    else if (v === 'pipa') this.pipa(n.midi, t, n.vel, dur, bus);
    else if (v === 'dizi') this.dizi(n.midi, t, n.vel, dur, bus);
    else if (v === 'bells') this.bell(n.midi, t, n.vel, bus);
    else if (v === 'box') this.box(n.midi, t, n.vel, bus);
    else if (v === 'sheng') this.sheng(n.midi, t, n.vel, dur, bus);
    else if (v === 'wood') this.wood(t, n.vel, bus);
    else if (v === 'tang') this.tang(t, n.vel, bus);
    else if (v === 'cymbal') this.cymbal(t, n.vel, bus);
    else if (v === 'gong') this.gong(t, n.vel, bus);
  }

  private env(t: number, peak: number, attack: number, decay: number, to: AudioNode): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(to);
    return g;
  }

  private osc(type: OscillatorType, f: number, t: number, stop: number, to: AudioNode): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(to);
    o.start(t);
    o.stop(stop);
    return o;
  }

  /** 古筝: bright, then mellow; a long note is pressed up from below (按音). */
  private zheng(midi: number, t: number, vel: number, ring: number, bus: AudioNode, press: boolean) {
    const f = hz(midi);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t + 0.6);
    lp.connect(bus);
    const g = this.env(t, 0.16 * vel, 0.004, ring, lp);
    const stop = t + ring + 0.05;
    const slide = press && Math.random() < 0.35;
    for (const [k, a, type] of [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.18, 'sine'], [4.02, 0.06, 'sine']] as const) {
      const pg = this.ctx.createGain();
      pg.gain.value = a;
      pg.connect(g);
      const o = this.osc(type, f * k, t, stop, pg);
      if (slide) {
        o.frequency.setValueAtTime(f * k * 0.944, t);
        o.frequency.exponentialRampToValueAtTime(f * k, t + 0.14);
      }
    }
    // the pick
    this.hiss(t, 0.02, 0.05 * vel, 3000 + f, bus);
  }

  /** 琵琶: a short bright pluck; long notes tremble (轮指). */
  private pipa(midi: number, t: number, vel: number, dur: number, bus: AudioNode) {
    if (dur < 0.6) {
      this.zheng(midi, t, vel * 0.9, 0.9, bus, false);
      return;
    }
    const step = 0.075;
    for (let x = 0; x < dur - 0.05; x += step) {
      const fade = 1 - (x / dur) * 0.4;
      this.zheng(midi, t + x, vel * (x === 0 ? 0.9 : 0.45) * fade, 0.35, bus, false);
    }
  }

  /** 笛子: a breathy flute, a grace note from above, vibrato after it settles. */
  private dizi(midi: number, t: number, vel: number, dur: number, bus: AudioNode) {
    // the flute sounds an octave up, unless the tune is already high
    const f = hz(midi < 69 ? midi + 12 : midi);
    const hold = Math.max(0.12, dur * 0.95);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * vel, t + 0.05);
    g.gain.setValueAtTime(0.09 * vel, t + hold - 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + hold + 0.12);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(7000, f * 4);
    g.connect(lp).connect(bus);
    const stop = t + hold + 0.15;
    const o = this.osc('triangle', f, t, stop, g);
    const s = this.ctx.createGain();
    s.gain.value = 0.25;
    s.connect(g);
    const o2 = this.osc('sine', f * 2, t, stop, s);
    // grace note (倚音) on some longer notes
    if (dur > 0.4 && Math.random() < 0.3) {
      for (const x of [o, o2]) {
        const base = x.frequency.value;
        x.frequency.setValueAtTime(base * 1.122, t);
        x.frequency.setValueAtTime(base, t + 0.06);
      }
    }
    if (dur > 0.5) {
      const vib = this.ctx.createOscillator();
      const d = this.ctx.createGain();
      vib.frequency.value = 5.2;
      d.gain.setValueAtTime(0, t);
      d.gain.linearRampToValueAtTime(0, t + 0.25);
      d.gain.linearRampToValueAtTime(f * 0.005, t + 0.6);
      vib.connect(d);
      d.connect(o.frequency);
      d.connect(o2.frequency);
      vib.start(t);
      vib.stop(stop);
    }
    // the breath
    this.hiss(t, hold, 0.012 * vel, f * 1.5, bus, 0.03);
  }

  /** Bells: a clear strike with a quiet high partial, ringing long. */
  private bell(midi: number, t: number, vel: number, bus: AudioNode) {
    const f = hz(midi);
    for (const [k, a, d] of [[1, 0.12, 3], [2, 0.05, 1.6], [3.01, 0.03, 0.8], [4.2, 0.015, 0.4]] as const) {
      const g = this.env(t, a * vel, 0.003, d, bus);
      this.osc('sine', f * k, t, t + d + 0.05, g);
    }
  }

  /** A music box: a small high tine. */
  private box(midi: number, t: number, vel: number, bus: AudioNode) {
    const f = hz(midi + 12);
    const g = this.env(t, 0.07 * vel, 0.002, 1.8, bus);
    this.osc('sine', f, t, t + 1.9, g);
    const h = this.env(t, 0.02 * vel, 0.002, 0.25, bus);
    this.osc('sine', f * 4, t, t + 0.3, h);
  }

  /** 笙: a soft reed chord that swells and fades. */
  private sheng(midi: number, t: number, vel: number, dur: number, bus: AudioNode) {
    const f = hz(midi);
    const g = this.ctx.createGain();
    const peak = 0.035 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(1, dur * 0.3));
    g.gain.setValueAtTime(peak, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(2400, f * 5);
    lp.Q.value = 0.3;
    g.connect(lp).connect(bus);
    this.osc('sawtooth', f, t, t + dur + 0.5, g);
    const w = this.ctx.createGain();
    w.gain.value = 0.8;
    w.connect(g);
    this.osc('triangle', f * 1.003, t, t + dur + 0.5, w);
  }

  /** 梆子: a hollow knock. */
  private wood(t: number, vel: number, bus: AudioNode) {
    const g = this.env(t, 0.12 * vel, 0.001, 0.07, bus);
    const o = this.osc('sine', 1250, t, t + 0.1, g);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.06);
    this.hiss(t, 0.01, 0.05 * vel, 2500, bus);
  }

  /** 堂鼓: a round low drum. */
  private tang(t: number, vel: number, bus: AudioNode) {
    const g = this.env(t, 0.3 * vel, 0.003, 0.35, bus);
    const o = this.osc('sine', 150, t, t + 0.45, g);
    o.frequency.exponentialRampToValueAtTime(62, t + 0.25);
    this.hiss(t, 0.03, 0.06 * vel, 400, bus);
  }

  /** 钹: a short bright hiss. */
  private cymbal(t: number, vel: number, bus: AudioNode) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const g = this.env(t, 0.05 * vel, 0.002, 0.28, bus);
    src.connect(hp).connect(g);
    src.start(t, Math.random());
    src.stop(t + 0.35);
  }

  /** 小锣: the small gong whose pitch rises as it rings. */
  private gong(t: number, vel: number, bus: AudioNode) {
    for (const [k, a] of [[1, 0.1], [2.4, 0.03], [3.9, 0.015]] as const) {
      const g = this.env(t, a * vel, 0.003, 0.9, bus);
      const o = this.osc('sine', 620 * k, t, t + 1, g);
      o.frequency.exponentialRampToValueAtTime(760 * k, t + 0.35);
    }
  }

  /** Filtered noise: a pick, a breath, a drum's skin. */
  private hiss(t: number, dur: number, peak: number, freq: number, bus: AudioNode, attack = 0.002) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(12000, freq);
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.setValueAtTime(Math.max(0.0002, peak), t + Math.max(attack, dur - 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    src.connect(bp).connect(g).connect(bus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.06);
  }

  private makeNoise(): AudioBuffer {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** A small wooden room: decaying noise, a little darker as it fades. */
  private room(seconds: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len;
        const white = Math.random() * 2 - 1;
        // blend toward smoothed noise late in the tail: highs die first
        last = last + (white - last) * (0.9 - 0.75 * x);
        d[i] = last * Math.pow(1 - x, 3);
      }
    }
    return buf;
  }
}

