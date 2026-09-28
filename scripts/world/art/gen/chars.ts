/**
 * People, 16×32 with big heads in the Black/White manner: four directions,
 * a standing frame and two steps each, a dark outline, a soft shadow under
 * the feet. One drawer, many looks — hair, clothes and colours are
 * parameters, and NPC bases get palette-swap variants in their `.px`.
 */

import { Grid } from './grid';

export type Hair = 'short' | 'bald' | 'perm' | 'ponytail' | 'bun' | 'cap' | 'helmet' | 'long';

export interface Look {
  skin: [string, string];
  hair: Hair;
  /** hair (or cap / helmet) colour and its shade */
  hairC: [string, string];
  shirt: [string, string];
  pants: [string, string];
  shoes: string;
  /** a second colour on the shirt: a vest front, a stripe */
  trim?: string;
  /** shorter legs and a lower head, for a child */
  small?: boolean;
  /** a backpack (tourists) seen from behind and the side */
  pack?: string;
  /** a walking stick (the old man) */
  stick?: boolean;
}

type Dir = 'down' | 'up' | 'left';

function shadow(g: Grid) {
  g.oval(3, 28, 10, 3, '_');
}

/** Legs and shoes; `step` −1, 0, 1 moves one foot forward. */
function legs(g: Grid, look: Look, dir: Dir, step: number, top: number) {
  const [p, P] = look.pants;
  const bottom = 28;
  if (dir === 'left') {
    if (step === 0) {
      g.rect(6, top, 4, bottom - top - 1, p).vline(9, top, bottom - top - 1, P);
      g.rect(5, bottom - 1, 5, 1, look.shoes);
    } else {
      // front leg forward (to the left), back leg behind
      const f = step > 0 ? 0 : 1;
      g.rect(4 + f, top, 3, bottom - top - 1, p).rect(8 - f, top, 3, bottom - top - 2, P);
      g.rect(3 + f, bottom - 1, 4, 1, look.shoes).rect(8 - f, bottom - 2, 4, 1, look.shoes);
    }
    return;
  }
  const l = step < 0 ? -1 : 0;
  const r = step > 0 ? -1 : 0;
  g.rect(5, top, 3, bottom - top - 1 + l, p).rect(8, top, 3, bottom - top - 1 + r, p);
  g.vline(7, top, bottom - top - 1 + l, P).vline(10, top, bottom - top - 1 + r, P);
  g.rect(5, bottom - 1 + l, 3, 1, look.shoes).rect(8, bottom - 1 + r, 3, 1, look.shoes);
}

function torso(g: Grid, look: Look, dir: Dir, step: number, top: number, bottom: number) {
  const [c, C] = look.shirt;
  const [sk, SK] = look.skin;
  const armSwing = dir === 'left' ? 0 : step;
  if (dir === 'left') {
    g.rect(5, top, 6, bottom - top, c).vline(10, top, bottom - top, C);
    if (look.pack) g.rect(10, top, 3, bottom - top - 1, look.pack).vline(12, top + 1, bottom - top - 2, 'm');
    // the near arm swings forward and back
    const ax = step > 0 ? 5 : step < 0 ? 8 : 7;
    g.rect(ax, top + 1, 2, bottom - top - 2, C).rect(ax, bottom - 1, 2, 1, sk);
    if (look.trim) g.vline(5, top, bottom - top, look.trim);
    return;
  }
  g.rect(4, top, 8, bottom - top, c).vline(11, top, bottom - top, C);
  if (look.trim && dir === 'down') g.rect(7, top, 2, bottom - top, look.trim);
  if (dir === 'down') g.set(7, top, sk).set(8, top, SK);
  if (look.pack && dir === 'up') g.rect(5, top + 1, 6, bottom - top - 1, look.pack).hline(5, top + 1, 6, 'm');
  // arms at the sides, swinging opposite to the legs
  g.rect(3, top + 1 - (armSwing > 0 ? 1 : 0), 1, bottom - top - 1, C).set(3, bottom - (armSwing > 0 ? 1 : 0), sk);
  g.rect(12, top + 1 - (armSwing < 0 ? 1 : 0), 1, bottom - top - 1, C).set(12, bottom - (armSwing < 0 ? 1 : 0), sk);
}

