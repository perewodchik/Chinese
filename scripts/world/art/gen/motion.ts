/**
 * The frames that make the world move (§13 V3). The engine's one clock turns
 * them (`src/world/art/anims.ts` says which frames make which animation and
 * how fast).
 *
 * Tiles (a file of their own, after the others, so no tile id moves): water
 * in four frames with a glint, the station escalator's stripes in three.
 * Props: a sway frame for every tree, flags, a fountain, a traffic signal,
 * crows, rain puddles, and small things people hold when they idle — a fan,
 * a bird cage, a chess board, a paper, a phone, a broom, knitting, a
 * diabolo, a 毽子.
 */

import { Grid } from './grid';
import { stairsDown, water } from './tiles';

const T = 16;

// ---------------------------------------------------------------- tiles

/** Water frames 2 and 3: the waves move on, and a glint of sun catches the crest now and then. */
export function waterMore(frame: 2 | 3): Grid {
  const g = water(frame === 2 ? 0 : 1).shift(frame === 2 ? 2 : 3, 0);
  // Grid.shift leaves the cut-off edge empty: fill it with water
  g.where((_x, _y, c) => c === '.', 'W');
  g.hline(0, 0, T, 'X');
  if (frame === 2) g.set(6, 5, 'w').set(13, 10, 'w');
  else g.set(3, 12, 'w').set(10, 2, 'w');
  return g;
}

/** The escalator: the steps' stripes one and two pixels further down. */
export function escalator(frame: 1 | 2): Grid {
  const g = stairsDown();
  const out = g.clone();
  for (let y = 0; y < 13; y++) for (let x = 1; x < 15; x++) out.set(x, y, g.get(x, (y - frame + 13) % 13));
  return out;
}

export const MOTION_TILES: Array<[string, () => Grid]> = [
  ['water-2', () => waterMore(2)],
  ['water-3', () => waterMore(3)],
  ['stairs-down-1', () => escalator(1)],
  ['stairs-down-2', () => escalator(2)],
];

// ---------------------------------------------------------------- sway

/**
 * A tree's second frame: the crown leans a pixel with the wind, the top rows
 * more than the lower ones; the trunk stays put.
 */
export function sway(g: Grid, crownRows: number): Grid {
  const out = g.clone();
  for (let y = 0; y < crownRows; y++) {
    const dx = y < crownRows / 2 ? 1 : 0;
    if (!dx) continue;
    for (let x = g.w - 1; x >= 0; x--) out.set(x, y, x - dx >= 0 ? g.get(x - dx, y) : '.');
  }
  return out;
}

// ---------------------------------------------------------------- props

