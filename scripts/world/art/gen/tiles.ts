/**
 * Beijing's building blocks, 16×16, ¾ top-down (prompt §9, concept §12):
 * hutong paving, grey brick and its tiled coping, the red door with its
 * drum stones, grey and yellow roofs with painted eaves, the red palace
 * wall, columns, steps, windows. Ground and walls have no outline; light
 * comes from the top left, shadows fall down-right.
 */

import { Grid, rng } from './grid';

const T = 16;
const tile = (fill: string) => new Grid(T, T, fill);

// ---------------------------------------------------------------- ground

/** Hutong paving: grey-beige bricks laid in courses of four. */
export function paving(seed = 1): Grid {
  const g = tile('F');
  const r = rng(seed);
  for (let y = 0; y < T; y += 4) {
    g.hline(0, y + 3, T, 'P');
    const off = (y / 4) % 2 ? 4 : 0;
    for (let x = off; x < T + 8; x += 8) {
      g.vline((x + 7) % T, y, 3, 'P');
      g.hline(x % T, y, 3, 'f');
    }
  }
  for (let i = 0; i < 5; i++) g.set(Math.floor(r() * T), Math.floor(r() * T), r() < 0.5 ? 'P' : 'f');
  return g;
}

export function grass(seed = 2): Grid {
  const g = tile('h');
  const r = rng(seed);
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(r() * T);
    const y = Math.floor(r() * (T - 1));
    g.set(x, y, 'i').set(x, y + 1, 'G');
  }
  for (let i = 0; i < 4; i++) g.set(Math.floor(r() * T), Math.floor(r() * T), 'G');
  return g;
}

/** Tiananmen Square's big pale stone slabs. */
export function plaza(): Grid {
  const g = tile('e');
  g.hline(0, 7, T, 'd').hline(0, 15, T, 'd').vline(7, 0, 7, 'd').vline(15, 8, 7, 'd');
  g.hline(0, 0, 7, 'w').hline(8, 8, 7, 'w');
  return g;
}

export function road(seed = 3, line = false): Grid {
  const g = tile('b');
  const r = rng(seed);
  for (let i = 0; i < 14; i++) g.set(Math.floor(r() * T), Math.floor(r() * T), r() < 0.6 ? 'a' : 'c');
  if (line) g.rect(2, 7, 5, 2, 'w').rect(10, 7, 5, 2, 'w');
  return g;
}

export function water(frame: number): Grid {
  const g = tile('W');
  const waves = [
    [2, 3], [9, 6], [4, 11], [12, 13],
  ];
  for (const [x, y] of waves) {
    const dx = frame ? 1 : 0;
    g.hline(x! + dx, y!, 3, 'X').set(x! + dx + 3, y! - 1, 'X');
  }
  g.hline(0, 0, T, 'X');
  return g;
}

export function floorWood(): Grid {
  const g = tile('z');
  for (let y = 0; y < T; y += 4) {
    g.hline(0, y + 3, T, 'M');
    const off = (y / 4) % 2 ? 5 : 11;
    g.vline(off, y, 3, 'M');
    g.hline(0, y, T, 'f');
  }
  return g;
}

export function floorTile(): Grid {
  const g = tile('d');
  g.hline(0, 7, T, 'c').hline(0, 15, T, 'c').vline(7, 0, T, 'c').vline(15, 0, T, 'c');
  g.hline(0, 0, 7, 'e').hline(8, 0, 7, 'e').hline(0, 8, 7, 'e').hline(8, 8, 7, 'e');
  return g;
}

// ---------------------------------------------------------------- hutong walls

/** Grey brick, the face of every hutong wall. */
export function brick(): Grid {
  const g = tile('c');
  for (let y = 0; y < T; y += 4) {
    g.hline(0, y + 3, T, 'b');
    const off = (y / 4) % 2 ? 4 : 0;
    for (let x = off; x < T + 8; x += 8) {
      g.vline((x + 7) % T, y, 3, 'b');
      g.hline(x % T, y, 6, 'd');
    }
  }
  return g;
}

/** The top of a wall: a ridge of grey roof tiles over a white-edged ledge. */
export function brickTop(): Grid {
  const g = brick();
  g.rect(0, 0, T, 7, 'a');
  for (let x = 0; x < T; x += 4) g.rect(x, 1, 2, 5, 'b').set(x, 1, 'c');
  g.hline(0, 0, T, 'c').hline(0, 6, T, 'k').hline(0, 7, T, 'e').hline(0, 8, T, 'd');
  return g;
}

