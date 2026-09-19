import { readFileSync } from 'node:fs';

/** A 16-bit mono PCM WAV, as samples in −1…1 and its rate. Enough for what generate.py writes. */
export function readWav(file: string): { samples: Float32Array; rate: number } {
  const buf = readFileSync(file);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file} is not a WAV`);
  let at = 12;
  let rate = 0;
  let bits = 0;
  let channels = 0;
  while (at + 8 <= buf.length) {
    const id = buf.toString('ascii', at, at + 4);
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    if (id === 'fmt ') {
      channels = view.getUint16(body + 2, true);
      rate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      if (bits !== 16 || channels !== 1) throw new Error(`${file}: expected 16-bit mono, got ${bits}-bit × ${channels}`);
      const n = Math.floor(size / 2);
      const samples = new Float32Array(n);
      for (let i = 0; i < n; i++) samples[i] = view.getInt16(body + i * 2, true) / 32768;
      return { samples, rate };
    }
    at = body + size + (size % 2);
  }
  throw new Error(`${file} has no data`);
}
