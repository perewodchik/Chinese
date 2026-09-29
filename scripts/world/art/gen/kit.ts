/**
 * The Beijing architecture kit (§13 V2): modules any building is assembled
 * from on a map, in the ¾ view with the roof's pitch visible — not flat
 * bands. Light from the top left, shadows fall down; ground and walls have
 * no outline, props do.
 *
 * Roofs come in the four glazes of the real hierarchy (the rank is itself a
 * lesson, book 《故宫》):
 *   grey 筒瓦 — houses, with gable ends (硬山);
 *   green 琉璃 — princes' halls and temples, hip ends (歇山/庑殿);
 *   yellow 琉璃 — the emperor only, hip ends with 脊兽 ridge beasts;
 *   blue 琉璃 — heaven: the 祈年殿.
 * Each glaze has twelve tiles: the ridge row, the upper slope (steeper, its
 * tile courses closer), the lower slope, the eave with its round tile ends —
 * each plain, left end and right end. A 重檐 double roof is two roofs with a
 * painted face row between them.
 *
 * Faces: 彩画 beams (旋子 blue-green for temples and halls, 苏式 with a
 * little picture for the Long Corridor), red walls, lattice doors, pillars,
 * a palace door's 门钉, a carved 丹陛 ramp. The top rows of a face are in the
 * eave's shadow.
 *
 * North–south streets: a hutong wall and a house roof seen from the street
 * running north–south (the coping, the lit or shaded face, the eave along
 * the street), so 南锣鼓巷, 王府井 and 前门大街 can run the way they really do.
 */

import { Grid } from './grid';

const T = 16;
const tile = (fill = '.') => new Grid(T, T, fill);

export type Glaze = 'grey' | 'green' | 'yellow' | 'blue';
export const GLAZES: readonly Glaze[] = ['grey', 'green', 'yellow', 'blue'];

interface Tones {
  hi: string;
  lt: string;
  mid: string;
  dk: string;
  deep: string;
}
const TONES: Record<Glaze, Tones> = {
  grey: { hi: 'e', lt: 'd', mid: 'c', dk: 'b', deep: 'a' },
  green: { hi: 'i', lt: 'i', mid: 'h', dk: 'G', deep: 'g' },
  yellow: { hi: 'j', lt: 'j', mid: 'y', dk: 'Y', deep: 'o' },
  blue: { hi: 'l', lt: 'X', mid: 'n', dk: 'B', deep: 'u' },
};
/** hip ends (歇山/庑殿) for the glazed ranks; grey houses have gable ends (硬山) */
const HIP: Record<Glaze, boolean> = { grey: false, green: true, yellow: true, blue: true };

// ---------------------------------------------------------------- roof rows

/**
 * Rolled tiles 筒瓦 in columns four pixels wide (a lit edge, the body, a
 * shaded edge), cut into courses every `course` pixels. The upper slope is
 * steeper, so its courses sit closer and it is a shade darker.
 */
function tiles(t: Tones, course: number, upper: boolean): Grid {
  const g = tile(upper ? t.dk : t.mid);
  for (let x = 0; x < T; x += 4) {
    g.vline(x, 0, T, upper ? t.mid : t.lt)
      .vline(x + 1, 0, T, upper ? t.dk : t.mid)
      .vline(x + 2, 0, T, upper ? t.dk : t.mid)
      .vline(x + 3, 0, T, t.deep);
    for (let y = course - 1; y < T; y += course) g.hline(x, y, 3, upper ? t.deep : t.dk);
  }
  return g;
}

/** The ridge 正脊: sky above, a heavy beam of tiles with a lit top edge, the upper slope below. */
function ridge(t: Tones): Grid {
  const g = tiles(t, 3, true);
  g.rect(0, 0, T, 5, '.');
  g.rect(0, 5, T, 6, t.deep).hline(0, 5, T, t.hi).hline(0, 6, T, t.lt).hline(0, 7, T, t.mid);
  for (let x = 2; x < T; x += 5) g.set(x, 8, t.dk);
  g.hline(0, 10, T, 'k');
  return g;
}