/** The foot of a wall, darker stone and a line of shadow on the ground. */
export function brickBase(): Grid {
  const g = brick();
  g.rect(0, 12, T, 4, 'b').hline(0, 12, T, 'd').hline(0, 15, T, 'a');
  return g;
}

/**
 * The red gate of a courtyard, two tiles tall (`door-top`, `door-bottom`):
 * a dark lintel with painted door-pins, red leaves with brass knockers, and
 * the 门墩 drum stones either side at the foot.
 */
export function doorTop(): Grid {
  const g = tile('q');
  g.rect(0, 0, T, 4, 'a').hline(0, 0, T, 'b').hline(0, 3, T, 'k');
  // 门簪, the painted pins over the door
  for (const x of [3, 7, 11]) g.rect(x, 1, 2, 2, 'v').set(x, 1, 'x');
  g.rect(1, 4, 14, 12, 'r').vline(7, 4, 12, 'q').vline(8, 4, 12, 'R');
  g.vline(1, 4, 12, 'R').vline(14, 4, 12, 'R');
  // brass studs
  for (let y = 6; y < 16; y += 3) for (const x of [3, 5, 10, 12]) g.set(x, y, 'Y');
  return g;
}

export function doorBottom(): Grid {
  const g = tile('q');
  g.rect(1, 0, 14, 12, 'r').vline(7, 0, 12, 'q').vline(8, 0, 12, 'R');
  g.vline(1, 0, 12, 'R').vline(14, 0, 12, 'R');
  for (let y = 1; y < 12; y += 3) for (const x of [3, 5, 10, 12]) g.set(x, y, 'Y');
  // knockers
  g.oval(5, 2, 3, 3, 'y').set(6, 3, 'r').oval(9, 2, 3, 3, 'y').set(10, 3, 'r');
  // threshold and drum stones
  g.rect(0, 12, T, 4, 'd').hline(0, 12, T, 'e').hline(0, 15, T, 'c');
  g.oval(0, 9, 4, 6, 'e').vline(3, 10, 4, 'c').oval(12, 9, 4, 6, 'e').vline(15, 10, 4, 'c');
  g.set(1, 10, 'w').set(13, 10, 'w');
  return g;
}

// ---------------------------------------------------------------- roofs

type RoofKind = 'grey' | 'yellow';
const ROOF: Record<RoofKind, { light: string; mid: string; dark: string; deep: string }> = {
  grey: { light: 'd', mid: 'c', dark: 'b', deep: 'a' },
  yellow: { light: 'j', mid: 'y', dark: 'Y', deep: 'o' },
};

/** Roof slope: rows of rolled tiles running down, lit from the left. */
export function roof(kind: RoofKind): Grid {
  const c = ROOF[kind];
  const g = tile(c.dark);
  for (let x = 0; x < T; x += 4) {
    g.vline(x, 0, T, c.light).vline(x + 1, 0, T, c.mid).vline(x + 2, 0, T, c.mid).vline(x + 3, 0, T, c.deep);
    for (let y = 3; y < T; y += 5) g.hline(x, y, 3, c.dark);
  }
  return g;
}

/** Roof ridge: the heavy top beam of tiles. */
export function roofRidge(kind: RoofKind): Grid {
  const c = ROOF[kind];
  const g = roof(kind);
  g.rect(0, 0, T, 6, c.deep).hline(0, 1, T, c.dark).hline(0, 2, T, c.mid).hline(0, 3, T, c.dark);
  for (let x = 1; x < T; x += 4) g.set(x, 2, c.light);
  g.hline(0, 6, T, 'k');
  return g;
}

/** Roof edge: the round tile ends, then the painted beam of the eaves below. */
export function roofEave(kind: RoofKind): Grid {
  const c = ROOF[kind];
  const g = roof(kind);
  g.rect(0, 6, T, 10, 'u');
  for (let x = 0; x < T; x += 4) g.oval(x, 4, 4, 4, c.mid).set(x + 1, 5, c.light);
  g.hline(0, 8, T, 'k');
  // 彩画: the green-blue painted beam with a gold line and a white pattern
  g.hline(0, 9, T, 'Y').rect(0, 10, T, 4, 'v').hline(0, 14, T, 'u').hline(0, 15, T, 'k');
  for (let x = 1; x < T; x += 5) g.rect(x, 11, 3, 2, 'x').set(x + 1, 11, 'w');
  return g;
}

