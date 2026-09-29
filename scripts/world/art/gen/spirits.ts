/**
 * The lantern's figures, redrawn (§13 V4): each spirit as a proper sprite
 * with a small idle (two or three frames), and as a 48×48 woodcut in the
 * lantern's painted look — flat colours, a bold black line, a red border on
 * warm paper, like a 年画 New Year print — for 图鉴 and the lantern's wheel.
 *
 * Sprites are 32×32 (the dragon 48×32), feet on the bottom rows, lit from
 * the top left, outlined.
 */

import { Grid } from './grid';

const shadow = (g: Grid, x: number, y: number, w: number, h = 3) => g.oval(x, y, w, h, '_');
const out = (f: Grid, g: Grid) => g.stamp(f.outline('k'), 0, 0);

/** 石狮子 awake: a seated guardian lion, curly mane, a red collar with its bell, the ball under its paw; the tail flicks and the mouth opens. */
export function lion(frame: 0 | 1): Grid {
  const g = new Grid(32, 32);
  shadow(g, 4, 28, 26, 4);
  const f = new Grid(32, 32);
  f.oval(8, 13, 18, 15, 'd').oval(10, 16, 10, 10, 'e');
  // the tail, a plume of curls, up in the second frame
  const ty = frame ? 7 : 9;
  f.oval(23, ty, 7, 8, 'c').set(25, ty + 2, 'b').set(27, ty + 4, 'b').set(24, ty + 5, 'b');
  // head and mane
  f.oval(4, 2, 18, 15, 'c');
  for (const [x, y] of [[5, 5], [8, 3], [12, 2], [16, 3], [19, 6], [5, 10], [20, 11], [7, 14], [18, 14]] as const) f.set(x, y, 'b').set(x + 1, y, 'd');
  f.oval(8, 5, 11, 10, 'e');
  f.rect(9, 8, 3, 3, 'w').set(10, 9, 'k').rect(15, 8, 3, 3, 'w').set(16, 9, 'k');
  f.rect(12, 10, 3, 2, 'c');
  if (frame) f.rect(11, 12, 6, 2, 'q').hline(11, 12, 6, 'w');
  else f.hline(11, 13, 6, 'b');
  // collar and bell
  f.hline(9, 17, 14, 'r').oval(14, 17, 4, 4, 'y').set(15, 19, 'o');
  // front legs, toes; the ball under the right paw
  f.rect(9, 21, 4, 7, 'd').rect(16, 21, 4, 7, 'd').hline(9, 27, 4, 'c').hline(16, 27, 4, 'c');
  f.oval(19, 21, 8, 8, 'e').vline(22, 22, 6, 'c').hline(20, 25, 6, 'c');
  return out(f, g);
}

/** 九尾狐: a white fox sitting, a red mark on its brow, nine gold-tipped tails fanned behind — they sway in three frames. */
export function fox(frame: 0 | 1 | 2): Grid {
  const g = new Grid(32, 32);
  shadow(g, 3, 28, 24, 4);
  const f = new Grid(32, 32);
  // tails: nine long ovals fanned from the base, tips gold
  const sway = [0, 0.08, -0.08][frame]!;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.9 + sway;
    for (let r = 0; r < 13; r++) {
      const x = Math.round(19 + Math.cos(a) * r * 0.9);
      const y = Math.round(21 + Math.sin(a) * r);
      const c = r > 10 ? 'j' : r > 8 ? 'w' : 'e';
      f.set(x, y, c).set(x + 1, y, c);
    }
  }
  // body and head
  f.oval(7, 15, 13, 13, 'w').oval(9, 19, 8, 8, 'e');
  f.oval(3, 7, 12, 10, 'w');
  // ears
  f.vline(4, 3, 5, 'w').vline(5, 4, 4, 'w').set(5, 5, 'p').vline(12, 3, 5, 'w').vline(11, 4, 4, 'w').set(11, 5, 'p');
  // snout, eyes, the brow mark
  f.rect(1, 12, 4, 3, 'w').set(0, 13, 'k');
  f.set(6, 10, 'k').set(7, 10, 'o').set(10, 10, 'k').set(11, 10, 'o').set(8, 8, 'r').set(8, 9, 'r');
  // paws
  f.rect(9, 26, 3, 2, 'e').rect(15, 26, 3, 2, 'e');
  return out(f, g);
}

