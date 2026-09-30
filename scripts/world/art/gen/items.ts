/**
 * The things in the bag, one 16×16 sprite each, framed like the props: the
 * inside drawn in the palette, then the dark outline around it. Plus the
 * menu's own icons (the five tabs, the bag's pockets, the wallet), in the
 * same hand. Frame names are item ids (`items/baozi`), so the bag finds a
 * picture by id alone.
 */

import { Grid } from './grid';

type Draw = (f: Grid) => void;

/** A sprite: `draw` the inside, outline it, then `cut` holes the outline must not close. */
function sprite(draw: Draw, cut?: Draw): Grid {
  const f = new Grid(16, 16);
  draw(f);
  f.outline('k');
  cut?.(f);
  return f;
}

/** Fill where |x-cx|+|y-cy| <= r (a diamond). */
function diamond(f: Grid, cx: number, cy: number, r: number, c: string) {
  return f.where((x, y) => Math.abs(x - cx) + Math.abs(y - cy) <= r, c);
}

/** A thick diagonal from (x0,y0) to (x1,y1). */
function stroke(f: Grid, x0: number, y0: number, x1: number, y1: number, c: string, w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    f.rect(x, y, w, w, c);
  }
  return f;
}

export const ITEM_SPRITES: Record<string, () => Grid> = {
  baozi: () =>
    sprite((f) => {
      f.oval(1, 5, 14, 9, 'w').hline(3, 11, 10, 'e').hline(4, 12, 8, 'e').set(2, 10, 'e').set(13, 10, 'e');
      f.oval(6, 3, 4, 3, 'w');
      f.set(7, 4, 'd').set(8, 4, 'd').set(6, 6, 'e').set(9, 6, 'e').set(5, 7, 'e').set(10, 7, 'e').set(7, 6, 'd').set(8, 6, 'd');
      f.set(4, 7, 'w').set(3, 8, 'w');
    }),
  doujiang: () =>
    sprite((f) => {
      f.rect(4, 4, 8, 10, 'w').vline(11, 4, 10, 'e').rect(4, 8, 8, 3, 'n').vline(11, 8, 3, 'B').hline(5, 9, 2, 'l');
      f.hline(4, 4, 8, 'f').hline(5, 3, 6, 'f');
      stroke(f, 9, 3, 11, 0, 'r');
    }),
  youtiao: () =>
    sprite((f) => {
      stroke(f, 2, 12, 11, 3, 'y', 2);
      stroke(f, 4, 13, 13, 4, 'Y', 2);
      for (let i = 0; i < 9; i += 2) f.set(3 + i, 11 - i, 'j');
      for (let i = 1; i < 9; i += 2) f.set(5 + i, 13 - i, 'o');
    }),
  water: () =>
    sprite((f) => {
      f.rect(5, 5, 6, 9, 'X').rect(6, 3, 4, 2, 'X').rect(6, 1, 4, 2, 'n');
      f.rect(5, 8, 6, 3, 'n').hline(6, 9, 2, 'l').vline(6, 5, 3, 'w').vline(6, 11, 2, 'w').vline(10, 5, 9, 'W');
    }),
  niunai: () =>
    sprite((f) => {
      f.rect(5, 5, 6, 9, 'w').rect(6, 3, 4, 2, 'w').rect(6, 1, 4, 2, 'n');
      f.rect(5, 8, 6, 3, 'n').hline(6, 9, 2, 'l').vline(10, 5, 9, 'e');
    }),
  jidan: () =>
    sprite((f) => {
      f.rect(1, 7, 14, 6, 'o').hline(1, 12, 14, 'j').vline(14, 7, 6, 'j');
      for (const x of [2, 6, 10]) f.oval(x, 4, 4, 5, 'w').set(x + 3, 6, 'e').set(x + 3, 7, 'e');
    }),
  danzi: () =>
    sprite((f) => {
      f.rect(3, 1, 10, 14, 'w').vline(12, 1, 14, 'e');
      f.hline(5, 4, 6, 'r').hline(5, 7, 5, 'e').hline(5, 10, 6, 'e').hline(5, 13, 3, 'e');
    }),
  huzhao: () =>
    sprite((f) => {
      f.rect(3, 1, 10, 14, 'q').vline(12, 1, 14, 'R').vline(3, 1, 14, 'R');
      f.oval(6, 4, 4, 4, 'y').set(7, 5, 'Y').set(8, 6, 'Y');
      f.hline(5, 10, 6, 'y').hline(6, 12, 4, 'Y');
    }),
  niao: () =>
    sprite((f) => {
      f.oval(3, 6, 9, 6, 'y').oval(8, 2, 6, 6, 'y');
      f.oval(4, 7, 6, 3, 'Y').rect(1, 8, 3, 2, 'Y').set(10, 4, 'k').set(9, 3, 'j').hline(4, 10, 6, 'j');
      f.set(14, 5, 'o').set(14, 4, 'o');
      f.set(6, 12, 'o').set(9, 12, 'o');
    }),
  tanghulu: () =>
    sprite((f) => {
      f.vline(7, 12, 3, 'z').vline(8, 12, 3, 'M');
      for (const y of [0, 4, 8]) f.oval(4, y, 8, 5, 'r').rect(9, y + 2, 2, 2, 'R').set(6, y + 1, 'p').set(5, y + 2, 'p').set(6, y + 2, 'w');
    }),
  zhugan: () =>
    sprite((f) => {
      stroke(f, 2, 13, 13, 2, 'h', 2);
      stroke(f, 3, 13, 13, 3, 'G');
      for (const t of [3, 7, 11]) f.set(2 + t, 13 - t, 'g').set(3 + t, 13 - t, 'g').set(3 + t, 12 - t, 'i');
      f.set(14, 1, 'i');
    }),
  fengzheng: () =>
    sprite((f) => {
      diamond(f, 7, 5, 5, 'p').where((x, y) => Math.abs(x - 7) + Math.abs(y - 5) <= 5 && x > 7, 'r');
      f.vline(7, 1, 9, 'z').hline(3, 5, 9, 'z').set(7, 5, 'y');
      f.set(8, 11, 'm').set(9, 12, 'm').set(9, 13, 'm').set(10, 14, 'm');
      f.set(8, 12, 'y').set(10, 13, 'n').set(11, 14, 'y');
    }),
  shoudiantong: () =>
    sprite((f) => {
      f.rect(1, 6, 8, 4, 'b').hline(1, 6, 8, 'c').hline(1, 9, 8, 'a').rect(9, 5, 3, 6, 'c').hline(9, 5, 3, 'd').vline(12, 4, 8, 'd');
      f.vline(13, 5, 6, 'Q').set(5, 5, 'r').set(6, 5, 'r');
    }),
  yaoshi: () =>
    sprite(
      (f) => {
        f.oval(1, 4, 7, 7, 'Y').set(2, 5, 'j').set(3, 5, 'j');
        f.hline(7, 7, 7, 'y').hline(7, 8, 7, 'Y').set(12, 9, 'Y').set(13, 9, 'Y').set(10, 9, 'Y').set(12, 10, 'Y');
        f.rect(8, 2, 3, 3, 'd').set(9, 3, '.').set(9, 3, 'e');
      },
      (f) => f.rect(3, 6, 3, 3, '.').set(4, 6, 'o').set(3, 7, 'o'),
    ),
  baowenbei: () =>
    sprite((f) => {
      f.rect(5, 3, 6, 12, 'c').rect(5, 1, 6, 2, 'a').vline(6, 4, 10, 'e').vline(10, 3, 12, 'b').hline(5, 11, 6, 'b').hline(5, 3, 6, 'd');
    }),
  reshui: () =>
    sprite((f) => {
      f.rect(5, 5, 6, 10, 'r').rect(6, 3, 4, 2, 'y').vline(6, 6, 8, 'p').vline(10, 5, 10, 'R').hline(5, 8, 6, 'j').hline(5, 12, 6, 'j');
      f.set(6, 1, 'e').set(7, 0, 'e').set(9, 1, 'e').set(10, 0, 'e');
    }),
  shouji: () =>
    sprite((f) => {
      f.rect(4, 1, 8, 14, 'a').rect(5, 3, 6, 9, 'l').hline(5, 3, 6, 'n').set(6, 5, 'w').set(6, 6, 'w').rect(8, 7, 2, 2, 'n');
      f.hline(7, 13, 2, 'c').hline(7, 2, 2, 'b');
    }),
  'lao-zhaopian': () =>
    sprite((f) => {
      f.rect(1, 3, 14, 11, 'w').rect(2, 4, 12, 7, 'F').rect(2, 4, 12, 2, 'f');
      f.rect(4, 7, 6, 4, 'P').hline(3, 6, 8, 'o').set(6, 9, 'o').vline(6, 9, 2, 'm').set(11, 8, 'P').rect(10, 8, 3, 3, 'P');
      f.hline(3, 12, 5, 'e');
    }),
  yusan: () =>
    sprite((f) => {
      f.oval(1, 1, 14, 12, 'n').where((_x, y) => y > 6, '.');
      f.oval(3, 2, 3, 4, 'l').set(7, 2, 'l').vline(7, 2, 5, 'l').vline(11, 3, 4, 'B').vline(12, 4, 3, 'B');
      for (const x of [2, 6, 10]) f.set(x, 7, 'n').set(x + 1, 7, 'n');
      f.vline(8, 7, 6, 'm').set(7, 13, 'm').set(6, 12, 'm').set(8, 0, 'm');
    }),
  hongbao: () =>
    sprite((f) => {
      f.rect(3, 1, 10, 14, 'r').vline(12, 1, 14, 'R');
      for (let i = 0; i < 4; i++) f.hline(3 + i, 3 + i, 10 - 2 * i, 'R');
      f.oval(6, 7, 4, 4, 'y').set(7, 8, 'o').set(8, 9, 'o').hline(5, 13, 6, 'Y');
    }),
  chunlian: () =>
    sprite((f) => {
      f.rect(3, 1, 10, 3, 'r').rect(1, 5, 3, 10, 'r').rect(12, 5, 3, 10, 'r');
      for (const x of [5, 8, 10]) f.set(x, 2, 'y');
      for (const y of [6, 9, 12]) f.set(2, y, 'y').set(13, y, 'y');
      f.vline(3, 5, 10, 'R').vline(14, 5, 10, 'R').hline(3, 3, 10, 'R');
    }),
  fu: () =>
    sprite((f) => {
      diamond(f, 7.5, 7.5, 7, 'r');
      diamond(f, 7.5, 7.5, 5, 'R');
      diamond(f, 7.5, 7.5, 4, 'r');
      // 福, as far as 16 pixels allow: 礻 and 畐
      f.set(5, 5, 'y').hline(4, 6, 2, 'y').vline(5, 7, 4, 'y').set(4, 8, 'y');
      f.hline(8, 5, 3, 'y').rect(8, 7, 3, 1, 'y').rect(8, 9, 3, 2, 'y').set(9, 9, 'o').vline(8, 7, 4, 'y').vline(10, 7, 4, 'y');
    }),
  jiaozi: () =>
    sprite((f) => {
      f.oval(0, 11, 16, 5, 'e').oval(2, 12, 12, 3, 'w');
      // three half-moons, flat side down, a pleated ridge on top
      for (const [cx, y0] of [
        [4, 7],
        [11, 7],
        [7.5, 3],
      ] as const) {
        f.where((x, y) => y <= y0 + 5 && ((x - cx) / 3.6) ** 2 + ((y - (y0 + 5)) / 4.6) ** 2 <= 1, 'w');
        f.where((x, y) => y === y0 + 5 && Math.abs(x - cx) <= 3, 'e');
        for (const dx of [-2, 0, 2]) f.set(Math.round(cx + dx), y0 + 1 + (dx ? 1 : 0), 'd');
      }
    }),
  yuanxiao: () =>
    sprite((f) => {
      f.oval(2, 3, 5, 5, 'w').oval(6, 2, 5, 5, 'w').oval(9, 4, 5, 5, 'w').set(4, 4, 'N').set(8, 3, 'N');
      f.oval(0, 5, 16, 11, 'n').where((_x, y) => y < 8, (_x, _y, c) => (c === 'n' ? '.' : c));
      f.hline(1, 8, 14, 'l').where((_x, y, c) => c === 'n' && y > 12, 'B');
      f.hline(4, 10, 2, 'w').hline(10, 10, 2, 'w').hline(7, 11, 2, 'w');
    }),
  huapen: () =>
    sprite((f) => {
      f.rect(4, 10, 8, 2, 'M').rect(5, 12, 6, 3, 'M').hline(4, 10, 8, 'z').vline(10, 12, 3, 'm');
      f.vline(7, 5, 5, 'G').set(5, 7, 'h').set(6, 8, 'h').set(9, 7, 'h').set(10, 6, 'h');
      for (const [x, y, c] of [
        [4, 3, 'N'],
        [8, 2, 'y'],
        [11, 4, 'p'],
      ] as const)
        f.rect(x - 1, y, 3, 3, c).set(x, y + 1, 'j');
    }),
  jianzhi: () =>
    sprite(
      (f) => f.rect(1, 1, 14, 14, 'r').vline(14, 1, 14, 'R'),
      (f) => {
        // cut after the outline: a flower and four corner commas
        for (const [x, y] of [
          [7, 4],
          [8, 4],
          [4, 7],
          [4, 8],
          [11, 7],
          [11, 8],
          [7, 11],
          [8, 11],
          [7, 7],
          [8, 8],
          [3, 3],
          [12, 3],
          [3, 12],
          [12, 12],
          [6, 6],
          [9, 6],
          [6, 9],
          [9, 9],
        ] as const)
          f.set(x, y, '.');
      },
    ),
  xiaoyugan: () =>
    sprite((f) => {
      for (const [ox, oy] of [
        [0, 2],
        [3, 7],
      ] as const) {
        f.oval(ox + 1, oy + 1, 9, 4, 'z').hline(ox + 2, oy + 3, 7, 'o').set(ox + 3, oy + 2, 'k');
        f.set(ox + 10, oy + 1, 'o').set(ox + 10, oy + 4, 'o').rect(ox + 11, oy, 2, 2, 'o').rect(ox + 11, oy + 4, 2, 2, 'o');
      }
    }),
  mutou: () =>
    sprite((f) => {
      f.rect(1, 5, 11, 7, 'M').hline(1, 5, 11, 'z').hline(2, 8, 5, 'm').hline(5, 10, 5, 'm').hline(1, 11, 11, 'm');
      f.oval(10, 4, 5, 9, 'z').oval(11, 6, 3, 5, 'M').set(12, 8, 'z');
      f.set(4, 4, 'h').set(5, 3, 'G');
    }),
  hongbu: () =>
    sprite((f) => {
      f.rect(1, 6, 14, 7, 'r').rect(3, 4, 12, 2, 'p').hline(1, 9, 14, 'R').hline(1, 12, 14, 'R').vline(14, 6, 7, 'R');
      f.set(2, 7, 'p').set(3, 7, 'p').set(2, 10, 'p');
    }),
  xiang: () =>
    sprite((f) => {
      f.oval(2, 10, 12, 5, 'Y').hline(3, 11, 10, 'j').hline(4, 14, 8, 'o');
      for (const x of [5, 8, 11]) f.vline(x, 3 + (x === 8 ? -1 : 0), 8, 'q').set(x, 2 + (x === 8 ? -1 : 0), 'O');
      f.set(6, 1, 'd').set(9, 0, 'e').set(12, 1, 'd');
    }),
  yuer: () =>
    sprite((f) => {
      f.rect(3, 6, 10, 8, 'c').hline(3, 6, 10, 'e').rect(3, 8, 10, 3, 'G').hline(4, 9, 3, 'h').vline(12, 6, 8, 'b');
      f.set(5, 5, 'N').set(6, 4, 'N').set(7, 5, 'N').set(9, 5, 'N').set(10, 4, 'N').set(11, 3, 'N');
    }),
  zongzi: () =>
    sprite((f) => {
      f.where((x, y) => y >= 2 && y <= 13 && Math.abs(x - 7.5) <= (y - 1) * 0.6, 'h');
      f.where((x, _y, c) => c === 'h' && x > 8, 'G').where((x, y, c) => c === 'h' && (x + y) % 5 === 0, 'i');
      f.hline(3, 9, 10, 'f').where((x, _y, c) => c === 'f' && (x < 3 || x > 12), '.');
      f.set(7, 2, 'g').set(8, 2, 'g');
    }),
  xiaoyu: () =>
    sprite((f) => {
      f.oval(1, 4, 11, 7, 'l').hline(2, 8, 9, 'w').hline(3, 5, 7, 'n').set(3, 6, 'k').set(2, 6, 'w');
      f.rect(12, 4, 2, 2, 'n').rect(12, 9, 2, 2, 'n').vline(11, 5, 5, 'n').set(14, 3, 'n').set(14, 11, 'n');
      f.set(7, 3, 'n').set(8, 3, 'n');
    }),
  hua: () =>
    sprite((f) => {
      f.rect(0, 2, 16, 12, 'M').rect(1, 3, 14, 10, 'X').rect(1, 10, 14, 3, 'h').hline(1, 10, 14, 'i');
      // the White Dagoba on its hill
      f.oval(5, 6, 6, 5, 'w').rect(7, 3, 2, 4, 'w').set(7, 3, 'y').set(8, 3, 'y').rect(6, 9, 4, 2, 'e').set(9, 7, 'e');
      f.where((x, y) => (x === 0 || x === 15 || y === 2 || y === 13) && (x + y) % 3 === 0, 'z');
    }),
  ditu: () =>
    sprite((f) => {
      f.rect(2, 3, 12, 10, 'f').vline(1, 2, 12, 'z').vline(14, 2, 12, 'z').vline(2, 3, 10, 'F');
      f.hline(3, 6, 10, 'P').vline(8, 3, 10, 'P').set(5, 9, 'P').set(6, 10, 'P').set(11, 9, 'h').set(12, 9, 'h').set(11, 10, 'h');
      f.set(10, 5, 'r').set(5, 4, 'W').set(4, 4, 'W');
    }),
  denglong: () =>
    sprite((f) => {
      f.vline(7, 0, 2, 'm').vline(8, 0, 2, 'm').rect(5, 2, 6, 1, 'Y');
      f.oval(2, 3, 12, 9, 'r').vline(12, 5, 5, 'R').vline(3, 5, 5, 'p');
      for (const x of [5, 8, 10]) f.vline(x, 4, 7, 'R');
      f.set(6, 5, 'p').rect(5, 11, 6, 1, 'Y').vline(7, 12, 3, 'y').vline(8, 12, 3, 'Y');
    }),
  lingdang: () =>
    sprite((f) => {
      f.rect(7, 1, 2, 2, 'o').oval(4, 3, 8, 6, 'y').rect(3, 7, 10, 4, 'y').hline(2, 10, 12, 'Y').hline(2, 11, 12, 'o');
      f.vline(5, 4, 5, 'j').vline(11, 5, 5, 'Y').rect(7, 12, 2, 2, 'o');
    }),
  changmingdeng: () =>
    sprite((f) => {
      f.oval(2, 10, 12, 4, 'Y').hline(3, 10, 10, 'j').rect(6, 13, 4, 2, 'o');
      f.oval(6, 2, 4, 8, 'O').oval(7, 4, 2, 5, 'L').set(7, 7, 'Q').set(8, 7, 'Q').set(8, 1, 'O').vline(8, 8, 2, 'k');
    }),
  chahu: () =>
    sprite(
      (f) => {
        f.oval(3, 5, 10, 9, 'M').hline(4, 7, 8, 'z').hline(4, 12, 8, 'm').rect(6, 3, 4, 2, 'm').rect(7, 2, 2, 1, 'z');
        stroke(f, 3, 9, 0, 6, 'M');
        f.set(1, 6, 'M').oval(11, 6, 5, 6, 'm');
      },
      (f) => f.rect(13, 8, 1, 2, '.'),
    ),
  tongqian: () =>
    sprite(
      (f) => {
        f.oval(1, 1, 14, 14, 'Y').oval(3, 3, 10, 10, 'y').set(4, 5, 'j').set(5, 4, 'j').where((x, y, c) => c === 'Y' && x + y > 20, 'o');
        f.rect(6, 6, 4, 4, 'o');
      },
      (f) => f.rect(7, 7, 2, 2, '.'),
    ),
  shanzi: () =>
    sprite((f) => {
      f.where((x, y) => {
        const d = Math.hypot(x - 7.5, y - 13);
        return d <= 11.5 && d >= 3 && y <= 12;
      }, 'w');
      f.where((x, y, c) => c === 'w' && Math.round(Math.atan2(13 - y, x - 7.5) * 4) % 2 === 0, 'e');
      f.where((x, y, c) => (c === 'w' || c === 'e') && Math.hypot(x - 7.5, y - 13) > 8.5, 'r');
      f.rect(7, 11, 2, 4, 'M');
    }),
  biyanhu: () =>
    sprite((f) => {
      f.oval(3, 5, 10, 10, 'w').rect(6, 3, 4, 2, 'w').rect(6, 1, 4, 2, 'r').hline(6, 1, 4, 'p');
      f.set(6, 8, 'n').set(7, 7, 'n').set(8, 8, 'n').set(7, 9, 'n').set(9, 10, 'h').set(10, 11, 'h').set(5, 11, 'n').set(6, 12, 'l');
      f.where((x, _y, c) => c === 'w' && x >= 11, 'e');
    }),
  chaye: () =>
    sprite((f) => {
      f.rect(3, 3, 10, 12, 'G').rect(3, 1, 10, 2, 'g').rect(3, 6, 10, 5, 'r').vline(12, 3, 12, 'g').vline(4, 3, 12, 'h');
      f.rect(6, 7, 4, 3, 'y').set(7, 8, 'o').set(8, 8, 'o');
    }),
  lianpu: () =>
    sprite((f) => {
      f.oval(2, 1, 12, 14, 'r').rect(3, 5, 4, 3, 'w').rect(9, 5, 4, 3, 'w').set(5, 6, 'k').set(10, 6, 'k');
      f.hline(3, 4, 4, 'k').hline(9, 4, 4, 'k').vline(7, 2, 8, 'y').vline(8, 2, 8, 'y').rect(6, 11, 4, 2, 'q').set(4, 10, 'R').set(11, 10, 'R');
    }),
  jinbi: () =>
    sprite((f) => {
      for (const [x, y, n] of [
        [1, 5, 10],
        [6, 1, 9],
      ] as const) {
        f.oval(x, y, n, n, 'Y').oval(x + 1, y + 1, n - 2, n - 2, 'y').oval(x + 3, y + 3, n - 6, n - 6, 'Y').set(x + 2, y + 2, 'j').set(x + 3, y + 1, 'j');
      }
      f.where((x, y, c) => c === 'Y' && x + y > 22, 'o');
    }),
  'long-fengzheng': () =>
    sprite((f) => {
      f.oval(1, 1, 8, 7, 'r').rect(2, 3, 2, 2, 'w').set(3, 4, 'k').hline(4, 6, 4, 'y').set(8, 1, 'y').set(1, 1, 'y');
      for (let i = 0; i < 4; i++) f.oval(6 + i * 2, 6 + i * 2, 4, 4, i % 2 ? 'y' : 'r');
      f.set(14, 14, 'r').set(15, 13, 'y');
    }),
  kongzhu: () =>
    sprite((f) => {
      f.oval(0, 3, 6, 10, 'r').oval(10, 3, 6, 10, 'r').rect(5, 7, 6, 2, 'z').hline(5, 8, 6, 'M');
      f.vline(1, 5, 6, 'p').vline(11, 5, 6, 'p').rect(2, 7, 2, 2, 'y').rect(12, 7, 2, 2, 'y');
    }),
  'chengyu-shu': () =>
    sprite((f) => {
      f.rect(3, 1, 10, 14, 'n').vline(3, 1, 14, 'B').vline(12, 2, 13, 'w').rect(5, 3, 6, 4, 'w').hline(6, 4, 4, 'k').hline(6, 5, 3, 'k');
      f.hline(5, 11, 6, 'y').set(8, 9, 'y');
    }),
  hongzhi: () =>
    sprite((f) => {
      f.rect(1, 5, 12, 9, 'R').rect(3, 3, 12, 9, 'r').hline(3, 3, 12, 'p').vline(3, 3, 9, 'p').set(12, 10, 'R').set(13, 11, 'R');
    }),
  ganmaoyao: () =>
    sprite((f) => {
      f.rect(1, 4, 14, 9, 'w').rect(1, 4, 14, 2, 'e').rect(1, 11, 14, 2, 'h').vline(14, 4, 9, 'e');
      f.rect(6, 7, 4, 2, 'r').rect(7, 6, 2, 4, 'r');
    }),
  gushishu: () =>
    sprite((f) => {
      f.rect(3, 1, 10, 14, 'r').vline(3, 1, 14, 'R').vline(12, 2, 13, 'w').oval(5, 4, 6, 6, 'x').set(7, 6, 'y').rect(6, 7, 3, 1, 'y').set(8, 5, 'y');
      f.hline(5, 12, 6, 'y');
    }),
  yuebing: () =>
    sprite((f) => {
      f.oval(1, 4, 14, 10, 'o').oval(1, 2, 14, 10, 'Y').oval(3, 3, 10, 7, 'y');
      f.oval(5, 4, 6, 5, 'Y').rect(7, 5, 2, 3, 'j').set(4, 4, 'j');
    }),
  shufa: () =>
    sprite((f) => {
      f.rect(4, 2, 8, 12, 'w').rect(3, 1, 10, 1, 'M').rect(3, 14, 10, 1, 'M').vline(11, 2, 12, 'e');
      f.hline(6, 4, 4, 'k').vline(7, 5, 3, 'k').set(6, 6, 'k').hline(6, 9, 3, 'k').set(8, 10, 'k').set(9, 11, 'k').rect(9, 12, 1, 1, 'r');
    }),
  maobi: () =>
    sprite((f) => {
      stroke(f, 14, 1, 6, 9, 'z', 2);
      stroke(f, 14, 2, 7, 9, 'M');
      f.rect(4, 9, 3, 3, 'e').set(5, 10, 'd').rect(2, 11, 3, 3, 'a').set(1, 14, 'k').set(2, 13, 'k');
      f.set(14, 0, 'r');
    }),
};