function head(g: Grid, look: Look, dir: Dir, top: number) {
  const [sk, SK] = look.skin;
  const [h, H] = look.hairC;
  const x = 2;
  const w = 12;
  const hh = 11;
  // the skull
  g.rect(x + 1, top, w - 2, hh, sk).rect(x, top + 1, w, hh - 2, sk);
  g.vline(x + w - 1, top + 2, hh - 4, SK).hline(x + 2, top + hh - 1, w - 4, SK);
  const bald = look.hair === 'bald';
  if (dir === 'up') {
    // all hair (or all cap) from behind
    if (!bald) g.rect(x + 1, top, w - 2, hh - 1, h).rect(x, top + 1, w, hh - 3, h).vline(x + w - 1, top + 2, hh - 5, H);
    else g.rect(x + 2, top + 5, w - 4, 3, h);
  } else if (dir === 'down') {
    if (!bald) {
      g.rect(x + 1, top, w - 2, 4, h).rect(x, top + 1, w, 3, h).rect(x, top + 1, 2, 6, h).rect(x + w - 2, top + 1, 2, 6, h);
      g.hline(x + 2, top + 4, 3, h).hline(x + 7, top + 4, 2, h); // a fringe with a parting
      g.vline(x + w - 1, top + 1, 5, H).hline(x + 1, top, 4, H === h ? h : H);
    } else {
      g.rect(x, top + 4, 2, 3, h).rect(x + w - 2, top + 4, 2, 3, h);
      g.hline(x + 3, top + 1, 3, 'w'); // shine on the bald top
    }
    // eyes, blush, mouth
    g.vline(x + 3, top + 6, 2, 'k').vline(x + 8, top + 6, 2, 'k');
    g.set(x + 2, top + 8, 'N').set(x + 9, top + 8, 'N');
    g.hline(x + 5, top + 9, 2, SK);
  } else {
    // facing left: face on the left, hair behind to the right
    if (!bald) {
      g.rect(x + 3, top, w - 4, 4, h).rect(x + 6, top, w - 6, hh - 2, h).rect(x + 1, top + 1, 5, 3, h);
      g.vline(x + w - 1, top + 2, hh - 4, H);
    } else {
      g.rect(x + 7, top + 4, 4, 3, h);
    }
    g.vline(x + 2, top + 6, 2, 'k');
    g.set(x + 3, top + 8, 'N');
    g.set(x - 0, top + 7, sk); // the nose
    g.set(x + 7, top + 6, SK).set(x + 7, top + 7, SK); // the ear
  }
  // styles on top of the plain hair
  switch (look.hair) {
    case 'perm':
      for (let i = 0; i < w; i += 2) g.set(x + i, top, H).set(x + i + 1, top + 1, H);
      if (dir !== 'left') g.rect(x - 1, top + 3, 1, 4, h).rect(x + w, top + 3, 1, 4, h);
      else g.rect(x + w, top + 3, 1, 5, h);
      break;
    case 'ponytail':
      if (dir === 'up') g.rect(x + 5, top + hh - 2, 2, 5, H);
      else if (dir === 'left') g.rect(x + w, top + 3, 2, 6, h).vline(x + w + 1, top + 4, 5, H);
      else g.rect(x + w - 1, top + 4, 2, 3, H);
      break;
    case 'bun':
      g.oval(x + 4, top - 3, 5, 4, h).set(x + 5, top - 2, H);
      break;
    case 'long':
      if (dir === 'down') g.rect(x, top + 1, 2, 9, h).rect(x + w - 2, top + 1, 2, 9, h).vline(x + w - 1, top + 1, 9, H);
      else if (dir === 'left') g.rect(x + 6, top, w - 6, hh + 1, h).vline(x + w - 1, top + 2, hh - 1, H);
      else g.rect(x, top + 1, w, hh + 1, h).vline(x + w - 1, top + 2, hh - 1, H);
      break;
    case 'cap':
      g.rect(x, top, w, 3, h).hline(x + 1, top - 1, w - 2, h).hline(x, top + 2, w, H);
      if (dir === 'down') g.hline(x + 1, top + 3, w - 2, H);
      if (dir === 'left') g.hline(x - 2, top + 3, 5, H);
      break;
    case 'helmet':
      g.rect(x, top - 1, w, 5, h).hline(x + 1, top - 2, w - 2, h).hline(x, top + 3, w, H).hline(x + 3, top - 1, 3, 'w');
      break;
    default:
  }
}