/** 门神: the two generals side by side — 秦琼 fair-faced, 尉迟恭 dark-faced — gold armour, red plumes that flutter. */
export function doorGods(frame: 0 | 1): Grid {
  const g = new Grid(32, 32);
  shadow(g, 1, 28, 30, 4);
  const f = new Grid(32, 32);
  const general = (x: number, face: string, beard: string) => {
    // plume
    f.rect(x + 5, frame ? 0 : 1, 3, 3, 'r').set(x + 8, frame ? 1 : 0, 'r');
    // helmet
    f.rect(x + 3, 3, 8, 4, 'y').hline(x + 3, 3, 8, 'j').set(x + 2, 6, 'Y').set(x + 11, 6, 'Y');
    // face and beard
    f.rect(x + 4, 7, 6, 5, face).set(x + 5, 8, 'k').set(x + 8, 8, 'k').rect(x + 4, 11, 6, 3, beard).set(x + 3, 12, beard).set(x + 10, 12, beard);
    // armour: gold scales over red
    f.rect(x + 2, 14, 10, 11, 'r').rect(x + 3, 15, 8, 6, 'y');
    for (let yy = 16; yy < 21; yy += 2) for (let xx = x + 3; xx < x + 11; xx += 2) f.set(xx, yy, 'Y');
    f.hline(x + 2, 21, 10, 'n').rect(x + 3, 22, 3, 5, 'R').rect(x + 8, 22, 3, 5, 'R').hline(x + 2, 27, 4, 'a').hline(x + 8, 27, 4, 'a');
  };
  general(1, 's', 'k');
  general(18, 'b', 'k');
  // their weapons: 秦琼's mace, 尉迟恭's whip
  f.vline(1, 8, 18, 'c').rect(0, 7, 3, 3, 'd');
  f.vline(30, 8, 18, 'o').rect(29, 7, 3, 2, 'Y');
  return out(f, g);
}

/** 麒麟: a deer-like beast with green scales, one horn, a mane of flame, flames at its hooves — they flicker. */
export function qilin(frame: 0 | 1): Grid {
  const g = new Grid(32, 32);
  shadow(g, 3, 28, 26, 4);
  const f = new Grid(32, 32);
  // body and scales
  f.oval(8, 12, 18, 10, 'h').oval(10, 14, 12, 5, 'i');
  for (let y = 14; y < 21; y += 2) for (let x = 11 + (y % 4 ? 1 : 0); x < 24; x += 3) f.set(x, y, 'G');
  // legs and hooves
  for (const x of [10, 14, 20, 24]) f.rect(x, 20, 2, 7, 'h').rect(x - 1, 27, 3, 1, 'a');
  // neck and head, the horn
  f.rect(6, 7, 5, 8, 'h').oval(1, 3, 9, 7, 'h').rect(0, 6, 3, 3, 'i').set(4, 5, 'k').vline(6, 0, 3, 'y').set(5, 1, 'y');
  // mane and tail of flame, and flames at the hooves
  const fl = frame ? 'O' : 'L';
  for (const [x, y] of [[9, 4], [11, 6], [11, 9], [26, 11], [28, 10], [29, 12]] as const) f.set(x, y, 'r').set(x, y - 1, fl);
  for (const x of [9, 13, 19, 23]) f.set(x, 27, fl).set(x + 3, 26, frame ? 'r' : fl);
  return out(f, g);
}

/** 貔貅: a golden winged beast with one horn, crouching, mouth open for gold — the wings lift in the second frame. */
export function pixiu(frame: 0 | 1): Grid {
  const g = new Grid(32, 32);
  shadow(g, 3, 28, 26, 4);
  const f = new Grid(32, 32);
  // wing behind
  const wy = frame ? 4 : 7;
  f.oval(14, wy, 12, 8, 'j');
  for (let x = 16; x < 25; x += 3) f.vline(x, wy + 3, 4, 'y');
  // body crouched
  f.oval(8, 13, 20, 13, 'y').oval(10, 16, 13, 7, 'j');
  for (const x of [10, 16, 21, 25]) f.rect(x, 23, 3, 4, 'Y').hline(x, 27, 3, 'o');
  // head, horn, the open mouth
  f.oval(2, 8, 12, 11, 'y').vline(7, 4, 5, 'o').set(6, 4, 'o').set(5, 11, 'k').set(9, 11, 'k');
  f.rect(3, 15, 7, 3, 'q').hline(3, 15, 7, 'w');
  // a coin going in
  f.oval(0, 19, 4, 4, 'Y').set(1, 20, 'j');
  // tail curl
  f.oval(26, 12, 5, 6, 'Y').set(28, 13, 'y');
  return out(f, g);
}

