/**
 * What the games remember: how each has gone, and which words they showed.
 *
 * Games are practice, not review. A tap on one of four pictures is not proof
 * that a word is known, so nothing here reaches the schedule — the memory
 * stays the drills' and the paper tests' to write. What is kept is what a
 * learner wants to see on the Play page (how often, the best score, the seal
 * won) and a count of how often each word or character has turned up in a
 * game, for the progress numbers.
 *
 * Game ids are kept whatever they are: a newer build may bring games this one
 * has never heard of, and reading its record must not lose them.
 */

import type { ItemId } from './ids';

/** The seal a round earns: none, faint (half right first time), clear (four in five), gold (all). */
export type Seal = 0 | 1 | 2 | 3;

export interface GameStats {
  plays: number;
  /** the best share right first time, 0–1 */
  best: number;
  seal: Seal;
  /** when it was last finished */
  last: number;
}

export interface PlayRecord {
  games: Record<string, GameStats>;
  /** how many times each item has come up in a game */
  seen: Record<ItemId, number>;
}

export const emptyPlay = (): PlayRecord => ({ games: {}, seen: {} });

/** The seal a share of first-try answers earns. */
export function sealFor(share: number): Seal {
  if (share >= 1) return 3;
  if (share >= 0.8) return 2;
  if (share >= 0.5) return 1;
  return 0;
}

export interface FinishedGame {
  game: string;
  at: number;
  /** answered right on the first try */
  firstTry: number;
  rounds: number;
  items: ItemId[];
}

/** One finished game folded into the record. */
export function recordGame(p: PlayRecord, g: FinishedGame): PlayRecord {
  const share = g.rounds ? g.firstTry / g.rounds : 0;
  const was = p.games[g.game];
  const seal = sealFor(share);
  const seen = { ...p.seen };
  for (const id of g.items) seen[id] = (seen[id] ?? 0) + 1;
  return {
    games: {
      ...p.games,
      [g.game]: {
        plays: (was?.plays ?? 0) + 1,
        best: Math.max(was?.best ?? 0, share),
        seal: Math.max(was?.seal ?? 0, seal) as Seal,
        last: Math.max(was?.last ?? 0, g.at),
      },
    },
    seen,
  };
}

/** Two devices' records as one: for every number, the larger. */
export function mergePlay(a: PlayRecord, b: PlayRecord): PlayRecord {
  const games: Record<string, GameStats> = { ...a.games };
  for (const [id, g] of Object.entries(b.games)) {
    const m = games[id];
    games[id] = m
      ? {
          plays: Math.max(m.plays, g.plays),
          best: Math.max(m.best, g.best),
          seal: Math.max(m.seal, g.seal) as Seal,
          last: Math.max(m.last, g.last),
        }
      : g;
  }
  const seen: Record<ItemId, number> = { ...a.seen };
  for (const [id, n] of Object.entries(b.seen)) seen[id] = Math.max(seen[id] ?? 0, n);
  return { games, seen };
}

const num = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;

/** A stored record, read defensively: anything malformed is dropped, not guessed at. */
export function playFrom(v: unknown): PlayRecord {
  const out = emptyPlay();
  if (!v || typeof v !== 'object') return out;
  const o = v as { games?: unknown; seen?: unknown };
  if (o.games && typeof o.games === 'object') {
    for (const [id, g] of Object.entries(o.games as Record<string, unknown>)) {
      if (!g || typeof g !== 'object' || !/^[a-z0-9-]{1,40}$/.test(id)) continue;
      const s = g as Record<string, unknown>;
      out.games[id] = {
        plays: Math.round(num(s.plays, 0, 1e6)),
        best: num(s.best, 0, 1),
        seal: Math.round(num(s.seal, 0, 3)) as Seal,
        last: num(s.last, 0, 8.64e15),
      };
    }
  }
  if (o.seen && typeof o.seen === 'object') {
    for (const [id, n] of Object.entries(o.seen as Record<string, unknown>)) {
      if (typeof id === 'string' && id.length > 1 && id.length < 20) {
        const k = Math.round(num(n, 0, 1e6));
        if (k > 0) out.seen[id] = k;
      }
    }
  }
  return out;
}