/** The menu's own pictures: the five tabs, the bag's pockets, the wallet, the cat's card. */
export const UI_SPRITES: Record<string, () => Grid> = {
  // 日志: a red notebook with a gold ribbon
  journal: () =>
    sprite((f) => {
      f.rect(3, 1, 10, 13, 'r').vline(3, 1, 13, 'R').vline(12, 2, 12, 'w').rect(5, 3, 6, 3, 'f').hline(6, 4, 4, 'P');
      f.vline(9, 14, 2, 'y').set(10, 15, 'Y');
    }),
  // 包: a backpack
  bag: () =>
    sprite((f) => {
      f.oval(2, 3, 12, 12, 'r').rect(2, 8, 12, 6, 'r').rect(5, 1, 6, 3, 'R').rect(6, 2, 4, 1, '.');
      f.rect(4, 9, 8, 4, 'R').hline(4, 9, 8, 'p').rect(7, 10, 2, 1, 'y').vline(2, 6, 7, 'p').vline(13, 6, 8, 'q');
    }),
  // 地图: a folded map with a red route
  map: () =>
    sprite((f) => {
      f.rect(1, 3, 5, 11, 'f').rect(6, 2, 5, 11, 'F').rect(11, 3, 4, 11, 'f');
      f.set(2, 11, 'r').set(3, 10, 'r').set(4, 9, 'r').set(6, 8, 'r').set(8, 7, 'r').set(9, 6, 'r').set(12, 5, 'r').rect(12, 4, 2, 2, 'q');
      f.hline(1, 6, 5, 'h').hline(11, 10, 4, 'W').vline(8, 9, 3, 'P');
    }),
  // 朋友: two friends
  people: () =>
    sprite((f) => {
      f.oval(8, 2, 6, 6, 's').rect(8, 2, 6, 2, 'H').oval(7, 9, 8, 7, 'n').set(9, 5, 'k').set(12, 5, 'k');
      f.oval(1, 4, 6, 6, 's').rect(1, 4, 6, 2, 'o').oval(0, 11, 8, 6, 'r').set(2, 7, 'k').set(5, 7, 'k');
    }),
  // 收藏: a wooden treasure box with a gold clasp
  collection: () =>
    sprite((f) => {
      f.rect(1, 6, 14, 8, 'M').oval(1, 2, 14, 7, 'z').hline(1, 7, 14, 'm').vline(4, 3, 11, 'y').vline(11, 3, 11, 'y');
      f.rect(7, 6, 2, 3, 'y').set(7, 7, 'o').hline(1, 13, 14, 'm').set(3, 3, 'j');
    }),
  // the wallet: 余额 as a coin, 交通卡 as a blue card
  coin: () =>
    sprite((f) => {
      f.oval(1, 1, 14, 14, 'Y').oval(2, 2, 12, 12, 'y').set(4, 4, 'j').set(5, 3, 'j');
      // ¥
      f.set(5, 4, 'o').set(6, 5, 'o').set(10, 4, 'o').set(9, 5, 'o').rect(7, 6, 2, 6, 'o').hline(5, 7, 6, 'o').hline(5, 9, 6, 'o');
    }),
  card: () =>
    sprite((f) => {
      f.rect(1, 3, 14, 10, 'n').hline(1, 3, 14, 'l').rect(1, 6, 14, 2, 'B').rect(3, 9, 4, 2, 'y').hline(9, 10, 4, 'l');
    }),
  // pockets without an item of their own: all, presents
  gift: () =>
    sprite((f) => {
      f.rect(2, 6, 12, 8, 'r').rect(1, 4, 14, 3, 'p').vline(7, 4, 10, 'y').vline(8, 4, 10, 'Y').vline(13, 6, 8, 'R');
      f.rect(4, 1, 3, 3, 'y').rect(9, 1, 3, 3, 'y').set(5, 2, 'o').set(10, 2, 'o');
    }),
  // a seal: the pocket of story things
  seal: () =>
    sprite(
      (f) => f.rect(2, 2, 12, 12, 'r').vline(13, 2, 12, 'R').hline(2, 13, 12, 'R'),
      (f) => {
        // a chop's white border and its mark, cut out of the red
        f.hline(3, 3, 10, 'w').hline(3, 12, 10, 'w').vline(3, 3, 10, 'w').vline(12, 3, 10, 'w');
        f.vline(6, 5, 6, 'w').hline(6, 5, 2, 'w').hline(6, 10, 2, 'w').vline(9, 5, 6, 'w').hline(9, 5, 2, 'w').vline(10, 5, 3, 'w');
      },
    ),
  // 📷 photo mode
  camera: () =>
    sprite((f) => {
      f.rect(1, 5, 14, 9, 'b').hline(1, 5, 14, 'c').rect(4, 3, 5, 2, 'b').rect(11, 3, 3, 2, 'y');
      f.oval(5, 6, 7, 7, 'a').oval(6, 7, 5, 5, 'n').oval(7, 8, 3, 3, 'B').set(7, 8, 'l').set(2, 7, 'r');
    }),
  // 衣柜 — the wardrobe for the clothes pocket
  clothes: () =>
    sprite((f) => {
      f.rect(3, 3, 10, 11, 'n').rect(1, 3, 3, 5, 'n').rect(12, 3, 3, 5, 'n').rect(6, 2, 4, 2, 'l').vline(8, 5, 8, 'B').set(7, 7, 'y').set(7, 10, 'y');
    }),
};