// ---------------------------------------------------------------- the palace

export function palaceWall(): Grid {
  const g = tile('r');
  for (let x = 1; x < T; x += 5) g.vline(x, 0, T, 'p');
  g.vline(15, 0, T, 'R');
  const r = rng(7);
  for (let i = 0; i < 6; i++) g.set(Math.floor(r() * T), Math.floor(r() * T), 'R');
  return g;
}

export function palaceTop(): Grid {
  const g = palaceWall();
  g.rect(0, 0, T, 8, 'Y');
  for (let x = 0; x < T; x += 4) g.rect(x, 1, 2, 5, 'y').set(x, 1, 'j');
  g.hline(0, 0, T, 'j').hline(0, 6, T, 'o').hline(0, 7, T, 'k').hline(0, 8, T, 'q');
  return g;
}

export function palaceBase(): Grid {
  const g = palaceWall();
  g.rect(0, 11, T, 5, 'd').hline(0, 11, T, 'e').hline(0, 15, T, 'c').vline(7, 12, 3, 'c');
  return g;
}

export function column(): Grid {
  const g = new Grid(T, T);
  g.rect(5, 0, 6, 13, 'r').vline(5, 0, 13, 'p').vline(10, 0, 13, 'R').vline(11, 0, 13, 'q');
  g.rect(3, 13, 10, 3, 'd').hline(3, 13, 10, 'e').hline(3, 15, 10, 'c');
  return g;
}

export function steps(): Grid {
  const g = tile('d');
  for (let y = 0; y < T; y += 4) g.hline(0, y, T, 'e').hline(0, y + 3, T, 'b');
  return g;
}

/** A courtyard window: wooden lattice over paper; `lit` glows warm at night. */
export function lattice(lit: boolean): Grid {
  const g = tile('M');
  g.rect(1, 1, 14, 14, lit ? 'Q' : 'e');
  for (let x = 1; x < 15; x += 3) g.vline(x, 1, 14, 'M');
  for (let y = 1; y < 15; y += 3) g.hline(1, y, 14, 'M');
  g.rect(0, 0, T, 1, 'm').rect(0, 15, T, 1, 'm').vline(0, 0, T, 'm').vline(15, 0, T, 'm');
  if (lit) g.rect(5, 5, 6, 6, 'L').rect(6, 6, 4, 4, 'Q');
  return g;
}

export function shopFront(lit: boolean): Grid {
  const g = tile('M');
  g.rect(1, 2, 14, 13, lit ? 'Q' : 'l').vline(8, 2, 13, 'M');
  g.hline(0, 0, T, 'r').hline(0, 1, T, 'R');
  if (!lit) g.set(3, 4, 'w').set(4, 5, 'w').set(11, 4, 'w');
  return g;
}

export const TILES: Array<[string, () => Grid]> = [
  ['paving', () => paving(1)],
  ['paving-2', () => paving(9)],
  ['grass', () => grass(2)],
  ['grass-2', () => grass(5)],
  ['plaza', plaza],
  ['road', () => road(3)],
  ['road-line', () => road(4, true)],
  ['water-0', () => water(0)],
  ['water-1', () => water(1)],
  ['floor-wood', floorWood],
  ['floor-tile', floorTile],
  ['brick', brick],
  ['brick-top', brickTop],
  ['brick-base', brickBase],
  ['door-top', doorTop],
  ['door-bottom', doorBottom],
  ['roof-grey', () => roof('grey')],
  ['roof-grey-ridge', () => roofRidge('grey')],
  ['roof-grey-eave', () => roofEave('grey')],
  ['roof-yellow', () => roof('yellow')],
  ['roof-yellow-ridge', () => roofRidge('yellow')],
  ['roof-yellow-eave', () => roofEave('yellow')],
  ['palace-wall', palaceWall],
  ['palace-top', palaceTop],
  ['palace-base', palaceBase],
  ['column', column],
  ['steps', steps],
  ['window', () => lattice(false)],
  ['window-lit', () => lattice(true)],
  ['shop', () => shopFront(false)],
  ['shop-lit', () => shopFront(true)],
];