function stick(g: Grid, dir: Dir) {
  if (dir === 'down') g.vline(13, 19, 10, 'M').set(13, 18, 'm');
  if (dir === 'left') g.vline(3, 19, 10, 'M').set(3, 18, 'm');
}

/** One frame. */
export function person(look: Look, dir: Dir, step: number): Grid {
  const g = new Grid(16, 32);
  shadow(g);
  const drop = look.small ? 4 : 0;
  const headTop = 5 + drop;
  const bodyTop = headTop + 11;
  const legTop = look.small ? 24 : 23;
  // Standing frames sit a pixel lower than steps: the little bob of a walk.
  const bob = step === 0 ? 0 : -1;
  const body = new Grid(16, 32);
  legs(body, look, dir, step, legTop);
  const upper = new Grid(16, 32);
  torso(upper, look, dir, step, bodyTop, legTop + (look.small ? 0 : 1));
  head(upper, look, dir, headTop);
  if (look.stick) stick(upper, dir);
  const out = body.stamp(upper.shift(0, bob === 0 ? 0 : 0), 0, 0);
  const fig = out.outline('k');
  return g.stamp(fig, 0, 0);
}

/** All twelve frames: down/up/left/right × stand, step, step. */
export function walkFrames(look: Look): Array<[string, Grid]> {
  const out: Array<[string, Grid]> = [];
  for (const dir of ['down', 'up', 'left'] as const) {
    out.push([`${dir}-0`, person(look, dir, 0)], [`${dir}-1`, person(look, dir, 1)], [`${dir}-2`, person(look, dir, -1)]);
  }
  for (const i of [0, 1, 2]) out.push([`right-${i}`, out.find(([n]) => n === `left-${i}`)![1].mirror()]);
  return out;
}

/**
 * 兔儿爷, the clay rabbit spirit, 16×16: a white rabbit face with long ears,
 * red painted lips, a golden helmet-crown, a red robe; floats with a bob.
 */
export function rabbit(bob: number, dir: Dir | 'right' = 'down'): Grid {
  const g = new Grid(16, 16);
  g.oval(4, 13, 8, 3, '_');
  const f = new Grid(16, 16);
  const y = bob;
  // long ears, pink inside
  f.rect(4, 0 + y, 2, 5, 'w').rect(10, 0 + y, 2, 5, 'w');
  if (dir !== 'up') f.vline(5, 1 + y, 3, 'N').vline(10, 1 + y, 3, 'N');
  // a round white face
  f.oval(3, 3 + y, 10, 8, 'w').vline(12, 5 + y, 4, 'e').hline(5, 10 + y, 6, 'e');
  // the golden helmet between the ears, a red plume on top
  f.rect(6, 2 + y, 4, 2, 'y').hline(6, 3 + y, 4, 'Y').set(7, 1 + y, 'r').set(8, 1 + y, 'r');
  // a red robe with a golden collar, a little flag pole at the back
  f.rect(4, 11 + y, 8, 3, 'r').vline(11, 11 + y, 3, 'R').hline(5, 11 + y, 6, 'y').set(7, 12 + y, 'Y');
  if (dir === 'up') {
    f.oval(3, 3 + y, 10, 8, 'w').vline(12, 5 + y, 4, 'e').rect(6, 2 + y, 4, 3, 'y');
    f.vline(8, 7 + y, 4, 'M').rect(8, 6 + y, 2, 2, 'r');
  } else if (dir === 'left' || dir === 'right') {
    f.vline(4, 6 + y, 2, 'k').set(3, 8 + y, 'r').set(5, 8 + y, 'N');
    f.vline(12, 5 + y, 6, 'M').rect(12, 4 + y, 2, 2, 'r');
  } else {
    f.vline(5, 6 + y, 2, 'k').vline(10, 6 + y, 2, 'k');
    f.set(7, 8 + y, 'r').set(8, 8 + y, 'r').set(7, 9 + y, 'R');
    f.set(4, 8 + y, 'N').set(11, 8 + y, 'N');
  }
  f.outline('k');
  const out = g.stamp(f, 0, 0);
  return dir === 'right' ? out.mirror() : out;
}