/** 年兽: a shaggy horned beast with a red face like a lion dancer's — fierce and a little silly; it blinks and grins. */
export function nian(frame: 0 | 1): Grid {
  const g = new Grid(32, 32);
  shadow(g, 3, 28, 26, 4);
  const f = new Grid(32, 32);
  // shaggy body
  f.oval(6, 13, 22, 14, 'o').oval(8, 15, 16, 9, 'Y');
  for (let x = 7; x < 27; x += 3) f.set(x, 26, 'o').set(x + 1, 27, 'o');
  for (const x of [9, 22]) f.rect(x, 23, 4, 4, 'o').hline(x, 27, 4, 'm');
  // the big head: horns, a red face, white brows, big eyes, teeth
  f.oval(3, 2, 20, 16, 'r').oval(6, 5, 14, 10, 'p');
  f.vline(5, 0, 4, 'w').set(4, 0, 'w').vline(20, 0, 4, 'w').set(21, 0, 'w');
  f.hline(7, 6, 4, 'w').hline(15, 6, 4, 'w');
  if (frame) f.hline(8, 8, 3, 'k').hline(16, 8, 3, 'k');
  else f.rect(8, 7, 3, 3, 'w').set(9, 8, 'k').rect(16, 7, 3, 3, 'w').set(17, 8, 'k');
  f.rect(11, 10, 4, 2, 'R');
  f.rect(8, 13, 10, 3, 'q');
  for (let x = 9; x < 17; x += 2) f.set(x, 13, 'w').set(x + 1, frame ? 15 : 13, 'w');
  return out(f, g);
}