/** The eave 檐: the last course curls up into round tile ends 瓦当, then the overhang's dark edge. */
function eave(t: Tones): Grid {
  const g = tiles(t, 5, false);
  g.rect(0, 9, T, 7, '.');
  for (let x = 0; x < T; x += 4) g.oval(x, 7, 4, 4, t.mid).set(x + 1, 8, t.hi).set(x + 2, 10, t.deep);
  g.hline(0, 11, T, t.deep).hline(0, 12, T, 'k');
  g.rect(0, 13, T, 3, '.');
  return g;
}

/**
 * The left end of a row: a hip roof's ridge ends in a 正吻 curl, its slope
 * is cut by the hip ridge 垂脊 running down and out (the yellow one carries
 * its little 脊兽 beasts), its eave flares up at the corner 翼角; a house's
 * gable end 硬山 is a straight band of brick with the roof tiles stopping at
 * it. The right end is the mirror.
 */
function leftEnd(t: Tones, hip: boolean, row: 'ridge' | 'up' | 'slope' | 'eave', beasts: boolean): Grid {
  const base = row === 'ridge' ? ridge(t) : row === 'up' ? tiles(t, 3, true) : row === 'slope' ? tiles(t, 5, false) : eave(t);
  if (!hip) {
    // 硬山: the gable's brick band, its tiled edge 披水 on top
    const edge = row === 'ridge' ? 5 : 0;
    const bottom = row === 'eave' ? 13 : T;
    base.rect(0, edge, 4, bottom - edge, 'c').vline(0, edge, bottom - edge, 'd').vline(3, edge, bottom - edge, 'b');
    for (let y = edge + 2; y < bottom; y += 4) base.hline(0, y, 3, 'b');
    if (row === 'ridge') {
      // 蝎子尾: the ridge's end curls up a little
      base.rect(0, 2, 3, 3, t.deep).set(0, 1, t.deep).set(1, 2, t.hi).set(0, 2, t.lt);
    }
    if (row === 'eave') base.rect(0, 11, 4, 2, 'k');
    return base;
  }
  // the hip ridge falls from the ridge's end (x≈6 at the top of the ridge row) to the corner (x=0 at the eave)
  const top = { ridge: 6, up: 5, slope: 3, eave: 1 }[row];
  const bot = { ridge: 5, up: 3, slope: 1, eave: 0 }[row];
  const lineAt = (y: number) => Math.round(top + ((bot - top) * y) / (T - 1));
  const from = row === 'ridge' ? 5 : 0;
  const to = row === 'eave' ? 12 : T;
  for (let y = from; y < to; y++) {
    const x = lineAt(y);
    for (let i = 0; i < x; i++) base.set(i, y, '.');
    base.set(x, y, t.hi);
    base.set(x + 1, y, t.deep);
    if (x + 2 < T) base.set(x + 2, y, t.dk);
  }
  if (row === 'ridge') {
    // 正吻: the dragon-mouth ornament rising at the ridge's end
    base.rect(5, 1, 5, 9, t.deep).rect(6, 0, 3, 2, t.dk).set(9, 2, t.deep).set(10, 3, t.deep);
    base.vline(6, 2, 7, t.mid).set(7, 3, t.hi).set(7, 4, 'k').rect(8, 6, 2, 2, t.lt);
  }
  if (row === 'up' && beasts) {
    // 脊兽: the little procession of beasts down the hip ridge (太和殿 has ten — the most of any)
    for (let y = 2; y < T; y += 4) {
      const x = lineAt(y);
      base.set(x, y - 1, t.deep).set(x + 1, y - 2, t.deep).set(x + 1, y - 1, t.lt);
    }
  }
  if (row === 'eave') {
    // 翼角: the corner flies up, with a small bell
    base.rect(0, 0, 3, 3, t.deep).set(0, 0, t.hi).set(1, 1, t.lt);
    base.set(1, 4, 'Y').set(1, 5, 'o');
  }
  return base;
}

/** The twelve roof tiles of a glaze: `roof-<glaze>-{ridge,up,slope,eave}[-l|-r]`. */
export function roofKit(glaze: Glaze): Array<[string, () => Grid]> {
  const t = TONES[glaze];
  const hip = HIP[glaze];
  const beasts = glaze === 'yellow';
  const rows = [
    ['ridge', () => ridge(t)],
    ['up', () => tiles(t, 3, true)],
    ['slope', () => tiles(t, 5, false)],
    ['eave', () => eave(t)],
  ] as const;
  const out: Array<[string, () => Grid]> = [];
  for (const [row, plain] of rows) {
    out.push([`roof-${glaze}-${row}`, plain]);
    out.push([`roof-${glaze}-${row}-l`, () => leftEnd(t, hip, row, beasts)]);
    out.push([`roof-${glaze}-${row}-r`, () => leftEnd(t, hip, row, beasts).mirror()]);
  }
  return out;
}

