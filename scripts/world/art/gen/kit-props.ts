/**
 * The Beijing kit's props (§13 V2): the temple set and the street's life.
 * Outlined like every prop; the animated ones (incense smoke, prayer wheels,
 * grill smoke) have their frames here and V3 turns them.
 */

import { Grid } from './grid';

/** A shadow ellipse on the ground under a thing. */
const shadow = (g: Grid, x: number, y: number, w: number, h = 3) => g.oval(x, y, w, h, '_');

// ---------------------------------------------------------------- temples

/** 香炉: a bronze tripod censer on a stone step; smoke curls up in two frames (none when cold). */
export function censer(smoke: 0 | 1 | null): Grid {
  const g = new Grid(32, 32);
  shadow(g, 3, 28, 26, 4);
  const f = new Grid(32, 32);
  f.rect(4, 25, 24, 5, 'd').hline(4, 25, 24, 'e').hline(4, 29, 24, 'c');
  // legs
  for (const x of [8, 15, 22]) f.rect(x, 20, 3, 6, 'm').vline(x, 20, 6, 'M');
  // the bowl, lit from the left, with a band of pattern
  f.oval(5, 12, 22, 11, 'M').oval(6, 12, 18, 8, 'o').rect(5, 12, 22, 3, 'm').hline(6, 12, 20, 'Y');
  for (let x = 8; x < 25; x += 4) f.set(x, 17, 'Y');
  // ears and the rim of ash
  f.rect(4, 9, 3, 5, 'm').rect(25, 9, 3, 5, 'm').set(5, 10, 'Y').set(26, 10, 'Y');
  f.rect(8, 11, 16, 2, 'c').hline(9, 11, 14, 'd');
  // three incense sticks
  for (const x of [13, 16, 19]) f.vline(x, 4, 7, 'q').set(x, 4, 'O');
  f.outline('k');
  g.stamp(f, 0, 0);
  if (smoke !== null) {
    const o = smoke;
    for (let y = 0; y < 5; y++) g.set(12 + ((y + o) % 2), y, 'e').set(16 + ((y + o + 1) % 2), y, 'd').set(19 + ((y + o) % 2), y, 'e');
  }
  return g;
}

