/**
 * Things in the street, with outlines like the characters: red lanterns
 * (dark and lit), the 槐树 pagoda tree, a bicycle, a 三轮车 tricycle, the
 * subway entrance sign, a bird cage.
 */

import { Grid } from './grid';

/** A red lantern hung from a bracket, 16×16. `glow` 0 = unlit, 1–2 = lit flicker. */
export function lantern(glow: number): Grid {
  const g = new Grid(16, 16);
  const f = new Grid(16, 16);
  f.vline(7, 0, 2, 'm').vline(8, 0, 2, 'm');
  f.rect(5, 2, 6, 1, 'Y');
  const body = glow ? (glow === 1 ? 'O' : 'L') : 'r';
  const shade = glow ? 'r' : 'R';
  f.oval(3, 3, 10, 8, body).vline(11, 5, 4, shade).vline(4, 5, 4, glow ? 'L' : 'p');
  if (glow) f.oval(5, 5, 6, 4, glow === 1 ? 'L' : 'Q');
  for (const x of [5, 8, 10]) f.vline(x, 4, 6, shade);
  f.rect(5, 11, 6, 1, 'Y');
  f.vline(7, 12, 3, 'y').vline(8, 12, 3, 'Y');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** The 槐树 of the hutongs, 32×48: a round crown over a crooked trunk, its shadow falling right. */
export function tree(): Grid {
  const g = new Grid(32, 48);
  g.oval(6, 40, 24, 7, '_');
  const f = new Grid(32, 48);
  // trunk
  f.rect(13, 26, 6, 17, 'M').vline(13, 26, 17, 'z').vline(18, 26, 17, 'm').rect(11, 40, 10, 3, 'M').set(12, 34, 'm');
  // crown: clusters of leaves, lit top-left
  const clusters: Array<[number, number, number, number]> = [
    [2, 8, 14, 13], [14, 6, 16, 14], [7, 1, 18, 14], [4, 16, 12, 11], [15, 16, 14, 11], [9, 12, 14, 14],
  ];
  for (const [x, y, w, h] of clusters) f.oval(x, y, w, h, 'G');
  for (const [x, y, w, h] of clusters) f.oval(x + 1, y + 1, w - 4, h - 4, 'h');
  for (const [x, y, w] of clusters) f.oval(x + 2, y + 1, Math.max(3, w / 3), 3, 'i');
  f.where((x, y, c) => c === 'G' && (x + y) % 5 === 0, 'g');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A black city bicycle parked side-on, 16×16. */
export function bicycle(): Grid {
  const g = new Grid(16, 16);
  g.oval(1, 13, 14, 3, '_');
  const f = new Grid(16, 16);
  for (const cx of [0, 10]) f.oval(cx, 8, 6, 6, 'a');
  f.hline(3, 10, 10, 'b').set(6, 9, 'b').set(7, 8, 'b').hline(5, 7, 4, 'k').vline(12, 6, 5, 'b').hline(11, 5, 3, 'd');
  f.set(12, 7, 'n').set(12, 8, 'n');
  f.outline('k');
  // hollow wheels with a hub, cut after the outline so they stay open
  for (const cx of [0, 10]) {
    f.oval(cx + 1, 9, 4, 4, '.');
    f.set(cx + 2, 10, 'd').set(cx + 3, 11, 'd').set(cx + 2, 11, 'c').set(cx + 3, 10, 'c');
  }
  return g.stamp(f, 0, 0);
}

/** A hutong 三轮车: a pedal tricycle with a red canopy and a bench, 32×24. */
export function tricycle(): Grid {
  const g = new Grid(32, 24);
  g.oval(2, 20, 28, 4, '_');
  const f = new Grid(32, 24);
  // wheels
  for (const cx of [2, 20]) {
    f.oval(cx, 14, 8, 8, 'a');
    f.oval(cx + 2, 16, 4, 4, 'c');
  }
  // bench and canopy
  f.rect(16, 9, 12, 6, 'r').hline(16, 9, 12, 'p').rect(15, 2, 14, 3, 'R').hline(15, 2, 14, 'r').vline(16, 4, 6, 'c').vline(27, 4, 6, 'c');
  f.hline(18, 6, 8, 'y');
  // frame, seat, handlebars
  f.hline(6, 13, 12, 'b').vline(8, 8, 6, 'b').hline(6, 8, 4, 'k').vline(4, 9, 6, 'b').hline(3, 8, 3, 'd');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/**
 * The subway entrance sign, 16×32: a grey post with a blue sign and a white
 * train seen from the front (not any operator's real logo).
 */
export function subwaySign(): Grid {
  const g = new Grid(16, 32);
  g.oval(4, 28, 10, 3, '_');
  const f = new Grid(16, 32);
  f.rect(7, 12, 2, 17, 'c').vline(8, 12, 17, 'b').rect(5, 28, 6, 2, 'b');
  f.rect(2, 1, 12, 12, 'B').rect(3, 2, 10, 10, 'n');
  // a white train seen from the front: rounded body, two windows, a lamp line
  f.rect(5, 3, 6, 8, 'w').hline(6, 2, 4, 'w').rect(6, 4, 2, 2, 'n').rect(9, 4, 2, 2, 'n').hline(6, 8, 4, 'l');
  f.set(5, 11, 'w').set(10, 11, 'w');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** An old man's bird cage on a hook, 16×16. */
export function birdCage(): Grid {
  const g = new Grid(16, 16);
  const f = new Grid(16, 16);
  f.vline(7, 0, 2, 'm').oval(5, 1, 6, 3, 'M').oval(6, 2, 4, 2, '.');
  f.oval(2, 3, 12, 11, 'z');
  f.oval(3, 4, 10, 9, '.');
  for (let x = 4; x < 13; x += 2) f.vline(x, 5, 8, 'M');
  f.rect(3, 12, 10, 2, 'm');
  f.oval(6, 7, 4, 3, 'y').set(9, 8, 'k').set(10, 8, 'o');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

export const PROPS: Array<[string, string, () => Array<[string, Grid]>]> = [
  ['lantern', 'a red lantern: unlit and two lit frames that flicker', () => [['unlit', lantern(0)], ['lit-0', lantern(1)], ['lit-1', lantern(2)]]],
  ['tree', 'the 槐树 pagoda tree of the hutongs', () => [['huai', tree()]]],
  ['bicycle', 'a parked city bicycle', () => [['side', bicycle()], ['side-r', bicycle().mirror()]]],
  ['tricycle', 'a 三轮车 pedal tricycle', () => [['side', tricycle()], ['side-r', tricycle().mirror()]]],
  ['subway-sign', 'a subway entrance sign', () => [['post', subwaySign()]]],
  ['bird-cage', "an old man's bird cage", () => [['cage', birdCage()]]],
];