// ---------------------------------------------------------------- faces under the eaves

/** The eave's shadow across the top of any face: the building is lit, its face under the roof is not. */
function shade(g: Grid, rows = 3): Grid {
  return g.where((_x, y) => y < rows, (_x, y, cur) => (y === 0 ? 'k' : cur === '.' ? cur : darker(cur)));
}
const DARKER: Record<string, string> = {
  r: 'R', R: 'q', p: 'r', v: 'u', x: 'v', Y: 'o', y: 'Y', j: 'y', w: 'e', e: 'd', d: 'c', c: 'b', b: 'a', h: 'G', G: 'g', i: 'h', n: 'B', l: 'n', z: 'M', M: 'm', o: 'm',
};
const darker = (c: string) => DARKER[c] ?? c;

/** 旋子彩画: the blue-green painted beam of temples and halls — gold lines, white-edged rosettes. */
export function beamXuanzi(): Grid {
  const g = tile('v');
  g.rect(0, 3, T, 3, 'u').hline(0, 6, T, 'Y').rect(0, 7, T, 6, 'v').hline(0, 13, T, 'Y').rect(0, 14, T, 2, 'R');
  for (const x of [1, 9]) {
    g.oval(x, 7, 6, 6, 'x').oval(x + 1, 8, 4, 4, 'u').set(x + 2, 9, 'w').set(x + 3, 10, 'Y');
  }
  g.vline(8, 7, 6, 'Y');
  return shade(g);
}

/** 苏式彩画: the Long Corridor's beams — a white-framed little picture (a landscape) in the middle of the blue. */
export function beamSu(): Grid {
  const g = beamXuanzi();
  g.rect(2, 7, 12, 6, 'w').rect(3, 8, 10, 4, 'x');
  g.hline(3, 11, 10, 'h').set(5, 10, 'G').set(6, 9, 'G').set(7, 10, 'G').set(10, 9, 'c').set(11, 10, 'c').set(12, 8, 'r');
  return g;
}

/** A red wall under the eaves. */
export function faceRed(): Grid {
  const g = tile('r');
  g.set(3, 7, 'R').set(11, 12, 'R').set(7, 4, 'p');
  return shade(g);
}

/** 隔扇: red lattice doors — a grid of gold-brown bars over paper, a solid panel below. */
export function faceLattice(): Grid {
  const g = tile('r');
  g.rect(1, 1, 14, 9, 'e');
  for (let x = 1; x < 15; x += 3) g.vline(x, 1, 9, 'o');
  for (let y = 1; y < 10; y += 3) g.hline(1, y, 14, 'o');
  g.rect(1, 11, 14, 4, 'R').rect(3, 12, 10, 2, 'r').vline(8, 0, T, 'q');
  g.vline(0, 0, T, 'q').vline(15, 0, T, 'q');
  return shade(g);
}

/** A red pillar 柱 standing before a dark wall, on its stone base. */
export function facePillar(): Grid {
  const g = tile('q');
  g.rect(5, 0, 6, 13, 'r').vline(5, 0, 13, 'p').vline(10, 0, 13, 'R');
  g.rect(4, 13, 8, 3, 'e').hline(4, 13, 8, 'w').hline(4, 15, 8, 'd');
  return shade(g);
}

/**
 * A palace door's leaf with 门钉, the golden studs. Real palace doors carry
 * nine rows of nine (东华门 nine rows of eight); a tile shows five rows of
 * four, the pattern the book explains. Two tiles side by side make a door.
 */
export function faceStuds(): Grid {
  const g = tile('r');
  for (let y = 2; y < T; y += 3) for (let x = 2; x < T; x += 4) g.set(x, y, 'y').set(x + 1, y, 'Y');
  g.vline(15, 0, T, 'q').vline(0, 0, T, 'R');
  g.oval(12, 7, 3, 3, 'Y').set(13, 8, 'o');
  return shade(g);
}