export const LOOKS: Record<string, { look: Look; variants?: Array<[string, Record<string, string>]>; note: string }> = {
  hero: {
    note: 'the player: a young traveller, blue jacket and a red scarf',
    look: { skin: ['s', 'S'], hair: 'short', hairC: ['H', 'k'], shirt: ['n', 'B'], pants: ['a', 'k'], shoes: 'w', trim: 'r' },
  },
  auntie: {
    note: 'an auntie: permed hair, flowered top — 王阿姨 and the other aunties',
    look: { skin: ['s', 'S'], hair: 'perm', hairC: ['H', 'b'], shirt: ['p', 'r'], pants: ['b', 'a'], shoes: 'k' },
    variants: [
      ['auntie-green', { p: 'i', r: 'h' }],
      ['auntie-purple', { p: 'N', r: 'V', H: 'c' }],
    ],
  },
  grandpa: {
    note: 'an old man: white vest, grey hair, a walking stick — the bird-cage man',
    look: { skin: ['S', 't'], hair: 'bald', hairC: ['d', 'c'], shirt: ['w', 'e'], pants: ['B', 'a'], shoes: 'k', stick: true },
    variants: [['grandpa-blue', { w: 'l', e: 'n' }]],
  },
  kid: {
    note: 'a child: red school tracksuit',
    look: { skin: ['s', 'S'], hair: 'short', hairC: ['H', 'k'], shirt: ['r', 'R'], pants: ['n', 'B'], shoes: 'w', small: true, trim: 'w' },
    variants: [['kid-blue', { r: 'n', R: 'B', n: 'a', B: 'k' }]],
  },
  woman: {
    note: 'a young woman: ponytail, cream coat — shop owners, passers-by',
    look: { skin: ['s', 'S'], hair: 'ponytail', hairC: ['M', 'm'], shirt: ['f', 'F'], pants: ['a', 'k'], shoes: 'M' },
    variants: [
      ['woman-teal', { f: 'x', F: 'v' }],
      ['woman-black', { M: 'H', m: 'k', f: 'b', F: 'a' }],
    ],
  },
  rider: {
    note: 'a delivery rider: yellow helmet and jacket',
    look: { skin: ['S', 't'], hair: 'helmet', hairC: ['y', 'Y'], shirt: ['y', 'Y'], pants: ['a', 'k'], shoes: 'k' },
    variants: [['rider-blue', { y: 'n', Y: 'B' }]],
  },
  tourist: {
    note: 'a tourist: cap and backpack',
    look: { skin: ['s', 'S'], hair: 'cap', hairC: ['r', 'R'], shirt: ['w', 'e'], pants: ['z', 'M'], shoes: 'M', pack: 'G' },
    variants: [['tourist-green', { r: 'h', R: 'G', G: 'v' }]],
  },
  uncle: {
    note: 'a working man: short hair, grey jacket — the barber, the tricycle driver, shopkeepers',
    look: { skin: ['S', 't'], hair: 'short', hairC: ['H', 'k'], shirt: ['c', 'b'], pants: ['B', 'a'], shoes: 'k' },
    variants: [
      ['uncle-apron', { c: 'w', b: 'e' }],
      ['uncle-brown', { c: 'M', b: 'm' }],
    ],
  },
};
