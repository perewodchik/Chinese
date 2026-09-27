/**
 * A seeded random source, so the same card comes out the same on a reload and
 * a test can pin one down. mulberry32: small, fast, good enough for shuffling.
 */
export interface Rng {
  /** 0 ≤ x < 1 */
  next(): number;
  int(max: number): number;
  pick<T>(list: readonly T[]): T;
  shuffle<T>(list: readonly T[]): T[];
  /** `n` different elements, in random order */
  sample<T>(list: readonly T[], n: number): T[];
}

function hash(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function makeRng(seed: string): Rng {
  let a = hash(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (max: number) => Math.floor(next() * max);
  const shuffle = <T,>(list: readonly T[]): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
  return {
    next,
    int,
    pick: (list) => list[int(list.length)]!,
    shuffle,
    sample: (list, n) => shuffle(list).slice(0, Math.max(0, n)),
  };
}