/** 丹陛: the carved marble ramp between two flights of steps — clouds and a dragon, only for the emperor's sedan. */
export function danbi(): Grid {
  const g = tile('e');
  g.vline(0, 0, T, 'd').vline(15, 0, T, 'c');
  const cloud = (x: number, y: number) => g.set(x, y, 'd').set(x + 1, y - 1, 'd').set(x + 2, y, 'd').set(x + 1, y + 1, 'c');
  cloud(3, 3);
  cloud(10, 6);
  cloud(4, 12);
  // the dragon's back winding down the ramp
  for (let y = 1; y < 15; y++) g.set(7 + Math.round(Math.sin(y / 2.2) * 3), y, y % 3 ? 'c' : 'b');
  return g;
}

// ---------------------------------------------------------------- north–south streets

/**
 * A hutong wall along a street running north–south, seen from above: its
 * tiled coping, and its face towards the street — on the west side of the
 * street that face looks east, into the shade; on the east side it looks
 * west, into the light (light from the left).
 */
export function sideWall(side: 'w' | 'e'): Grid {
  const g = tile('c');
  // coping courses run across (the ridge of the coping runs north–south)
  const cope = (x0: number, x1: number) => {
    g.rect(x0, 0, x1 - x0, T, 'b');
    for (let y = 0; y < T; y += 4) g.hline(x0, y, x1 - x0, 'd').hline(x0, y + 1, x1 - x0, 'c').hline(x0, y + 3, x1 - x0, 'a');
  };
  if (side === 'w') {
    cope(0, 9);
    g.vline(9, 0, T, 'k');
    g.rect(10, 0, 6, T, 'b');
    for (let y = 2; y < T; y += 4) g.hline(10, y, 6, 'a');
    g.vline(15, 0, T, 'a');
  } else {
    g.rect(0, 0, 6, T, 'd');
    for (let y = 2; y < T; y += 4) g.hline(0, y, 6, 'c');
    g.vline(0, 0, T, 'e');
    g.vline(6, 0, T, 'k');
    cope(7, T);
  }
  return g;
}

/**
 * A house roof along a north–south street: its ridge runs north–south, so
 * the rolled tiles run across. `ridge` is the ridge beam down the middle;
 * `eave-w`/`eave-e` the edge along the street on a house to its west/east.
 */
export function sideRoof(part: 'plain' | 'ridge' | 'eave-w' | 'eave-e'): Grid {
  const t = TONES.grey;
  const g = tile(t.mid);
  for (let y = 0; y < T; y += 4) {
    g.hline(0, y, T, t.lt).hline(0, y + 1, T, t.mid).hline(0, y + 2, T, t.mid).hline(0, y + 3, T, t.deep);
    for (let x = 4; x < T; x += 5) g.vline(x, y, 3, t.dk);
  }
  if (part === 'ridge') {
    g.rect(5, 0, 6, T, t.deep).vline(5, 0, T, t.hi).vline(6, 0, T, t.lt).vline(10, 0, T, 'k');
  }
  if (part === 'eave-w') {
    // the street is to the east: round tile ends down the right edge, then the drop
    for (let y = 0; y < T; y += 4) g.oval(10, y, 4, 4, t.mid).set(11, y + 1, t.hi);
    g.vline(14, 0, T, 'k').vline(15, 0, T, '.');
  }
  if (part === 'eave-e') {
    for (let y = 0; y < T; y += 4) g.oval(2, y, 4, 4, t.mid).set(3, y + 1, t.hi);
    g.vline(1, 0, T, 'k').vline(0, 0, T, '.');
  }
  return g;
}

/** All the kit's tiles, for `tiles/kit.px`. */
export const KIT_TILES: Array<[string, () => Grid]> = [
  ...GLAZES.flatMap((g) => roofKit(g)),
  ['beam-xuanzi', beamXuanzi],
  ['beam-su', beamSu],
  ['face-red', faceRed],
  ['face-lattice', faceLattice],
  ['face-pillar', facePillar],
  ['face-studs', faceStuds],
  ['face-studs-r', () => faceStuds().mirror()],
  ['danbi', danbi],
  ['side-wall-w', () => sideWall('w')],
  ['side-wall-e', () => sideWall('e')],
  ['side-roof', () => sideRoof('plain')],
  ['side-roof-ridge', () => sideRoof('ridge')],
  ['side-roof-eave-w', () => sideRoof('eave-w')],
  ['side-roof-eave-e', () => sideRoof('eave-e')],
];