/** 转经筒: a row of prayer wheels in a red frame (雍和宫) — three frames of turning, their gold script moving. */
export function prayerWheels(turn: 0 | 1 | 2): Grid {
  const g = new Grid(48, 24);
  shadow(g, 1, 21, 46, 3);
  const f = new Grid(48, 24);
  f.rect(0, 1, 48, 3, 'R').hline(0, 1, 48, 'r').rect(0, 20, 48, 3, 'R');
  for (let i = 0; i < 6; i++) {
    const x = 2 + i * 8;
    f.rect(x, 4, 6, 16, 'Y').vline(x, 4, 16, 'j').vline(x + 5, 4, 16, 'o');
    f.hline(x, 7, 6, 'o').hline(x, 16, 6, 'o');
    // the script band: moves one pixel a frame as the wheel turns
    for (let y = 9; y < 15; y += 2) f.set(x + 1 + ((y + turn) % 4), y, 'q');
    f.vline(x + 3, 2, 2, 'm').vline(x + 3, 20, 1, 'm');
  }
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 石碑 on a 赑屃: a stone tablet carried by the dragon-tortoise, lines of carved characters on it. */
export function stele(): Grid {
  const g = new Grid(32, 32);
  shadow(g, 2, 28, 28, 4);
  const f = new Grid(32, 32);
  // the tortoise: a domed shell, the head out to the left
  f.oval(4, 20, 24, 10, 'c').oval(6, 21, 20, 6, 'd').hline(8, 22, 16, 'e');
  f.rect(1, 23, 5, 4, 'c').set(2, 24, 'k');
  for (let x = 8; x < 26; x += 4) f.set(x, 25, 'b');
  // the tablet
  f.rect(10, 2, 12, 20, 'd').vline(10, 2, 20, 'e').vline(21, 2, 20, 'b').oval(10, 0, 12, 5, 'd').hline(12, 1, 8, 'e');
  for (let x = 12; x < 21; x += 2) for (let y = 7; y < 20; y += 2) if ((x + y) % 3) f.set(x, y, 'b');
  f.rect(13, 3, 6, 3, 'c');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A temple bell 钟 hanging in a wooden frame. */
export function bell(): Grid {
  const g = new Grid(32, 32);
  shadow(g, 3, 28, 26, 4);
  const f = new Grid(32, 32);
  f.rect(2, 4, 3, 26, 'M').rect(27, 4, 3, 26, 'M').rect(0, 2, 32, 4, 'm').hline(0, 2, 32, 'M');
  f.vline(3, 4, 26, 'z').vline(28, 4, 26, 'z');
  // the bell: bronze, flared at the mouth, bosses in rows
  f.rect(11, 6, 10, 2, 'm').oval(9, 7, 14, 8, 'o').rect(9, 11, 14, 11, 'o').rect(7, 20, 18, 3, 'M').hline(7, 22, 18, 'm');
  f.vline(10, 9, 12, 'Y').vline(21, 9, 12, 'm');
  for (let y = 12; y < 19; y += 3) for (let x = 12; x < 20; x += 3) f.set(x, y, 'Y');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 蒲团: a round kneeling cushion of woven straw before an altar. */
export function putuan(): Grid {
  const g = new Grid(16, 16);
  shadow(g, 1, 12, 14);
  const f = new Grid(16, 16);
  f.oval(1, 6, 14, 8, 'Y').oval(2, 6, 12, 5, 'y').oval(5, 7, 6, 3, 'j');
  for (let x = 2; x < 14; x += 3) f.set(x, 11, 'o');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 签筒: the bamboo cup of fortune sticks. */
export function qiantong(): Grid {
  const g = new Grid(16, 16);
  shadow(g, 3, 13, 10);
  const f = new Grid(16, 16);
  f.rect(4, 6, 8, 8, 'z').vline(4, 6, 8, 'f').vline(11, 6, 8, 'M').hline(4, 9, 8, 'M');
  for (const [x, h] of [[5, 5], [7, 6], [9, 4], [10, 5]] as const) f.vline(x, 6 - h, h, 'f').set(x, 6 - h, 'r');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 影壁: the screen wall inside a gate (so no one looks straight in, and no bad luck walks straight in) — grey brick, a carved centre, a tiled top. */
export function yingbi(): Grid {
  const g = new Grid(48, 32);
  shadow(g, 2, 29, 44, 3);
  const f = new Grid(48, 32);
  f.rect(2, 8, 44, 21, 'c').rect(0, 26, 48, 4, 'b').hline(0, 26, 48, 'c');
  for (let y = 10; y < 26; y += 4) f.hline(2, y, 44, 'b');
  // the carved centre: a diamond of brick relief with a 福-like flower
  f.rect(16, 11, 16, 12, 'd').rect(18, 13, 12, 8, 'e');
  f.oval(21, 14, 6, 6, 'c').set(23, 16, 'b').set(24, 17, 'b');
  for (const [x, y] of [[16, 11], [31, 11], [16, 22], [31, 22]] as const) f.set(x, y, 'b');
  // the tiled top: a little roof with its ridge
  f.rect(0, 3, 48, 5, 'b').hline(0, 3, 48, 'd').hline(0, 4, 48, 'c');
  for (let x = 1; x < 48; x += 3) f.vline(x, 5, 3, 'a');
  f.rect(4, 1, 40, 2, 'a').set(4, 0, 'a').set(43, 0, 'a');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 垂花门: the inner, painted gate of a courtyard house — two hanging pillars ending in carved flowers. */
export function chuihuamen(): Grid {
  const g = new Grid(48, 48);
  shadow(g, 4, 44, 40, 4);
  const f = new Grid(48, 48);
  // steps and the doorway
  f.rect(8, 40, 32, 6, 'd').hline(8, 40, 32, 'e').hline(8, 43, 32, 'c');
  f.rect(12, 22, 24, 18, 'q').rect(14, 24, 20, 16, 'R').vline(24, 24, 16, 'q');
  for (const x of [10, 36]) f.rect(x, 18, 3, 22, 'r').vline(x, 18, 22, 'p');
  // the painted beam and the two hanging pillars 垂柱 with their flower ends
  f.rect(6, 14, 36, 5, 'v').hline(6, 14, 36, 'Y').hline(6, 18, 36, 'u');
  for (let x = 9; x < 40; x += 6) f.set(x, 16, 'x');
  for (const x of [12, 34]) f.rect(x, 19, 2, 4, 'r').oval(x - 1, 22, 4, 3, 'p').set(x, 23, 'Y');
  // the roof: a small rolled roof with a round ridge 卷棚
  f.rect(2, 6, 44, 8, 'b');
  for (let x = 2; x < 46; x += 3) f.vline(x, 6, 8, 'c').vline(x + 1, 6, 8, 'b').vline(x + 2, 6, 8, 'a');
  f.oval(4, 3, 40, 6, 'c').hline(6, 3, 36, 'd');
  f.hline(2, 13, 44, 'k');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 琉璃牌坊: a glazed archway — three gates of yellow-and-green tiles on a white marble base (国子监, temples). */
export function paifang(): Grid {
  const g = new Grid(64, 48);
  shadow(g, 2, 44, 60, 4);
  const f = new Grid(64, 48);
  f.rect(0, 40, 64, 6, 'e').hline(0, 40, 64, 'w').hline(0, 45, 64, 'd');
  // the body: red plaster with green-glazed panels, three arched gates
  f.rect(2, 16, 60, 24, 'r').hline(2, 16, 60, 'p');
  for (const [x, w] of [[5, 12], [24, 16], [47, 12]] as const) {
    f.rect(x, 26, w, 14, 'q').oval(x, 22, w, 9, 'q');
  }
  for (const x of [2, 20, 40, 58]) f.rect(x, 17, 4, 7, 'h').rect(x + 1, 18, 2, 5, 'G');
  f.rect(18, 18, 28, 5, 'h').hline(18, 18, 28, 'i').rect(26, 19, 12, 3, 'y');
  // three yellow roofs, the middle one highest
  const roof = (x0: number, x1: number, y: number) => {
    f.rect(x0, y, x1 - x0, 6, 'Y');
    for (let x = x0; x < x1; x += 3) f.vline(x, y, 6, 'y').vline(x + 2, y, 6, 'o');
    f.hline(x0, y + 6, x1 - x0, 'k').rect(x0 + 2, y - 2, x1 - x0 - 4, 2, 'o');
  };
  roof(0, 22, 9);
  roof(42, 64, 9);
  roof(16, 48, 3);
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A stone lioness 母狮: her paw on a cub (the lion of a pair holds a ball — `lion/stone`). */
export function lioness(): Grid {
  const g = new Grid(16, 32);
  shadow(g, 0, 28, 16, 4);
  const f = new Grid(16, 32);
  f.rect(0, 22, 16, 8, 'd').hline(0, 22, 16, 'e').hline(0, 29, 16, 'c');
  // body sitting up, curly mane
  f.rect(3, 10, 10, 12, 'd').vline(3, 10, 12, 'e').vline(12, 10, 12, 'c');
  f.oval(2, 2, 12, 11, 'd').oval(4, 4, 8, 7, 'e');
  for (const [x, y] of [[3, 3], [6, 2], [10, 3], [12, 6], [2, 7]] as const) f.set(x, y, 'c');
  f.set(6, 6, 'k').set(9, 6, 'k').hline(6, 9, 4, 'b');
  // the cub under her left paw
  f.oval(1, 17, 7, 6, 'e').set(3, 19, 'k').set(5, 19, 'k').rect(6, 15, 5, 3, 'c');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

// ---------------------------------------------------------------- the street's life

/** Overhead wires between two poles, sagging over a 胡同 — drawn high, over the roofs. */
export function wires(): Grid {
  const g = new Grid(48, 16);
  for (const x of [1, 46]) g.vline(x, 0, 16, 'm').set(x, 0, 'M');
  for (const [dy, c] of [[2, 'a'], [5, 'k'], [7, 'a']] as const) {
    for (let x = 2; x < 46; x++) {
      const sag = Math.round(Math.sin(((x - 2) / 44) * Math.PI) * 4);
      g.set(x, dy + sag, c);
    }
  }
  return g;
}

/** An air-conditioner box hung on a wall, its fan grille and a drip stain. */
export function acBox(): Grid {
  const g = new Grid(16, 16);
  const f = new Grid(16, 16);
  f.rect(1, 3, 14, 9, 'e').hline(1, 3, 14, 'w').hline(1, 11, 14, 'd');
  f.oval(4, 4, 7, 7, 'd').oval(5, 5, 5, 5, 'c');
  for (let i = 5; i < 10; i += 2) f.hline(5, i, 5, 'b');
  f.vline(12, 5, 5, 'd');
  f.outline('k');
  g.stamp(f, 0, 0);
  g.vline(3, 13, 3, 'b');
  return g;
}

/** A washing line across a courtyard corner: a shirt, trousers, a towel. */
export function washingLine(): Grid {
  const g = new Grid(48, 32);
  for (const x of [1, 46]) g.vline(x, 4, 26, 'M').set(x, 4, 'z');
  shadow(g, 0, 29, 4, 3);
  shadow(g, 44, 29, 4, 3);
  for (let x = 2; x < 46; x++) g.set(x, 6 + Math.round(Math.sin(((x - 2) / 44) * Math.PI) * 2), 'b');
  const f = new Grid(48, 32);
  // shirt
  f.rect(8, 8, 10, 9, 'n').rect(5, 8, 3, 4, 'n').rect(18, 8, 3, 4, 'n').vline(13, 8, 9, 'B').hline(8, 8, 10, 'l');
  // trousers
  f.rect(23, 8, 8, 4, 'b').rect(23, 12, 3, 9, 'b').rect(28, 12, 3, 9, 'b').vline(23, 8, 13, 'c');
  // towel
  f.rect(35, 8, 7, 10, 'r').hline(35, 10, 7, 'w').hline(35, 15, 7, 'w');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 大白菜: the winter cabbages stacked by a door, as every Beijing family once did. */
export function cabbages(): Grid {
  const g = new Grid(16, 16);
  shadow(g, 0, 13, 16);
  const f = new Grid(16, 16);
  for (const [x, y] of [[0, 9], [5, 9], [10, 9], [2, 5], [8, 5], [5, 1]] as const) {
    f.oval(x, y, 6, 5, 'i').rect(x + 3, y, 3, 5, 'w').vline(x + 3, y, 5, 'e').set(x + 1, y + 1, 'h');
  }
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 煤球: a stack of honeycomb coal briquettes by a courtyard wall (old winters; still seen). */
export function coal(): Grid {
  const g = new Grid(16, 16);
  shadow(g, 1, 13, 14);
  const f = new Grid(16, 16);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - (row === 2 ? 1 : 0); i++) {
    const x = 1 + i * 5 + (row === 2 ? 2 : 0);
    const y = 10 - row * 4;
    f.rect(x, y, 5, 4, 'a').hline(x, y, 5, 'b').set(x + 1, y + 1, 'k').set(x + 3, y + 1, 'k').set(x + 2, y + 2, 'k');
  }
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/**
 * 春联 and 福 for a gate at 春节: a red couplet down each side of the door and
 * the 福 turned upside down in the middle (倒 sounds like 到 — happiness has
 * arrived). An overlay the size of the two door tiles.
 */
export function chunlian(): Grid {
  const g = new Grid(16, 32);
  for (const x of [0, 13]) {
    g.rect(x, 4, 3, 26, 'r').vline(x, 4, 26, 'p');
    for (let y = 7; y < 29; y += 4) g.set(x + 1, y, 'y');
  }
  // 横批 across the top
  g.rect(0, 0, 16, 4, 'r').hline(0, 0, 16, 'p');
  for (let x = 3; x < 14; x += 3) g.set(x, 2, 'y');
  // the 福 diamond
  g.rect(5, 12, 6, 6, 'r').set(8, 11, 'r').set(8, 18, 'r').set(4, 15, 'r').set(11, 15, 'r');
  g.rect(7, 14, 3, 2, 'y').set(8, 16, 'y');
  return g;
}

/** 小广告: little ads stuck on a wall — the phone numbers of every lane in town. */
export function ads(): Grid {
  const g = new Grid(16, 16);
  for (const [x, y, c] of [[1, 2, 'w'], [8, 1, 'j'], [3, 9, 'w'], [10, 8, 'N']] as const) {
    g.rect(x, y, 5, 5, c).set(x + 1, y + 1, 'k').hline(x + 1, y + 3, 3, 'b');
  }
  return g;
}

/** A 公厕 public-toilet sign on a post: blue with the two figures. */
export function toiletSign(): Grid {
  const g = new Grid(16, 32);
  shadow(g, 4, 29, 8);
  const f = new Grid(16, 32);
  f.vline(7, 12, 18, 'b').vline(8, 12, 18, 'a');
  f.rect(1, 2, 14, 11, 'n').hline(1, 2, 14, 'l');
  f.rect(3, 6, 2, 5, 'w').rect(3, 4, 2, 2, 'w').rect(10, 6, 3, 5, 'w').rect(10, 4, 2, 2, 'w').vline(7, 4, 7, 'l');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 烤串: a long charcoal grill with skewers; smoke rises in two frames. */
export function grill(smoke: 0 | 1): Grid {
  const g = new Grid(32, 16);
  shadow(g, 1, 13, 30);
  const f = new Grid(32, 16);
  f.rect(1, 7, 30, 4, 'a').hline(1, 7, 30, 'b').rect(1, 8, 30, 1, 'O');
  for (const x of [3, 27]) f.vline(x, 11, 4, 'a');
  for (let x = 4; x < 29; x += 3) f.hline(x - 1, 6, 1, 'z').vline(x, 3, 4, 'q').set(x, 4, 'r').set(x, 5, 'R');
  f.outline('k');
  g.stamp(f, 0, 0);
  for (let i = 0; i < 4; i++) g.set(6 + i * 7 + smoke, 1 + ((i + smoke) % 2), 'e').set(7 + i * 7 - smoke, 0, 'd');
  return g;
}

/** A 冰糖葫芦 stand: a straw pole bristling with red candied haws. */
export function tanghuluStand(): Grid {
  const g = new Grid(16, 32);
  shadow(g, 3, 29, 10);
  const f = new Grid(16, 32);
  f.vline(7, 10, 20, 'M').vline(8, 10, 20, 'm');
  f.oval(3, 6, 10, 10, 'y').oval(4, 7, 8, 7, 'j');
  for (const [x, y] of [[2, 3], [12, 4], [1, 9], [13, 10], [5, 1], [10, 1], [3, 14], [12, 14]] as const) {
    f.vline(x + (x < 7 ? 1 : -1), y + 1, 2, 'z');
    f.set(x, y, 'r').set(x, y + 1, 'R').set(x + 1, y, 'p');
  }
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 修车摊: a street bike-repair stand — a tool box, a pump, a tyre, a little stool. */
export function repairStall(): Grid {
  const g = new Grid(32, 32);
  shadow(g, 1, 28, 30, 4);
  const f = new Grid(32, 32);
  // the tool box with open lid
  f.rect(2, 18, 13, 9, 'r').hline(2, 18, 13, 'p').rect(2, 13, 13, 5, 'R').hline(2, 13, 13, 'r');
  for (const [x, c] of [[4, 'c'], [7, 'd'], [10, 'b']] as const) f.vline(x, 15, 3, c);
  // the hand pump
  f.vline(19, 10, 17, 'c').hline(16, 10, 7, 'b').rect(18, 25, 4, 2, 'b');
  // a tyre leaning on the box
  f.oval(21, 16, 10, 11, 'a').oval(23, 18, 6, 7, '.');
  // the stool
  f.rect(4, 27, 8, 2, 'M').vline(5, 29, 2, 'm').vline(10, 29, 2, 'm');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A newspaper kiosk 报刊亭: green, its window full of magazines, papers hung on the side. */
export function kiosk(): Grid {
  const g = new Grid(32, 32);
  shadow(g, 1, 28, 30, 4);
  const f = new Grid(32, 32);
  f.rect(2, 8, 28, 20, 'G').vline(2, 8, 20, 'h').vline(29, 8, 20, 'g');
  f.rect(1, 4, 30, 5, 'g').hline(1, 4, 30, 'G').rect(8, 5, 16, 3, 'r').hline(10, 6, 12, 'w');
  f.rect(5, 11, 22, 9, 'e');
  for (const [x, c] of [[6, 'r'], [10, 'n'], [14, 'y'], [18, 'h'], [22, 'N']] as const) f.rect(x, 12, 3, 7, c).set(x, 12, 'w');
  f.rect(5, 21, 22, 6, 'g').hline(5, 21, 22, 'G');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 共享单车: a rack of shared bikes, yellow and blue, handlebars all one way. */
export function bikeRack(): Grid {
  const g = new Grid(48, 24);
  shadow(g, 0, 20, 48, 4);
  const f = new Grid(48, 24);
  const bike = (x: number, c: string, d: string) => {
    f.oval(x, 12, 9, 9, 'a').oval(x + 2, 14, 5, 5, '.').oval(x + 11, 12, 9, 9, 'a').oval(x + 13, 14, 5, 5, '.');
    f.hline(x + 4, 13, 12, c).set(x + 5, 12, c).set(x + 6, 11, c).hline(x + 5, 10, 4, 'k').vline(x + 15, 8, 6, c).hline(x + 13, 8, 4, 'k');
    f.rect(x + 13, 14, 4, 2, d);
  };
  bike(0, 'y', 'Y');
  bike(14, 'n', 'B');
  bike(28, 'y', 'Y');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A small 攒尖 pavilion on 景山's ridge: a pointed roof over four red pillars on a stone base (§13 T2). */
export function smallPavilion(tiles: 'green' | 'yellow'): Grid {
  const [lt, mid, dk, deep] = tiles === 'green' ? ['i', 'h', 'G', 'g'] : ['j', 'y', 'Y', 'o'];
  const g = new Grid(32, 32);
  shadow(g, 2, 28, 28, 4);
  const f = new Grid(32, 32);
  f.rect(3, 25, 26, 4, 'd').hline(3, 25, 26, 'e').hline(3, 28, 26, 'c');
  for (const x of [6, 13, 18, 24]) f.rect(x, 16, 2, 9, 'r').vline(x, 16, 9, 'p');
  f.rect(5, 14, 22, 3, 'v').hline(5, 14, 22, 'Y').hline(5, 16, 22, 'u');
  // the pointed roof, its eaves flying up at the corners, a gold finial on top
  for (let y = 3; y < 14; y++) {
    const half = Math.round(2 + (y - 3) * 1.25);
    f.hline(16 - half, y, half * 2, (y % 3 === 0 ? dk : mid)).set(16 - half, y, lt).set(15 + half, y, deep);
  }
  f.hline(1, 13, 30, dk).set(0, 12, dk).set(31, 12, dk).set(0, 11, lt).set(31, 11, lt);
  f.rect(15, 0, 2, 3, 'y').set(15, 0, 'j');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/**
 * The Maitreya of 万福阁 (§13 T3), drawn with respect: a tall standing figure
 * in gold with a jewelled crown and a red-and-gold robe, hands in a gesture
 * of teaching, on a lotus base — so tall the camera must look up. (The real
 * one is 18 m above the floor, carved from one sandalwood trunk.)
 */
export function maitreya(): Grid {
  const g = new Grid(48, 112);
  const f = new Grid(48, 112);
  // lotus base
  f.oval(4, 100, 40, 10, 'N').oval(8, 98, 32, 8, 'p');
  for (let x = 6; x < 44; x += 6) f.oval(x, 101, 6, 5, 'N').set(x + 2, 102, 'w');
  // robe, long, falling to the base
  f.rect(12, 40, 24, 60, 'y').rect(14, 42, 20, 56, 'j');
  f.rect(10, 44, 4, 50, 'r').rect(34, 44, 4, 50, 'r');
  for (let y = 48; y < 96; y += 6) f.hline(15, y, 18, 'Y');
  f.vline(23, 42, 56, 'Y').vline(24, 42, 56, 'o');
  // shoulders and arms, the hands before the chest
  f.oval(8, 30, 32, 16, 'y').rect(8, 36, 6, 30, 'y').rect(34, 36, 6, 30, 'y');
  f.oval(17, 44, 6, 5, 'j').oval(25, 44, 6, 5, 'j').set(19, 45, 'Y').set(27, 45, 'Y');
  // a sash of red and a jewelled necklace
  f.hline(12, 38, 24, 'r').hline(13, 39, 22, 'R');
  for (let x = 14; x < 34; x += 3) f.set(x, 41, 'x').set(x + 1, 41, 'j');
  // head: a calm face, long ears, the crown
  f.oval(15, 12, 18, 20, 'j').oval(17, 15, 14, 14, 'y');
  f.hline(19, 21, 3, 'o').hline(26, 21, 3, 'o').hline(21, 26, 6, 'Y').set(24, 24, 'o');
  f.rect(13, 16, 2, 9, 'y').rect(33, 16, 2, 9, 'y');
  f.rect(15, 4, 18, 9, 'Y');
  for (let x = 16; x < 32; x += 4) f.rect(x, 2, 3, 5, 'y').set(x + 1, 3, 'r');
  f.set(23, 8, 'x').set(24, 8, 'x');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 打金钱眼: the giant coin under 白云观's 窝风桥, a little bell hanging in its square hole (§13 T3). */
export function bigCoin(): Grid {
  const g = new Grid(32, 32);
  const f = new Grid(32, 32);
  f.oval(2, 2, 28, 28, 'Y').oval(4, 4, 24, 24, 'y').oval(6, 6, 20, 20, 'Y');
  f.rect(12, 12, 8, 8, '.');
  f.rect(13, 13, 6, 5, 'o').rect(14, 14, 4, 3, 'Y').set(15, 18, 'o').set(16, 18, 'o').vline(16, 11, 2, 'm');
  for (const [x, y] of [[15, 7], [15, 23], [7, 15], [23, 15]] as const) f.rect(x, y, 2, 2, 'o');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 铛铛车: 前门大街's old-style tram, red below and cream above, its pole up to the wire (§13 T4). Seen from the side, facing west. */
export function tram(): Grid {
  const g = new Grid(48, 32);
  shadow(g, 2, 28, 44, 4);
  const f = new Grid(48, 32);
  f.rect(3, 12, 42, 15, 'r').hline(3, 12, 42, 'p').rect(3, 23, 42, 3, 'R');
  f.rect(3, 7, 42, 6, 'f').hline(3, 7, 42, 'w');
  for (let x = 6; x < 42; x += 6) f.rect(x, 8, 4, 4, 'l').set(x, 8, 'w');
  f.rect(2, 5, 44, 2, 'b').hline(2, 5, 44, 'c');
  f.vline(24, 0, 5, 'a').hline(22, 0, 5, 'a');
  for (const x of [9, 37]) f.oval(x, 25, 5, 5, 'a').set(x + 2, 27, 'c');
  f.rect(40, 14, 4, 9, 'q').rect(4, 14, 3, 9, 'q');
  f.hline(10, 18, 26, 'y');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** 书架: a wooden bookcase for your room — three shelves of books, a little pot on top (§13 B1). */
export function bookcase(): Grid {
  const g = new Grid(16, 32);
  shadow(g, 1, 29, 14);
  const f = new Grid(16, 32);
  f.rect(1, 6, 14, 24, 'M').vline(1, 6, 24, 'z').vline(14, 6, 24, 'm').hline(1, 6, 14, 'z');
  const books = ['r', 'n', 'y', 'h', 'e', 'R', 'B', 'o'];
  for (const [y, h] of [[8, 6], [15, 6], [22, 6]] as const) {
    f.rect(2, y, 12, h, 'm');
    let x = 2;
    let i = y;
    while (x < 14) {
      const w = 1 + (i % 2);
      const c = books[i % books.length]!;
      const top = y + (i % 3 === 0 ? 1 : 0);
      f.rect(x, top, w, y + h - top, c);
      x += w;
      i += 3;
    }
    f.hline(1, y + h, 14, 'z');
  }
  f.oval(5, 1, 6, 5, 'o').rect(6, 0, 4, 2, 'h').set(7, 0, 'i');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** Every kit prop: [file, note, frames] as `PROPS` has them. */
export const KIT_PROPS: Array<[string, string, () => Array<[string, Grid]>]> = [
  ['censer', 'a bronze 香炉 censer: cold, and smoking in two frames (§13 V2)', () => [['smoke-0', censer(0)], ['smoke-1', censer(1)], ['cold', censer(null)]]],
  ['prayer-wheels', '转经筒 prayer wheels in a red frame, three frames of turning (§13 V2)', () => [['turn-0', prayerWheels(0)], ['turn-1', prayerWheels(1)], ['turn-2', prayerWheels(2)]]],
  ['stele', 'a 石碑 stone tablet on its 赑屃 tortoise (§13 V2)', () => [['tortoise', stele()]]],
  ['temple-bell', 'a temple bell 钟 in its frame (§13 V2)', () => [['bronze', bell()]]],
  ['putuan', 'a 蒲团 kneeling cushion (§13 V2)', () => [['straw', putuan()]]],
  ['qiantong', 'a 签筒 cup of fortune sticks (§13 V2)', () => [['bamboo', qiantong()]]],
  ['yingbi', 'a 影壁 screen wall (§13 V2)', () => [['brick', yingbi()]]],
  ['chuihuamen', 'a 垂花门, the painted inner gate of a courtyard house (§13 V2)', () => [['painted', chuihuamen()]]],
  ['paifang', 'a glazed 琉璃牌坊 archway (§13 V2)', () => [['glazed', paifang()]]],
  ['lioness', 'a stone lioness with her cub — the lion of the pair holds a ball (§13 V2)', () => [['stone', lioness()]]],
  ['wires', 'overhead wires sagging between two poles over a 胡同 (§13 V2)', () => [['sag', wires()]]],
  ['ac-box', 'an air-conditioner box on a wall (§13 V2)', () => [['white', acBox()]]],
  ['washing-line', 'a washing line in a courtyard (§13 V2)', () => [['clothes', washingLine()]]],
  ['cabbages', '大白菜 stacked for winter (§13 V2)', () => [['stack', cabbages()]]],
  ['coal', '煤球 honeycomb briquettes (§13 V2)', () => [['stack', coal()]]],
  ['chunlian', '春联 and an upside-down 福 over a gate at 春节 (§13 V2)', () => [['gate', chunlian()]]],
  ['ads', '小广告 stuck on a wall (§13 V2)', () => [['wall', ads()]]],
  ['toilet-sign', 'a 公厕 sign (§13 V2)', () => [['blue', toiletSign()]]],
  ['grill', 'a 烤串 grill, smoke in two frames (§13 V2)', () => [['smoke-0', grill(0)], ['smoke-1', grill(1)]]],
  ['tanghulu-stand', 'a 冰糖葫芦 stand (§13 V2)', () => [['haws', tanghuluStand()]]],
  ['repair-stall', 'a 修车摊 street bike-repair stand (§13 V2, L1)', () => [['tools', repairStall()]]],
  ['kiosk', 'a newspaper kiosk 报刊亭 (§13 V2)', () => [['green', kiosk()]]],
  ['bike-rack', 'a rack of 共享单车 shared bikes (§13 V2)', () => [['shared', bikeRack()]]],
  ['bookcase', 'your 书架, a bookcase for the books you are given (§13 B1)', () => [['wood', bookcase()]]],
  ['tram', '铛铛车, the 前门大街 tram (§13 T4)', () => [['red', tram()]]],
  ['maitreya', 'the Maitreya of 万福阁, in gold on a lotus base (§13 T3)', () => [['gold', maitreya()]]],
  ['big-coin', 'the giant coin with a bell under 白云观\'s 窝风桥 (§13 T3)', () => [['bell', bigCoin()]]],
  ['pavilion-small', 'a small 攒尖 pavilion of 景山, green or yellow (§13 T2)', () => [['green', smallPavilion('green')], ['yellow', smallPavilion('yellow')]]],
];
