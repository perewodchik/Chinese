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

/** The red of palace walls: flat plaster, a little worn, no pattern to repeat. */
export function palaceWall(): Grid {
  const g = tile('r');
  const r = rng(7);
  for (let i = 0; i < 10; i++) g.set(Math.floor(r() * T), Math.floor(r() * T), r() < 0.7 ? 'R' : 'p');
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

/** The top of a gateway through the red wall: the wall with a round arch cut in it. */
export function archTop(): Grid {
  const g = palaceWall();
  g.hline(0, 0, T, 'R');
  g.oval(2, 4, 12, 24, 'k');
  g.oval(3, 5, 10, 22, 'a');
  g.vline(3, 10, 6, 'b');
  return g;
}

/** A gateway's opening: dark passage, lit a little at the far end. */
export function arch(): Grid {
  const g = palaceWall();
  g.rect(2, 0, 12, T, 'k').rect(3, 0, 10, T, 'a').vline(3, 0, T, 'b');
  g.rect(3, 12, 10, 4, 'b').hline(3, 12, 10, 'c');
  return g;
}

/** White marble balustrade, the railings of terraces and bridges. */
export function marbleRail(): Grid {
  const g = new Grid(T, T);
  g.rect(0, 5, T, 2, 'w').rect(0, 7, T, 1, 'd').rect(0, 11, T, 3, 'e').hline(0, 11, T, 'w').hline(0, 13, T, 'd');
  for (const x of [0, 8]) g.rect(x + 1, 2, 3, 12, 'e').vline(x + 1, 2, 12, 'w').vline(x + 3, 2, 12, 'd').hline(x + 1, 1, 3, 'w');
  for (let x = 5; x < T; x += 8) g.rect(x, 8, 2, 3, 'e').set(x, 8, 'w');
  g.outline('c');
  return g;
}

/** White marble paving of terraces and bridges. */
export function marble(): Grid {
  const g = tile('e');
  g.hline(0, 7, T, 'd').vline(3, 0, 7, 'd').vline(11, 8, 8, 'd').hline(0, 0, T, 'w').hline(0, 8, T, 'w');
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


// ---------------------------------------------------------------- indoors (F1)

/** A whitewashed inside wall, faintly uneven. */
export function plaster(): Grid {
  const g = tile('w');
  const r = rng(11);
  for (let i = 0; i < 9; i++) g.set(Math.floor(r() * T), Math.floor(r() * T), 'e');
  return g;
}

/** The foot of an inside wall: a wooden skirting board. */
export function plasterBase(): Grid {
  const g = plaster();
  g.rect(0, 11, T, 5, 'M').hline(0, 11, T, 'z').hline(0, 15, T, 'm');
  return g;
}

/** The top of an inside wall seen from above: a dark beam — also the side walls of a room. */
export function wallTop(): Grid {
  const g = tile('m');
  g.hline(0, 0, T, 'M').hline(0, 15, T, 'k');
  for (let x = 2; x < T; x += 6) g.vline(x, 2, 11, 'M');
  return g;
}

/** A doormat at a room's way out (walkable). */
export function exitMat(): Grid {
  const g = floorWood();
  g.rect(1, 3, 14, 11, 'R').rect(2, 4, 12, 9, 'r');
  for (let x = 3; x < 13; x += 3) g.vline(x, 5, 7, 'R');
  return g;
}

/** A wooden shop counter, front on. */
export function counter(): Grid {
  const g = tile('M');
  g.rect(0, 0, T, 5, 'z').hline(0, 0, T, 'f').hline(0, 4, T, 'm');
  g.rect(1, 6, 14, 9, 'M');
  for (let x = 0; x < T; x += 8) g.vline(x, 5, 11, 'm');
  g.hline(0, 15, T, 'm');
  return g;
}

/** Shop shelves full of packets, bottles and cans. */
export function shelf(): Grid {
  const g = tile('M');
  const goods = ['r', 'y', 'n', 'h', 'w', 'p', 'l', 'Y'];
  const r = rng(13);
  for (const y of [1, 6, 11]) {
    g.hline(0, y + 4, T, 'm');
    for (let x = 1; x < T - 1; x += 2) {
      const c = goods[Math.floor(r() * goods.length)]!;
      const hgt = 2 + Math.floor(r() * 2);
      g.rect(x, y + 4 - hgt, 2, hgt, c);
      g.set(x, y + 4 - hgt, 'w');
    }
  }
  g.vline(0, 0, T, 'm').vline(15, 0, T, 'm');
  return g;
}

/** A red menu board with rows of white writing (too small to read — the sign object holds the words). */
export function menuBoard(): Grid {
  const g = plaster();
  g.rect(1, 2, 14, 11, 'R').rect(2, 3, 12, 9, 'r');
  for (const y of [4, 7, 10]) g.hline(3, y, 5, 'w').hline(10, y, 3, 'j');
  return g;
}

/** A barber's mirror on the wall. */
export function mirror(): Grid {
  const g = plaster();
  g.rect(2, 1, 12, 12, 'M').rect(3, 2, 10, 10, 'l');
  g.set(4, 3, 'w').set(5, 3, 'w').set(4, 4, 'w').set(10, 9, 'X');
  g.hline(2, 13, 12, 'm');
  return g;
}

/** A subway station's white tiled wall. */
export function tileWall(): Grid {
  const g = tile('w');
  g.hline(0, 7, T, 'e').hline(0, 15, T, 'e').vline(0, 0, 7, 'e').vline(8, 8, 8, 'e');
  return g;
}

/** A tiled wall with the line's coloured band and a stripe of the station name. */
export function tileWallBand(): Grid {
  const g = tileWall();
  g.rect(0, 5, T, 4, 'n').hline(0, 5, T, 'l');
  return g;
}

/** The platform's edge: the yellow tactile strip before the tracks. */
export function platformEdge(): Grid {
  const g = floorTile();
  g.rect(0, 10, T, 4, 'y');
  for (let x = 1; x < T; x += 3) g.set(x, 11, 'Y').set(x + 1, 12, 'Y');
  g.rect(0, 14, T, 2, 'e');
  return g;
}

/** The tracks, down in the dark. */
export function track(): Grid {
  const g = tile('a');
  g.hline(0, 3, T, 'c').hline(0, 12, T, 'c');
  for (let x = 1; x < T; x += 5) g.rect(x, 1, 2, 14, 'm');
  g.hline(0, 3, T, 'd').hline(0, 12, T, 'd');
  return g;
}

/** A ticket gate: a grey cabinet with a blue reader and a green arrow. */
export function gate(): Grid {
  const g = floorTile();
  g.rect(3, 1, 10, 14, 'c').rect(4, 2, 8, 12, 'd').rect(5, 3, 6, 3, 'n').set(7, 4, 'l');
  g.rect(6, 8, 4, 3, 'h').set(7, 9, 'i');
  g.hline(3, 15, 10, 'b');
  return g;
}

/** Stairs going down into the station, seen from the street (walkable). */
export function stairsDown(): Grid {
  const g = tile('b');
  for (let y = 0; y < T; y += 3) g.hline(1, y, 14, 'd').hline(1, y + 1, 14, 'c');
  g.vline(0, 0, T, 'e').vline(15, 0, T, 'e');
  g.rect(0, 13, T, 3, 'a');
  return g;
}

/** A red rug, the teahouse's floor. */
export function rug(): Grid {
  const g = tile('r');
  g.rect(0, 0, T, 1, 'R').rect(0, 15, T, 1, 'R');
  for (let x = 2; x < T; x += 6) g.rect(x, 6, 3, 3, 'y').set(x + 1, 7, 'r');
  return g;
}

/** Cobbles of the square between the Drum and Bell Towers. */
export function squareStone(seed = 17): Grid {
  const g = tile('d');
  const r = rng(seed);
  for (let y = 0; y < T; y += 4) {
    const off = (y / 4) % 2 ? 2 : 0;
    for (let x = off; x < T; x += 4) g.rect(x, y, 3, 3, r() < 0.3 ? 'e' : 'd').set(x, y, 'e');
    g.hline(0, y + 3, T, 'c');
  }
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
  ['palace-arch-top', archTop],
  ['palace-arch', arch],
  ['marble-rail', marbleRail],
  ['marble', marble],
  ['column', column],
  ['steps', steps],
  ['window', () => lattice(false)],
  ['window-lit', () => lattice(true)],
  ['shop', () => shopFront(false)],
  ['shop-lit', () => shopFront(true)],
  ['plaster', plaster],
  ['plaster-base', plasterBase],
  ['wall-top', wallTop],
  ['exit-mat', exitMat],
  ['counter', counter],
  ['shelf', shelf],
  ['menu-board', menuBoard],
  ['mirror', mirror],
  ['tile-wall', tileWall],
  ['tile-wall-band', tileWallBand],
  ['platform-edge', platformEdge],
  ['track', track],
  ['gate', gate],
  ['stairs-down', stairsDown],
  ['rug', rug],
  ['square-stone', () => squareStone(17)],
];
