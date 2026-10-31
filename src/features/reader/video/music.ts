import type { VideoLook } from '../../../domain/textVideo';

/**
 * Quiet music under a video, made here rather than taken from anywhere, so
 * there is nothing to license: soft plucked notes from a pentatonic scale
 * over a slow pad, the same every time for the same video (a seeded random).
 *
 * It sits under the voice: low all along, lower still while the narrator
 * speaks, rising a little in the quiet between paragraphs and while a
 * question waits for its answer.
 */

const STYLES = {
  // A slow, warm walk in C major pentatonic.
  calm: { bpm: 66, root: 261.63, notes: [0, 2, 4, 7, 9, 12, 14, 16], pad: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], level: 0.16, wave: 'triangle' as OscillatorType },
  // A brighter step in G, a touch quicker.
  bright: { bpm: 92, root: 392, notes: [0, 2, 4, 7, 9, 12], pad: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], level: 0.13, wave: 'sine' as OscillatorType },
};

const at = (root: number, semis: number) => root * 2 ** (semis / 12);

/** Lays the music into `mix`, `seconds` long; `voice` are the stretches (s) the narrator speaks. */
export function scoreMusic(mix: BaseAudioContext, style: Exclude<VideoLook['music'], 'off'>, seconds: number, voice: Array<[number, number]>) {
  const s = STYLES[style];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const master = mix.createGain();
  master.connect(mix.destination);
  // Ducked under the voice: a fifth of a second down, half a second up.
  master.gain.setValueAtTime(s.level, 0);
  for (const [from, to] of voice) {
    master.gain.setTargetAtTime(s.level * 0.35, Math.max(0, from - 0.15), 0.06);
    master.gain.setTargetAtTime(s.level, to + 0.1, 0.25);
  }
  // Fades in and out at the ends.
  const ends = mix.createGain();
  ends.connect(master);
  ends.gain.setValueAtTime(0, 0);
  ends.gain.linearRampToValueAtTime(1, Math.min(1.5, seconds / 3));
  ends.gain.setValueAtTime(1, Math.max(0, seconds - 1.5));
  ends.gain.linearRampToValueAtTime(0, seconds);

  const beat = 60 / s.bpm;
  const bar = beat * 4;
  // The pad: a chord a bar, sine tones, slow in and out.
  for (let t = 0, i = 0; t < seconds; t += bar * 2, i++) {
    const chord = s.pad[i % s.pad.length]!;
    for (const semis of chord) {
      const osc = mix.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = at(s.root / 2, semis);
      const g = mix.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + bar * 0.6);
      g.gain.linearRampToValueAtTime(0, t + bar * 2.2);
      osc.connect(g).connect(ends);
      osc.start(t);
      osc.stop(Math.min(seconds, t + bar * 2.3));
    }
  }
  // The plucks: a note on most beats, from the chord's scale, fading over a beat or two.
  for (let t = beat; t < seconds - beat; t += beat) {
    if (rand() < 0.3) continue;
    const osc = mix.createOscillator();
    osc.type = s.wave;
    osc.frequency.value = at(s.root, s.notes[Math.floor(rand() * s.notes.length)]!);
    const g = mix.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + beat * (1.2 + rand()));
    osc.connect(g).connect(ends);
    osc.start(t);
    osc.stop(t + beat * 2.4);
  }
}