/** 龙: a long gold dragon — horns, a red mane, whiskers, scales, four clawed legs — its body ripples in three frames. */
export function dragon(frame: 0 | 1 | 2): Grid {
  const g = new Grid(48, 32);
  const f = new Grid(48, 32);
  // the body: a wave from the head (left) to the tail (right)
  const at = (x: number) => Math.round(16 + Math.sin((x + frame * 4) / 5.5) * 6);
  for (let x = 10; x < 46; x++) {
    const y = at(x);
    const w = x < 40 ? 4 : Math.max(1, 44 - x);
    f.vline(x, y - Math.floor(w / 2), w, 'y').set(x, y - Math.floor(w / 2), 'j');
    if (x % 3 === 0) f.set(x, y, 'Y');
    // the dorsal fin, red
    if (x % 4 === 1) f.set(x, y - Math.floor(w / 2) - 1, 'r');
  }
  // legs with claws
  for (const x of [15, 22, 30, 36]) {
    const y = at(x) + 2;
    f.vline(x, y, 4, 'y').hline(x - 1, y + 4, 3, 'o');
  }
  // the head: horns, eye, open jaw, whiskers, mane
  const hy = at(10);
  f.oval(1, hy - 5, 11, 9, 'y').rect(0, hy - 1, 4, 3, 'j').rect(1, hy + 2, 5, 2, 'q').hline(1, hy + 2, 5, 'w');
  f.set(6, hy - 3, 'k').set(7, hy - 3, 'r');
  f.vline(8, hy - 9, 4, 'o').set(9, hy - 9, 'o').vline(5, hy - 8, 3, 'o');
  for (const [dx, dy] of [[10, -4], [11, -2], [12, 0], [11, 2]] as const) f.set(dx, hy + dy, 'r').set(dx + 1, hy + dy, 'R');
  for (let i = 0; i < 5; i++) f.set(i, hy + 5 + (i % 2), 'y').set(i, hy - 6 - (i % 2), 'y');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 石猴: a small stone monkey from 白云观's carvings, crouching with a peach; it blinks and curls its tail. */
export function shihou(frame: 0 | 1): Grid {
  const g = new Grid(32, 32);
  shadow(g, 8, 28, 16, 4);
  const f = new Grid(32, 32);
  // tail
  if (frame) f.hline(21, 20, 5, 'c').vline(25, 16, 4, 'c').set(24, 15, 'c');
  else f.hline(21, 23, 6, 'c').set(26, 22, 'c');
  // body crouched
  f.oval(10, 15, 13, 13, 'd').oval(12, 18, 8, 8, 'e');
  // head, face, ears
  f.oval(9, 5, 14, 12, 'd').oval(11, 8, 10, 8, 'e').rect(7, 9, 3, 3, 'd').rect(22, 9, 3, 3, 'd');
  if (frame) f.hline(13, 11, 2, 'k').hline(17, 11, 2, 'k');
  else f.set(13, 11, 'k').set(18, 11, 'k').set(13, 10, 'w').set(18, 10, 'w');
  f.hline(14, 14, 4, 'c');
  // the peach in its hands
  f.oval(12, 20, 7, 6, 'N').set(14, 21, 'w').vline(15, 19, 2, 'h').set(16, 19, 'G');
  f.rect(11, 26, 4, 2, 'c').rect(18, 26, 4, 2, 'c');
  return out(f, g);
}

/** 灶王爷: the kitchen god, seated — a black official's hat with its flaps, a long white beard, a red robe, the tablet 笏 in his hands; the beard stirs. */
export function zaowang(frame: 0 | 1): Grid {
  const g = new Grid(32, 32);
  shadow(g, 4, 28, 24, 4);
  const f = new Grid(32, 32);
  // robe seated
  f.oval(6, 13, 20, 16, 'r').rect(8, 22, 16, 6, 'R').hline(8, 27, 16, 'q');
  f.rect(13, 14, 6, 9, 'y').hline(13, 14, 6, 'j');
  // head, hat with flaps
  f.oval(10, 4, 12, 11, 's').rect(9, 1, 14, 4, 'a').hline(9, 1, 14, 'b').rect(5, 3, 4, 2, 'a').rect(23, 3, 4, 2, 'a');
  f.set(13, 8, 'k').set(18, 8, 'k').hline(12, 7, 3, 'H').hline(17, 7, 3, 'H').set(15, 10, 'S');
  // the long white beard, stirring
  const b = frame ? 1 : 0;
  f.rect(11, 11, 10, 3, 'w').rect(12 + b, 14, 8, 4, 'w').rect(13 + b, 18, 6, 3, 'e').set(15 + b, 21, 'e');
  // the tablet 笏
  f.rect(22, 12, 3, 12, 'e').vline(22, 12, 12, 'w').set(23, 24, 'd');
  f.rect(20, 18, 3, 3, 's');
  return out(f, g);
}

/** 天官: the Heavenly Official in red, a winged black hat, a jade belt, unrolling a scroll that says 天官赐福 — it flutters. */
export function tianguan(frame: 0 | 1): Grid {
  const g = new Grid(32, 32);
  shadow(g, 6, 28, 20, 4);
  const f = new Grid(32, 32);
  // robe standing
  f.rect(10, 13, 12, 15, 'r').rect(9, 18, 14, 10, 'r').vline(15, 14, 14, 'R').hline(9, 18, 14, 'h').set(12, 18, 'i').set(19, 18, 'i');
  f.rect(10, 27, 4, 1, 'a').rect(18, 27, 4, 1, 'a');
  // head, the winged hat
  f.oval(11, 3, 10, 10, 's').rect(10, 0, 12, 4, 'a').rect(4, 2, 6, 2, 'a').rect(22, 2, 6, 2, 'a');
  f.set(14, 7, 'k').set(18, 7, 'k').hline(14, 10, 4, 'R').set(13, 9, 'p').set(19, 9, 'p');
  f.rect(13, 11, 6, 2, 'H');
  // the scroll across the front
  const dy = frame ? 1 : 0;
  f.rect(3, 15 + dy, 26, 6, 'y').vline(3, 14 + dy, 8, 'M').vline(28, 14, 8, 'M').rect(5, 16 + dy, 22, 4, 'r');
  for (let x = 7; x < 26; x += 5) f.rect(x, 17 + dy, 3, 2, 'j');
  return out(f, g);
}

/** The lantern's tenth place (the family): a red gate with 福 under a lit lantern, four small figures — 王阿姨, 小军, you and 兔儿爷. */
export function family(): Grid {
  const f = new Grid(32, 32);
  f.rect(6, 6, 20, 16, 'r').rect(8, 8, 16, 14, 'R').vline(16, 8, 14, 'q');
  f.rect(13, 12, 6, 6, 'y').set(15, 14, 'r').set(16, 15, 'r');
  f.rect(4, 3, 24, 3, 'b').hline(4, 3, 24, 'c');
  f.oval(14, 0, 4, 5, 'r').set(15, 1, 'L');
  const person = (x: number, top: string, h: number) => f.oval(x, 28 - h - 4, 4, 4, 's').rect(x, 28 - h, 4, h, top);
  person(3, 'V', 7);
  person(9, 'n', 8);
  person(19, 'B', 7);
  f.oval(26, 21, 4, 5, 'w').vline(26, 18, 3, 'w').vline(29, 18, 3, 'w').set(27, 23, 'r');
  f.hline(0, 28, 32, 'F');
  return f.outline('k');
}

// ---------------------------------------------------------------- woodcuts

/** Flat, like a print: each shade becomes its colour's one ink. */
const FLAT: Record<string, string> = {
  e: 'w', d: 'e', c: 'd', b: 'c', a: 'b',
  S: 's', t: 's', p: 'r', R: 'r', q: 'R',
  j: 'y', Y: 'y', o: 'o', i: 'h', G: 'h', g: 'G',
  x: 'v', u: 'v', l: 'n', B: 'n', X: 'n', W: 'n',
  z: 'z', M: 'z', m: 'M', L: 'y', O: 'y', N: 'N', V: 'V', H: 'k', _: '.',
};

/** A figure as a 48×48 woodcut: flat inks, a bold two-pixel line, on warm paper in a red border with little cloud corners. */
export function woodcut(fig: Grid): Grid {
  const flat = fig.clone().swap(FLAT);
  // a bold line: the outline once more around the first
  flat.outline('k').outline('k');
  const g = new Grid(48, 48, 'f');
  g.rect(0, 0, 48, 48, 'r').rect(2, 2, 44, 44, 'k').rect(3, 3, 42, 42, 'f');
  // cloud corners 祥云
  for (const [x, y] of [[4, 4], [40, 4], [4, 40], [40, 40]] as const) g.oval(x, y, 4, 4, 'y').set(x + 1, y + 1, 'f');
  const x = Math.round((48 - flat.w) / 2);
  const y = 48 - 4 - flat.h;
  g.stamp(flat, x, Math.max(3, y));
  // the ground line the figure stands on, and the frame over everything (a wide figure is cut by it, as a print is)
  g.hline(5, 44, 38, 'F');
  g.where((px, py) => px < 2 || py < 2 || px > 45 || py > 45, 'r').where((px, py) => (px === 2 || py === 2 || px === 45 || py === 45) && px >= 2 && py >= 2 && px <= 45 && py <= 45, 'k');
  return g;
}

/** Every lantern figure's sprite frames and its picture, by spirit id (story.md §1.1). */
export const FIGURES: Record<string, { size: [number, number]; frames: Array<[string, () => Grid]>; picture: () => Grid }> = {
  shishizi: { size: [32, 32], frames: [['idle-0', () => lion(0)], ['idle-1', () => lion(1)]], picture: () => lion(1) },
  jiuweihu: { size: [32, 32], frames: [['idle-0', () => fox(0)], ['idle-1', () => fox(1)], ['idle-2', () => fox(2)]], picture: () => fox(0) },
  menshen: { size: [32, 32], frames: [['idle-0', () => doorGods(0)], ['idle-1', () => doorGods(1)]], picture: () => doorGods(0) },
  qilin: { size: [32, 32], frames: [['idle-0', () => qilin(0)], ['idle-1', () => qilin(1)]], picture: () => qilin(0) },
  shihou: { size: [32, 32], frames: [['idle-0', () => shihou(0)], ['idle-1', () => shihou(1)]], picture: () => shihou(0) },
  pixiu: { size: [32, 32], frames: [['idle-0', () => pixiu(0)], ['idle-1', () => pixiu(1)]], picture: () => pixiu(0) },
  nianshou: { size: [32, 32], frames: [['idle-0', () => nian(0)], ['idle-1', () => nian(1)]], picture: () => nian(0) },
  long: { size: [48, 32], frames: [['idle-0', () => dragon(0)], ['idle-1', () => dragon(1)], ['idle-2', () => dragon(2)]], picture: () => dragon(0) },
  zaowang: { size: [32, 32], frames: [['idle-0', () => zaowang(0)], ['idle-1', () => zaowang(1)]], picture: () => zaowang(0) },
  tianguan: { size: [32, 32], frames: [['idle-0', () => tianguan(0)], ['idle-1', () => tianguan(1)]], picture: () => tianguan(0) },
  family: { size: [32, 32], frames: [], picture: family },
};
