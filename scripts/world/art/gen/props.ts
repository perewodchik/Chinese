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

/** The old lantern after its fall: on the ground, torn, its frame bent. */
export function brokenLantern(): Grid {
  const g = new Grid(16, 16);
  g.oval(1, 12, 15, 4, '_');
  const f = new Grid(16, 16);
  f.oval(2, 7, 12, 7, 'r').vline(12, 8, 5, 'R').vline(4, 8, 5, 'p');
  f.oval(6, 8, 4, 4, 'k').set(7, 9, 'a').set(8, 10, 'a');
  for (const x of [5, 10]) f.vline(x, 8, 5, 'R');
  f.rect(2, 12, 5, 1, 'Y').set(13, 6, 'Y').set(14, 5, 'Y').set(1, 9, 'y');
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

/** A pigeon, 8×8: pecking, looking up, and two wing beats. */
export function pigeon(pose: 'peck' | 'look' | 'fly-0' | 'fly-1'): Grid {
  const g = new Grid(8, 8);
  const f = new Grid(8, 8);
  if (pose === 'peck' || pose === 'look') {
    f.oval(1, 3, 5, 4, 'c').hline(2, 4, 3, 'd').set(5, 5, 'b');
    if (pose === 'peck') f.set(5, 5, 'c').set(6, 6, 'b').set(6, 5, 'c');
    else f.rect(4, 1, 2, 3, 'c').set(5, 2, 'k').set(6, 2, 'Y').set(4, 3, 'v');
    f.set(2, 7, 'R').set(4, 7, 'R');
  } else {
    const up = pose === 'fly-0';
    f.oval(2, 3, 4, 3, 'c').set(6, 3, 'c').set(7, 3, 'Y');
    if (up) f.hline(0, 1, 3, 'd').hline(5, 1, 3, 'd').set(2, 2, 'd').set(5, 2, 'd');
    else f.hline(0, 5, 3, 'd').hline(5, 5, 3, 'd');
  }
  f.outline('a');
  g.stamp(f, 0, 0);
  if (pose === 'peck' || pose === 'look') g.hline(1, 7, 5, '_');
  return g;
}


// ---------------------------------------------------------------- F1: rooms, shops, the towers

/** A square wooden table, ¾ view, 16×16. */
export function table(): Grid {
  const g = new Grid(16, 16);
  g.oval(1, 12, 15, 4, '_');
  const f = new Grid(16, 16);
  f.rect(1, 3, 14, 6, 'z').hline(1, 3, 14, 'f').rect(1, 9, 14, 2, 'M');
  f.vline(2, 11, 4, 'm').vline(13, 11, 4, 'm');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A little stool, 16×16. */
export function stool(): Grid {
  const g = new Grid(16, 16);
  g.oval(3, 12, 11, 3, '_');
  const f = new Grid(16, 16);
  f.oval(4, 6, 8, 4, 'r').hline(5, 6, 6, 'p').rect(4, 8, 8, 2, 'R');
  f.vline(5, 10, 3, 'm').vline(10, 10, 3, 'm');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A bed with a flowered quilt, head to the wall, 16×32. */
export function bed(): Grid {
  const g = new Grid(16, 32);
  g.oval(0, 27, 16, 5, '_');
  const f = new Grid(16, 32);
  f.rect(1, 2, 14, 27, 'M').rect(2, 3, 12, 5, 'w').hline(2, 3, 12, 'e');
  f.rect(2, 9, 12, 18, 'n').rect(2, 9, 12, 2, 'l');
  for (let y = 12; y < 26; y += 4) for (let x = 4; x < 13; x += 4) f.set(x, y, 'N').set(x + 1, y + 1, 'y');
  f.hline(1, 28, 14, 'm');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** Bamboo steamers stacked on a stove, 16×16 — the 包子 of the 早点铺. `puff` 0/1 moves the steam. */
export function steamer(puff: number): Grid {
  const g = new Grid(16, 16);
  g.oval(1, 13, 15, 3, '_');
  const f = new Grid(16, 16);
  f.rect(2, 11, 12, 4, 'a').hline(2, 11, 12, 'b');
  for (const y of [8, 5]) f.oval(2, y, 12, 4, 'z').hline(3, y + 1, 10, 'Y').hline(3, y + 3, 10, 'o');
  f.oval(3, 3, 10, 3, 'Y').hline(5, 3, 6, 'j');
  f.outline('k');
  g.stamp(f, 0, 0);
  const x = puff ? 6 : 8;
  g.set(x, 1, 'w').set(x + 1, 0, 'e').set(x - 2, 2, 'e');
  return g;
}

/** A wok of oil on a stove, 16×16 — for 油条. */
export function wok(): Grid {
  const g = new Grid(16, 16);
  g.oval(1, 13, 15, 3, '_');
  const f = new Grid(16, 16);
  f.rect(2, 9, 12, 6, 'a').hline(2, 9, 12, 'b').rect(6, 12, 4, 2, 'O');
  f.oval(1, 4, 14, 6, 'b').oval(2, 5, 12, 4, 'Y');
  f.hline(4, 6, 6, 'y').hline(6, 7, 5, 'o');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A low tea table with a teapot and cups, 16×16. */
export function teaTable(): Grid {
  const g = new Grid(16, 16);
  g.oval(1, 12, 15, 4, '_');
  const f = new Grid(16, 16);
  f.rect(1, 6, 14, 5, 'M').hline(1, 6, 14, 'z').rect(1, 11, 14, 1, 'm').vline(2, 12, 2, 'm').vline(13, 12, 2, 'm');
  f.oval(5, 2, 5, 5, 'R').set(10, 4, 'R').set(4, 3, 'R').hline(6, 2, 3, 'p');
  f.set(12, 6, 'w').set(3, 7, 'w').set(12, 7, 'e');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A barber's chair, red leather on chrome, 16×16. */
export function barberChair(): Grid {
  const g = new Grid(16, 16);
  g.oval(2, 13, 13, 3, '_');
  const f = new Grid(16, 16);
  f.rect(4, 1, 8, 6, 'r').hline(4, 1, 8, 'p').rect(3, 7, 10, 3, 'R').hline(3, 7, 10, 'r');
  f.vline(3, 5, 4, 'd').vline(12, 5, 4, 'd');
  f.rect(7, 10, 2, 3, 'd').rect(5, 13, 6, 1, 'c');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** The station's ticket machine, 16×32: blue, a screen, a slot. */
export function ticketMachine(): Grid {
  const g = new Grid(16, 32);
  g.oval(1, 28, 15, 4, '_');
  const f = new Grid(16, 32);
  f.rect(2, 4, 12, 26, 'n').vline(2, 4, 26, 'l').vline(13, 4, 26, 'B');
  f.rect(4, 7, 8, 7, 'k').rect(5, 8, 6, 5, 'x').hline(5, 9, 4, 'w').hline(5, 11, 3, 'w');
  f.rect(5, 17, 6, 2, 'a').rect(6, 22, 4, 1, 'a').rect(2, 2, 12, 3, 'r').hline(4, 3, 8, 'w');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A potted plant, 16×16. */
export function plant(): Grid {
  const g = new Grid(16, 16);
  g.oval(3, 13, 11, 3, '_');
  const f = new Grid(16, 16);
  f.rect(5, 10, 6, 4, 'M').hline(5, 10, 6, 'z');
  for (const [x, y, w, h] of [[3, 3, 6, 6], [7, 1, 6, 7], [5, 5, 7, 5]] as const) f.oval(x, y, w, h, 'h');
  f.set(6, 4, 'i').set(9, 3, 'i').set(8, 7, 'G');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A small blue street sign on a post, 16×32 — for 公共厕所 and the like (the words are the sign object's). */
export function streetSign(): Grid {
  const g = new Grid(16, 32);
  g.oval(4, 28, 10, 3, '_');
  const f = new Grid(16, 32);
  f.rect(7, 10, 2, 19, 'c').vline(8, 10, 19, 'b');
  f.rect(1, 3, 14, 8, 'B').rect(2, 4, 12, 6, 'n');
  f.hline(3, 5, 4, 'w').hline(9, 5, 3, 'w').hline(3, 8, 9, 'l');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/**
 * A tower of old Beijing on its brick terrace (鼓楼 / 钟楼), 80×96: a grey
 * stone terrace with an arched passage, and on it a hall of red columns
 * under two tiers of grey roof with upturned ends.
 * `kind` 'drum' has red walls and a wooden gallery; 'bell' is all grey stone.
 */
export function tower(kind: 'drum' | 'bell' | 'arrow'): Grid {
  const W = 80;
  const H = 96;
  const g = new Grid(W, H);
  g.oval(2, 88, 78, 8, '_');
  const f = new Grid(W, H);
  const stone = kind === 'drum' ? 'c' : 'd';
  const stoneLit = kind === 'drum' ? 'd' : 'e';
  // terrace
  f.rect(2, 56, 76, 36, stone).hline(2, 56, 76, stoneLit);
  for (let y = 60; y < 92; y += 4) f.hline(2, y, 76, kind === 'drum' ? 'b' : 'c');
  for (let y = 58; y < 92; y += 4) for (let x = 2 + ((y / 4) % 2 ? 0 : 4); x < 78; x += 8) f.vline(x, y, 2, kind === 'drum' ? 'b' : 'c');
  // the arch through it
  f.oval(30, 66, 20, 28, 'a').rect(30, 80, 20, 12, 'a').oval(32, 68, 16, 24, 'k').rect(32, 80, 16, 12, 'k');
  // the hall: red walls or grey stone, columns
  const wall = kind === 'drum' ? 'r' : kind === 'arrow' ? 'c' : 'd';
  f.rect(10, 34, 60, 22, wall);
  if (kind === 'arrow') {
    f.hline(10, 34, 60, 'd');
    for (const y of [37, 43, 49]) for (let x = 13; x < 68; x += 6) f.rect(x, y, 3, 3, 'a').set(x, y, 'k');
  } else if (kind === 'drum') {
    for (let x = 12; x < 70; x += 8) f.rect(x, 34, 2, 22, 'R').vline(x, 34, 22, 'p');
    f.rect(26, 42, 28, 14, 'q').rect(30, 44, 8, 12, 'M').rect(42, 44, 8, 12, 'M');
  } else {
    f.hline(10, 34, 60, 'e');
    f.oval(33, 40, 14, 16, 'b').rect(33, 48, 14, 8, 'b').oval(35, 42, 10, 14, 'a');
  }
  // lower roof
  const roofRow = (y: number, x0: number, x1: number) => {
    for (let x = x0; x < x1; x += 3) f.vline(x, y, 8, 'c').vline(x + 1, y, 8, 'b').vline(x + 2, y, 8, 'a');
    f.hline(x0, y + 8, x1 - x0, 'k').rect(x0, y + 9, x1 - x0, 2, 'v').hline(x0, y + 9, x1 - x0, 'Y');
    // upturned ends
    f.rect(x0 - 3, y + 5, 4, 3, 'b').set(x0 - 4, y + 4, 'a').rect(x1 - 1, y + 5, 4, 3, 'b').set(x1 + 3, y + 4, 'a');
  };
  roofRow(24, 6, 74);
  // upper hall and roof
  f.rect(18, 16, 44, 9, wall);
  if (kind === 'drum') for (let x = 20; x < 60; x += 6) f.vline(x, 16, 9, 'R');
  if (kind === 'arrow') for (let x = 21; x < 60; x += 6) f.rect(x, 18, 2, 3, 'a');
  roofRow(4, 12, 68);
  f.rect(14, 1, 52, 4, 'a').hline(14, 2, 52, 'b').set(13, 0, 'a').set(66, 0, 'a');
  f.outline('k');
  return g.stamp(f, 0, 0);
}


/**
 * A 石狮子, the stone guardian lion, sitting on its plinth, 16×32. `awake`:
 * at night, when it is the spirit, its eyes glow and a little red ribbon shows.
 */
export function stoneLion(awake: boolean): Grid {
  const g = new Grid(16, 32);
  g.oval(1, 28, 15, 4, '_');
  const f = new Grid(16, 32);
  // plinth
  f.rect(1, 22, 14, 8, 'd').hline(1, 22, 14, 'e').rect(2, 25, 12, 3, 'c').hline(1, 29, 14, 'b');
  // body sitting, front legs down
  f.rect(4, 13, 8, 9, 'd').vline(4, 13, 9, 'e').vline(11, 13, 9, 'c');
  f.rect(5, 18, 2, 4, 'e').rect(9, 18, 2, 4, 'c').hline(4, 21, 8, 'c');
  // head with the curly mane
  f.oval(2, 3, 12, 11, 'c');
  for (const [x, y] of [[3, 5], [6, 3], [10, 4], [12, 7], [3, 9], [11, 11], [5, 12]] as const) f.oval(x, y, 3, 3, 'b').set(x, y, 'd');
  f.oval(4, 5, 8, 7, 'd').hline(5, 6, 6, 'e');
  // eyes and mouth
  const eye = awake ? 'Q' : 'b';
  f.set(6, 8, eye).set(9, 8, eye).hline(6, 10, 4, 'b').set(7, 11, awake ? 'r' : 'c');
  // a ball under its paw
  f.oval(10, 18, 4, 4, 'e').set(11, 19, 'w');
  if (awake) f.hline(5, 13, 6, 'r').set(7, 14, 'R').set(8, 14, 'R');
  f.outline('k');
  g.stamp(f, 0, 0);
  if (awake) g.set(5, 7, 'L').set(10, 7, 'L');
  return g;
}


// ---------------------------------------------------------------- H1: the lakes and the hill

/** A weeping willow by the water, 32×48: long hanging strands, lit from the left. */
export function willow(): Grid {
  const g = new Grid(32, 48);
  g.oval(6, 41, 22, 6, '_');
  const f = new Grid(32, 48);
  f.rect(14, 24, 4, 20, 'M').vline(14, 24, 20, 'z').vline(17, 24, 20, 'm').rect(12, 41, 8, 3, 'M');
  f.oval(4, 2, 24, 18, 'h').oval(7, 3, 12, 8, 'i');
  // the hanging strands
  for (let x = 4; x < 28; x += 2) {
    const len = 16 + ((x * 7) % 9);
    f.vline(x, 12, len, x % 4 ? 'h' : 'G');
    f.set(x, 12 + len, 'i');
  }
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A small rowing boat on the lake, 32×16. */
export function boat(): Grid {
  const g = new Grid(32, 16);
  const f = new Grid(32, 16);
  f.rect(3, 6, 26, 6, 'M').hline(3, 6, 26, 'z').rect(6, 12, 20, 2, 'm');
  f.set(2, 6, 'M').set(29, 6, 'M').set(1, 5, 'z').set(30, 5, 'z');
  f.rect(10, 7, 12, 3, 'r').hline(10, 7, 12, 'p');
  f.hline(8, 3, 1, 'z').vline(8, 3, 4, 'z');
  f.outline('k');
  g.stamp(f, 0, 0);
  g.hline(0, 14, 32, 'X').hline(4, 15, 24, 'W');
  return g;
}

/** A pavilion on the hilltop (万春亭), 64×64: yellow roofs in two tiers on red columns. */
export function pavilion(): Grid {
  const g = new Grid(64, 64);
  g.oval(4, 58, 58, 6, '_');
  const f = new Grid(64, 64);
  f.rect(6, 50, 52, 10, 'e').hline(6, 50, 52, 'w').hline(6, 59, 52, 'c');
  for (const x of [12, 22, 40, 50]) f.rect(x, 32, 3, 18, 'r').vline(x, 32, 18, 'p');
  f.rect(10, 30, 44, 3, 'v').hline(10, 30, 44, 'Y');
  const roof = (y: number, x0: number, x1: number, h: number) => {
    for (let x = x0; x < x1; x += 3) f.vline(x, y, h, 'j').vline(x + 1, y, h, 'y').vline(x + 2, y, h, 'Y');
    f.hline(x0, y + h, x1 - x0, 'o');
    f.rect(x0 - 4, y + h - 3, 5, 3, 'y').set(x0 - 5, y + h - 4, 'Y').rect(x1 - 1, y + h - 3, 5, 3, 'y').set(x1 + 4, y + h - 4, 'Y');
  };
  roof(18, 6, 58, 12);
  f.rect(16, 12, 32, 6, 'r');
  roof(2, 14, 50, 10);
  f.rect(29, 0, 6, 3, 'y').set(31, 0, 'j');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** The palace's corner tower (角楼) over its moat, 64×64: a cluster of yellow roofs on a red hall, on the wall. */
export function cornerTower(): Grid {
  const g = new Grid(64, 64);
  const f = new Grid(64, 64);
  f.rect(0, 46, 64, 18, 'r').rect(0, 44, 64, 3, 'Y').hline(0, 44, 64, 'j').hline(0, 47, 64, 'q');
  f.rect(12, 30, 40, 14, 'r');
  for (let x = 14; x < 52; x += 6) f.vline(x, 30, 14, 'R');
  const tier = (y: number, x0: number, x1: number) => {
    for (let x = x0; x < x1; x += 3) f.vline(x, y, 8, 'j').vline(x + 1, y, 8, 'y').vline(x + 2, y, 8, 'Y');
    f.hline(x0, y + 8, x1 - x0, 'v').hline(x0, y + 9, x1 - x0, 'u');
    f.rect(x0 - 3, y + 5, 4, 3, 'y').rect(x1 - 1, y + 5, 4, 3, 'y');
  };
  tier(22, 6, 58);
  tier(12, 14, 50);
  tier(2, 22, 42);
  f.rect(30, 0, 4, 3, 'Y');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** The White Dagoba of 北海 on its hill, 32×48. */
export function whitePagoda(): Grid {
  const g = new Grid(32, 48);
  g.oval(2, 43, 30, 5, '_');
  const f = new Grid(32, 48);
  f.rect(4, 38, 24, 8, 'd').hline(4, 38, 24, 'e');
  f.rect(8, 32, 16, 6, 'w').vline(8, 32, 6, 'e');
  f.oval(6, 16, 20, 18, 'w').oval(8, 18, 8, 10, 'w').vline(22, 20, 12, 'e');
  f.rect(12, 20, 8, 7, 'e').rect(14, 21, 4, 5, 'r');
  f.rect(13, 8, 6, 9, 'w').vline(18, 8, 9, 'e');
  for (let y = 9; y < 17; y += 2) f.hline(13, y, 6, 'd');
  f.oval(11, 4, 10, 4, 'Y').rect(15, 0, 2, 5, 'Y').set(15, 0, 'j');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/**
 * The nine-tailed fox (九尾狐), 32×24: white, its tails fanned behind it.
 * Frame 0/1 sway the tails; it is only seen at night.
 */
export function fox(sway: number): Grid {
  const g = new Grid(32, 24);
  g.oval(4, 20, 24, 4, '_');
  const f = new Grid(32, 24);
  for (let i = 0; i < 9; i++) {
    const a = -1.1 + (i / 8) * 2.2 + (sway ? 0.08 : -0.08);
    const x = 16 + Math.round(Math.sin(a) * 11);
    const y = 12 - Math.round(Math.cos(a) * 9);
    f.oval(x - 2, y - 2, 5, 5, 'w').set(x, y - 2, 'e');
    f.set(x, y + 1, 'x');
  }
  f.oval(10, 10, 12, 8, 'w').oval(11, 13, 10, 5, 'e');
  f.oval(12, 6, 8, 7, 'w');
  f.set(12, 5, 'w').set(13, 4, 'w').set(19, 5, 'w').set(18, 4, 'w').set(13, 5, 'N').set(18, 5, 'N');
  f.set(14, 8, 'R').set(17, 8, 'R').set(15, 10, 'k').set(16, 10, 'k');
  f.vline(12, 17, 3, 'e').vline(19, 17, 3, 'e');
  f.outline('k');
  g.stamp(f, 0, 0);
  g.set(14, 8, 'O').set(17, 8, 'O');
  return g;
}


// ---------------------------------------------------------------- H2: 门神, 前门

/**
 * An old gate with its door gods (门神) painted on the two leaves, 32×32.
 * `faded`: the paint almost gone; restored: two bright generals.
 */
export function doorGods(faded: boolean): Grid {
  const g = new Grid(32, 32);
  const f = new Grid(32, 32);
  f.rect(0, 0, 32, 5, 'a').hline(0, 0, 32, 'b').hline(0, 4, 32, 'k');
  for (const x of [5, 13, 21]) f.rect(x, 1, 3, 2, 'v');
  const red = faded ? 'R' : 'r';
  f.rect(2, 5, 28, 25, red).vline(15, 5, 25, 'q').vline(16, 5, 25, 'q');
  const general = (x: number, face: string, robe: string) => {
    if (faded) {
      f.oval(x + 3, 9, 6, 5, 'p').rect(x + 2, 14, 8, 10, 'p');
      return;
    }
    f.oval(x + 2, 8, 8, 7, face).set(x + 4, 10, 'k').set(x + 7, 10, 'k').hline(x + 4, 13, 4, 'k');
    f.rect(x + 3, 6, 6, 2, 'Y').set(x + 5, 5, 'y');
    f.rect(x + 1, 15, 10, 10, robe).hline(x + 1, 15, 10, 'y').vline(x + 6, 15, 10, 'Y');
    f.rect(x, 17, 2, 6, 'e');
  };
  general(3, 'r', 'h');
  general(17, 'd', 'n');
  f.rect(0, 29, 32, 3, 'd').hline(0, 29, 32, 'e');
  f.outline('k');
  return g.stamp(f, 0, 0);
}


// ---------------------------------------------------------------- H3: 天坛, 国子监

/** 祈年殿, the Hall of Prayer for Good Harvests, 64×80: three round blue roofs on a white marble terrace. */
export function qiniandian(): Grid {
  const g = new Grid(64, 80);
  g.oval(2, 72, 62, 8, '_');
  const f = new Grid(64, 80);
  for (const [y, x0, x1] of [[64, 2, 62], [68, 4, 60], [72, 6, 58]] as const) f.rect(x0, y, x1 - x0, 4, 'e').hline(x0, y, x1 - x0, 'w');
  f.rect(12, 40, 40, 24, 'r');
  for (let x = 14; x < 52; x += 5) f.vline(x, 40, 24, 'R');
  f.rect(26, 52, 12, 12, 'q');
  const roof = (y: number, x0: number, x1: number) => {
    f.oval(x0, y, x1 - x0, 14, 'B');
    f.oval(x0 + 2, y + 1, x1 - x0 - 4, 9, 'n');
    for (let x = x0 + 4; x < x1 - 4; x += 3) f.vline(x, y + 3, 5, 'l');
    f.rect(x0, y + 11, x1 - x0, 2, 'Y');
  };
  roof(30, 6, 58);
  f.rect(16, 26, 32, 6, 'r');
  roof(16, 12, 52);
  f.rect(22, 14, 20, 4, 'r');
  roof(4, 18, 46);
  f.rect(30, 0, 4, 5, 'Y').set(31, 0, 'j');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A bronze 麒麟 on a stone base, 16×32; `awake` it glows faintly. */
export function qilin(awake: boolean): Grid {
  const g = new Grid(16, 32);
  g.oval(1, 28, 15, 4, '_');
  const f = new Grid(16, 32);
  f.rect(1, 23, 14, 7, 'd').hline(1, 23, 14, 'e');
  const b = awake ? 'Y' : 'u';
  const s = awake ? 'j' : 'v';
  f.rect(4, 14, 9, 9, b).vline(4, 14, 9, s);
  f.rect(4, 19, 2, 4, b).rect(10, 19, 2, 4, b);
  f.oval(3, 5, 10, 10, b).oval(4, 6, 6, 5, s);
  f.vline(7, 1, 5, 'o').set(6, 1, 'o').set(8, 1, 'o');
  f.set(6, 9, awake ? 'r' : 'k').set(10, 9, awake ? 'r' : 'k').hline(7, 12, 3, 'k');
  for (const x of [5, 8, 11]) f.set(x, 16, 'x');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A 牌楼 memorial archway over a lane, 48×48: red posts, a painted beam, grey-green roofs. */
export function archway(): Grid {
  const g = new Grid(48, 48);
  const f = new Grid(48, 48);
  for (const x of [4, 22, 40]) f.rect(x, 16, 4, 32, 'r').vline(x, 16, 32, 'p');
  f.rect(2, 16, 44, 6, 'v').hline(2, 16, 44, 'Y').hline(2, 21, 44, 'u');
  f.rect(14, 17, 20, 4, 'B').hline(16, 18, 16, 'Y');
  const roof = (y: number, x0: number, x1: number) => {
    for (let x = x0; x < x1; x += 3) f.vline(x, y, 6, 'h').vline(x + 1, y, 6, 'G').vline(x + 2, y, 6, 'g');
    f.hline(x0, y + 6, x1 - x0, 'k');
  };
  roof(9, 0, 48);
  roof(2, 12, 36);
  f.outline('k');
  return g.stamp(f, 0, 0);
}


// ---------------------------------------------------------------- H4: 鸟巢, 水立方, 貔貅

/** 鸟巢, the National Stadium, 96×48: a grey steel lattice bowl with a red glow inside. */
export function birdsNest(): Grid {
  const g = new Grid(96, 48);
  g.oval(2, 40, 94, 8, '_');
  const f = new Grid(96, 48);
  f.oval(2, 4, 92, 42, 'c');
  f.oval(10, 8, 76, 20, 'R').oval(14, 10, 68, 14, 'r');
  // the woven steel: crossing strands
  for (let i = -48; i < 96; i += 6) {
    for (let t = 0; t < 48; t++) {
      const x1 = i + t;
      const x2 = i + 48 - t;
      if (f.get(x1, t) !== '.' && f.get(x1, t) !== 'r' && f.get(x1, t) !== 'R') f.set(x1, t, 'd');
      if (f.get(x2, t) !== '.' && f.get(x2, t) !== 'r' && f.get(x2, t) !== 'R') f.set(x2, t, 'b');
    }
  }
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 水立方, the Water Cube, 64×40: a blue box of bubbles. */
export function waterCube(): Grid {
  const g = new Grid(64, 40);
  g.oval(2, 34, 62, 6, '_');
  const f = new Grid(64, 40);
  f.rect(2, 4, 60, 32, 'n').rect(2, 4, 60, 3, 'l');
  const bubbles: Array<[number, number, number]> = [[6, 10, 6], [16, 8, 8], [28, 12, 5], [38, 9, 7], [50, 11, 6], [9, 22, 7], [21, 20, 6], [33, 24, 8], [46, 21, 7], [56, 26, 4], [14, 30, 4], [40, 31, 3]];
  for (const [x, y, r] of bubbles) f.oval(x, y, r, r, 'X').set(x + 1, y + 1, 'w');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 貔貅, the golden beast that keeps wealth, on a pedestal, 16×32. */
export function pixiu(): Grid {
  const g = new Grid(16, 32);
  g.oval(1, 28, 15, 4, '_');
  const f = new Grid(16, 32);
  f.rect(1, 24, 14, 6, 'q').hline(1, 24, 14, 'R');
  f.rect(3, 15, 10, 9, 'y').vline(3, 15, 9, 'j').vline(12, 15, 9, 'Y');
  f.rect(3, 20, 2, 4, 'Y').rect(10, 20, 2, 4, 'Y');
  f.oval(2, 6, 12, 10, 'y').oval(3, 7, 6, 5, 'j');
  f.set(5, 3, 'Y').set(6, 4, 'Y').set(10, 3, 'Y').set(9, 4, 'Y');
  f.set(5, 10, 'k').set(10, 10, 'k').hline(5, 13, 6, 'o').set(7, 14, 'r');
  f.set(13, 16, 'Y').set(14, 15, 'Y').set(15, 14, 'j');
  f.outline('k');
  return g.stamp(f, 0, 0);
}


// ---------------------------------------------------------------- H5: 潘家园

/** A flea-market stall, 32×16: a cloth on the ground covered with vases, coins, pots and old books. */
export function stall(seed: number): Grid {
  const g = new Grid(32, 16);
  g.oval(0, 12, 32, 4, '_');
  const f = new Grid(32, 16);
  f.rect(1, 8, 30, 6, seed % 2 ? 'B' : 'q').hline(1, 8, 30, seed % 2 ? 'n' : 'R');
  const goods: Array<[number, (x: number) => void]> = [
    [3, (x) => f.oval(x, 2, 5, 7, 'l').rect(x + 1, 1, 3, 2, 'l').set(x + 1, 4, 'n').set(x + 3, 5, 'n')],
    [10, (x) => f.oval(x, 6, 4, 3, 'Y').oval(x + 3, 7, 3, 2, 'y')],
    [15, (x) => f.oval(x, 3, 6, 6, 'M').hline(x + 1, 3, 4, 'z').set(x + 2, 5, 'y')],
    [23, (x) => f.rect(x, 5, 6, 4, 'r').hline(x, 5, 6, 'p').vline(x + 3, 5, 4, 'y')],
  ];
  for (const [x, draw] of goods) draw(x + (seed % 3) - 1);
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** The little clay 年兽 on a stall, 16×16: a horned beast, green and red; `awake` its eyes open. */
export function nianshou(awake: boolean): Grid {
  const g = new Grid(16, 16);
  g.oval(2, 13, 12, 3, '_');
  const f = new Grid(16, 16);
  f.rect(3, 8, 10, 5, 'h').vline(3, 8, 5, 'i').rect(3, 12, 2, 2, 'G').rect(11, 12, 2, 2, 'G');
  f.oval(4, 2, 9, 8, 'h').oval(5, 3, 5, 4, 'i');
  f.set(5, 1, 'y').set(4, 0, 'y').set(11, 1, 'y').set(12, 0, 'y');
  f.set(6, 5, awake ? 'L' : 'G').set(10, 5, awake ? 'L' : 'G').hline(6, 8, 5, 'r').set(7, 9, 'w').set(9, 9, 'w');
  f.rect(12, 9, 3, 2, 'r');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

export const PROPS: Array<[string, string, () => Array<[string, Grid]>]> = [
  ['lantern', 'a red lantern: unlit and two lit frames that flicker, and broken', () => [['unlit', lantern(0)], ['lit-0', lantern(1)], ['lit-1', lantern(2)], ['broken', brokenLantern()]]],
  ['tree', 'the 槐树 pagoda tree of the hutongs', () => [['huai', tree()]]],
  ['bicycle', 'a parked city bicycle', () => [['side', bicycle()], ['side-r', bicycle().mirror()]]],
  ['tricycle', 'a 三轮车 pedal tricycle', () => [['side', tricycle()], ['side-r', tricycle().mirror()]]],
  ['subway-sign', 'a subway entrance sign', () => [['post', subwaySign()]]],
  ['bird-cage', "an old man's bird cage", () => [['cage', birdCage()]]],
  ['table', 'a square wooden table', () => [['wood', table()]]],
  ['stool', 'a little red stool', () => [['red', stool()]]],
  ['bed', 'a bed with a flowered quilt', () => [['quilt', bed()]]],
  ['steamer', 'bamboo steamers of 包子 on a stove', () => [['steam-0', steamer(0)], ['steam-1', steamer(1)]]],
  ['wok', 'a wok of oil for 油条', () => [['oil', wok()]]],
  ['tea-table', 'a low tea table with a pot and cups', () => [['pot', teaTable()]]],
  ['barber-chair', "a barber's chair", () => [['red', barberChair()]]],
  ['ticket-machine', "the station's ticket machine", () => [['blue', ticketMachine()]]],
  ['plant', 'a potted plant', () => [['green', plant()]]],
  ['street-sign', 'a small blue street sign on a post', () => [['blue', streetSign()]]],
  ['lion', 'a stone guardian lion on its plinth, asleep and awake', () => [['stone', stoneLion(false)], ['awake', stoneLion(true)]]],
  ['willow', 'a weeping willow by the water', () => [['green', willow()]]],
  ['boat', 'a small rowing boat on the lake', () => [['red', boat()]]],
  ['pavilion', 'the pavilion on top of 景山', () => [['wanchun', pavilion()]]],
  ['corner-tower', 'the palace corner tower 角楼', () => [['jiaolou', cornerTower()]]],
  ['pagoda', 'the White Dagoba of 北海', () => [['white', whitePagoda()]]],
  ['fox', 'the nine-tailed fox 九尾狐', () => [['sway-0', fox(0)], ['sway-1', fox(1)]]],
  ['tower', 'the Drum and Bell Towers on their terraces, and 前门', () => [['drum', tower('drum')], ['bell', tower('bell')], ['arrow', tower('arrow')]]],
  ['qiniandian', 'the Hall of Prayer for Good Harvests at 天坛', () => [['hall', qiniandian()]]],
  ['qilin', 'a bronze 麒麟, asleep and awake', () => [['bronze', qilin(false)], ['awake', qilin(true)]]],
  ['archway', 'a 牌楼 memorial archway', () => [['green', archway()]]],
  ['birds-nest', 'the National Stadium 鸟巢', () => [['stadium', birdsNest()]]],
  ['water-cube', 'the Water Cube 水立方', () => [['blue', waterCube()]]],
  ['pixiu', 'a golden 貔貅', () => [['gold', pixiu()]]],
  ['stall', 'a flea-market stall of antiques', () => [['a', stall(1)], ['b', stall(2)], ['c', stall(3)]]],
  ['nianshou', 'the little clay 年兽, asleep and awake', () => [['clay', nianshou(false)], ['awake', nianshou(true)]]],
  ['door-gods', 'an old gate with its door gods, faded and restored', () => [['faded', doorGods(true)], ['bright', doorGods(false)]]],
  ['pigeon', 'a pigeon of the hutongs', () => [['peck', pigeon('peck')], ['look', pigeon('look')], ['fly-0', pigeon('fly-0')], ['fly-1', pigeon('fly-1')]]],
];
