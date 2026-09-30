/**
 * §13 N2: every city sound rendered offline — to hear it without the game,
 * and to check it is audible and never louder than the street's own G1 sounds
 * (the bicycle bell), which were set against the music.
 *
 *   npm i --prefix <dir> node-web-audio-api      # once, outside the app (not a dependency)
 *   NWA=<dir>/node_modules/node-web-audio-api npx tsx scripts/world/sound-render.ts [out]
 *
 * Writes <out>/<sound>.wav (mono, 44.1 kHz) and prints each one's peak and
 * RMS in dBFS next to the bell's.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { CITY_SOUNDS, danceBar, type Ctx } from '../../src/world/audio/city';

const require = createRequire(import.meta.url);
const { OfflineAudioContext } = require(process.env.NWA ?? 'node-web-audio-api') as { OfflineAudioContext: new (ch: number, len: number, rate: number) => Ctx & { startRendering(): Promise<AudioBuffer> } };
const OUT = process.argv[2] ?? 'docs/world-game/review/n';
const RATE = 44100;

function wav(data: Float32Array): Buffer {
  const b = Buffer.alloc(44 + data.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + data.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(data.length * 2, 40);
  data.forEach((v, i) => b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
  return b;
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

async function render(name: string, seconds: number, play: (ctx: Ctx, out: AudioNode) => void) {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE);
  play(ctx, ctx.destination);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0;
  let sum = 0;
  for (const v of d) {
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  writeFileSync(`${OUT}/${name}.wav`, wav(d));
  return { name, peak: db(peak), rms: db(Math.sqrt(sum / d.length)), seconds };
}

/** G1's bicycle bell, as ambient.ts strikes it (the street's reference level). */
function bell(ctx: Ctx, out: AudioNode) {
  for (const at of [0.05, 0.21])
    for (const [f, a] of [[2350, 0.05], [3620, 0.03], [5180, 0.015]] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(a, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + 0.75);
    }
}

mkdirSync(OUT, { recursive: true });
const rows = [await render('bell-g1', 1.2, bell)];
for (const [name, play] of Object.entries(CITY_SOUNDS)) rows.push(await render(name, 7, (c, o) => play(c, o, 0.05)));
rows.push(await render('dance', 10, (c, o) => [0, 1, 2, 3].forEach((b) => danceBar(c, o, b, 0.05 + b * 2.4))));
const ref = rows[0]!.peak;
console.log('sound          peak dBFS   rms dBFS   vs bell');
for (const r of rows) console.log(`${r.name.padEnd(14)} ${r.peak.toFixed(1).padStart(9)} ${r.rms.toFixed(1).padStart(10)} ${(r.peak - ref).toFixed(1).padStart(9)}`);
const loud = rows.filter((r) => r.peak - ref > 3);
const quiet = rows.filter((r) => r.peak < -40);
if (loud.length || quiet.length) {
  console.log(`too loud: ${loud.map((r) => r.name).join(', ') || '—'} · too quiet: ${quiet.map((r) => r.name).join(', ') || '—'}`);
  process.exit(1);
}
console.log('every city sound is audible and within 3 dB of the bell');