/** A red flag on a pole, rippling in three frames (天安门, 国贸). */
export function flag(frame: 0 | 1 | 2): Grid {
  const g = new Grid(16, 32);
  g.oval(5, 29, 6, 3, '_');
  const f = new Grid(16, 32);
  f.vline(3, 1, 30, 'd').vline(4, 1, 30, 'c').set(3, 0, 'y').set(4, 0, 'Y');
  for (let x = 0; x < 10; x++) {
    const dy = Math.round(Math.sin((x + frame * 3) / 2.2) * 1.2);
    f.vline(5 + x, 2 + dy, 7, x % 3 === 2 ? 'R' : 'r');
  }
  f.set(7, 4, 'y').set(9, 3, 'y').set(9, 5, 'y');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A round fountain, its jets rising in three frames (奥林匹克). */
export function fountain(frame: 0 | 1 | 2): Grid {
  const g = new Grid(32, 32);
  g.oval(1, 26, 30, 6, '_');
  const f = new Grid(32, 32);
  f.oval(1, 18, 30, 12, 'd').oval(3, 19, 26, 9, 'W').oval(5, 20, 22, 6, 'X');
  f.hline(3, 18, 26, 'e');
  const h = [10, 13, 11][frame]!;
  for (const [x, k] of [[15, 1], [11, 0.7], [20, 0.7]] as const) {
    const top = 20 - Math.round(h * k);
    f.vline(x, top, 20 - top, 'X').vline(x + 1, top + 1, 19 - top, 'l').set(x, top, 'w');
    f.set(x - 1, top + 1 + frame, 'l').set(x + 2, top + 2 + ((frame + 1) % 3), 'l');
  }
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A traffic signal head on its pole: red, green and amber. */
export function signal(light: 'r' | 'g' | 'a'): Grid {
  const g = new Grid(16, 32);
  g.oval(5, 29, 6, 3, '_');
  const f = new Grid(16, 32);
  f.vline(7, 10, 20, 'b').vline(8, 10, 20, 'a');
  f.rect(4, 1, 8, 11, 'a').hline(4, 1, 8, 'b');
  for (const [y, on, off] of [[2, 'r', 'q'], [5, 'y', 'o'], [8, 'h', 'g']] as const) {
    const lit = (light === 'r' && on === 'r') || (light === 'a' && on === 'y') || (light === 'g' && on === 'h');
    f.rect(6, y, 4, 3, lit ? on : off);
    if (lit) f.set(6, y, 'w');
  }
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A crow in flight, two wing frames (winter dusk). */
export function crow(frame: 0 | 1): Grid {
  const g = new Grid(16, 16);
  g.rect(6, 7, 4, 3, 'k').set(10, 7, 'k').set(11, 8, 'Y').set(5, 9, 'k');
  if (frame === 0) g.hline(2, 5, 4, 'k').set(5, 6, 'k').hline(10, 5, 4, 'k').set(10, 6, 'k');
  else g.hline(2, 10, 4, 'k').set(5, 9, 'k').hline(10, 10, 4, 'k').set(10, 9, 'k');
  return g;
}

/** A rain puddle on the paving, a ripple ring growing in two frames. */
export function puddle(frame: 0 | 1): Grid {
  const g = new Grid(16, 16);
  g.oval(1, 5, 14, 7, 'W').oval(2, 6, 12, 4, 'X');
  if (frame === 0) g.oval(6, 7, 4, 2, 'w');
  else g.oval(4, 6, 8, 4, 'l').oval(6, 7, 4, 2, 'X');
  return g;
}

// ---------------------------------------------------------------- what people do when they idle

/** The small things people hold or use while they stand about, drawn beside their hands (16×16, two or three frames each). */
export function idleThing(kind: string, frame: number): Grid {
  const g = new Grid(16, 16);
  switch (kind) {
    case 'fan': {
      // a round palm-leaf fan waving
      const y = frame ? 3 : 5;
      g.oval(8, y, 7, 7, 'j').oval(9, y + 1, 5, 5, 'y').vline(10, y + 6, 4, 'M').set(11, y + 3, 'Y');
      break;
    }
    case 'cage': {
      // the bird cage swinging on its hook: a dome of bars, the bird inside
      const x = frame ? 7 : 8;
      g.vline(x + 3, 0, 3, 'm').oval(x, 2, 8, 12, 'z').oval(x + 1, 3, 6, 10, '.');
      for (let i = 1; i < 7; i += 2) g.vline(x + i, 4, 8, 'M');
      g.hline(x, 13, 8, 'M').rect(x + 3, 7, 2, 2, frame ? 'y' : 'Y');
      break;
    }
    case 'chess': {
      // 象棋: a board on a stool, a piece lifted and put down
      g.rect(1, 8, 14, 6, 'z').hline(1, 8, 14, 'f').hline(1, 13, 14, 'M').hline(2, 10, 12, 'M').vline(8, 9, 4, 'M');
      for (const [x, c] of [[3, 'r'], [6, 'r'], [10, 'k'], [12, 'k']] as const) g.oval(x, 9, 3, 3, 'w').set(x + 1, 10, c);
      if (frame) g.oval(7, 4, 3, 3, 'w').set(8, 5, 'r');
      else g.oval(7, 10, 3, 3, 'w').set(8, 11, 'r');
      break;
    }
    case 'paper':
      g.rect(6, 5, 9, 8, 'w').vline(10, 5, 8, 'e').hline(7, 7, 3, 'c').hline(7, 9, 3, 'c').hline(11, 7, 3, 'c');
      if (frame) g.set(14, 5, 'e').set(6, 12, 'd');
      break;
    case 'phone':
      g.rect(10, frame ? 5 : 6, 4, 6, 'a').rect(11, frame ? 6 : 7, 2, 3, frame ? 'l' : 'X');
      break;
    case 'broom': {
      const x = frame ? 3 : 6;
      g.vline(x + 5, 0, 10, 'M').rect(x, 10, 9, 5, 'Y').vline(x + 2, 10, 5, 'o').vline(x + 6, 10, 5, 'o');
      break;
    }
    case 'knit':
      g.oval(7, 8, 7, 6, 'N').set(9, 10, 'r').set(11, 11, 'r');
      g.hline(5, frame ? 7 : 8, 5, 'e').hline(10, frame ? 8 : 7, 5, 'e');
      break;
    case 'diabolo': {
      // 空竹: the spool spinning on its string, thrown up in the last frame
      const y = frame === 2 ? 1 : 8;
      g.hline(1, 12, 3, 'M').hline(12, 12, 3, 'M');
      for (let x = 3; x < 13; x++) g.set(x, Math.round(12 - Math.sin(((x - 3) / 9) * Math.PI) * (frame === 2 ? 0 : 3)), 'w');
      g.rect(6, y, 4, 4, 'r').vline(7, y, 4, frame === 1 ? 'R' : 'p').rect(5, y + 1, 1, 2, 'R').rect(10, y + 1, 1, 2, 'R');
      break;
    }
    case 'jianzi': {
      // 毽子: the feather shuttlecock up, higher, down
      const y = [8, 2, 5][frame] ?? 8;
      g.rect(7, y + 3, 3, 2, 'y').vline(7, y, 3, 'r').vline(8, y - 1, 4, 'h').vline(9, y, 3, 'n');
      break;
    }
    default:
      break;
  }
  if (kind !== 'phone') g.outline('k');
  return g;
}

export const IDLE_KINDS = ['fan', 'cage', 'chess', 'paper', 'phone', 'broom', 'knit', 'diabolo', 'jianzi'] as const;
const FRAMES_OF: Record<string, number> = { diabolo: 3, jianzi: 3 };

/** The motion props: [file, note, frames], as `PROPS` has them. */
export const MOTION_PROPS: Array<[string, string, () => Array<[string, Grid]>]> = [
  ['flag', 'a red flag rippling on its pole, three frames (§13 V3)', () => [['red-0', flag(0)], ['red-1', flag(1)], ['red-2', flag(2)]]],
  ['fountain', 'a round fountain, jets in three frames (§13 V3)', () => [['spray-0', fountain(0)], ['spray-1', fountain(1)], ['spray-2', fountain(2)]]],
  ['signal', 'a traffic signal: red, green, amber (§13 V3)', () => [['red', signal('r')], ['green', signal('g')], ['amber', signal('a')]]],
  ['crow', 'a crow in flight, two frames (§13 V3)', () => [['fly-0', crow(0)], ['fly-1', crow(1)]]],
  ['puddle', 'a rain puddle with a ripple, two frames (§13 V3)', () => [['ripple-0', puddle(0)], ['ripple-1', puddle(1)]]],
  [
    'idle',
    'what people hold while they idle — fan, bird cage, chess, paper, phone, broom, knitting, diabolo, 毽子 (§13 V3)',
    () => IDLE_KINDS.flatMap((k) => Array.from({ length: FRAMES_OF[k] ?? 2 }, (_, i) => [`${k}-${i}`, idleThing(k, i)] as [string, Grid])),
  ],
];
