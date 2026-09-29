/**
 * The hero in layers (prompt §12, W1): body, face, hair, then the clothes —
 * bottom, top, shoes, hat, accessory — each drawn for the same four
 * directions × three frames on the same 16×32 box as every person in the
 * game, and stacked in an order that is data (a scarf in front going down,
 * the long hair behind the shoulders going down but over the back going up).
 *
 * Pure pixel code on palette letters (no DOM, no Phaser): the art build
 * (`scripts/world/art`) uses it for the `outfit` atlas, review sheets and the
 * static `hero` frames; the game (`engine/look.ts`) composes the player's own
 * look with it at run time, once per change of clothes.
 *
 * Garments are drawn once each in colour keys `1` (main), `2` (its shade),
 * `3` (trim) and `4` (trim shade) and recoloured by swapping the keys for a
 * colour's palette letters (`clothes.json`: `"palette": "rRyY"`).
 *
 * The geometry follows the NPC drawer (`scripts/world/art/gen/chars.ts`): a
 * 12-wide head from row 5, the body from row 16, legs from row 23, feet on
 * row 27, a soft shadow under them, and one dark outline around everything.
 */

import { Grid } from './grid';
import { colourOf } from './palette';
import type { Build, HeroLook, Outfit, Slot } from '../core/looks';

export type Dir = 'down' | 'up' | 'left';
export type Layer = 'hairBack' | 'body' | 'shoes' | 'bottom' | 'top' | 'face' | 'accessory' | 'hair' | 'hat';

/** Back to front, per direction. */
export const ORDER: Record<Dir, readonly Layer[]> = {
  down: ['hairBack', 'body', 'shoes', 'bottom', 'top', 'face', 'accessory', 'hair', 'hat'],
  left: ['hairBack', 'body', 'shoes', 'bottom', 'top', 'face', 'accessory', 'hair', 'hat'],
  // from behind: no face; a scarf's knot and a bag's strap are on top of the coat, long hair over both
  up: ['body', 'shoes', 'bottom', 'top', 'accessory', 'hair', 'hat'],
};

/** skin: [base, shade], lightest first (palette.ts) */
export const SKIN_TONES: readonly (readonly [string, string])[] = [
  ['A', 'C'],
  ['s', 'S'],
  ['S', 't'],
  ['t', 'T'],
  ['D', 'E'],
];

/** hair colour → [base, shade] */
export const HAIR_TONES: Record<string, readonly [string, string]> = {
  black: ['H', 'k'],
  dark: ['m', 'H'],
  brown: ['M', 'm'],
  chestnut: ['o', 'm'],
  red: ['R', 'q'],
  blonde: ['y', 'Y'],
  grey: ['d', 'c'],
  white: ['e', 'd'],
};

export const HEAD_TOP = 5;
export const BODY_TOP = 16;
export const LEG_TOP = 23;
export const FOOT = 27;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where each part of the body is in one frame: what every layer paints over. */
export interface Pose {
  dir: Dir;
  step: number;
  build: Build;
  /** torso rows from BODY_TOP: [from, to] inclusive x */
  torso: Array<readonly [number, number]>;
  /** arms, each with the hand's pixels below it */
  arms: Array<Rect & { hand: Rect }>;
  /** legs, each with the column the shade runs down, and the foot under it */
  legs: Array<Rect & { shade: number; foot: Rect }>;
}

export function pose(dir: Dir, step: number, build: Build): Pose {
  const slim = build === 'slim';
  const torso: Array<readonly [number, number]> = [];
  const bottom = LEG_TOP + 1;
  for (let y = BODY_TOP; y < bottom; y++) {
    // the slim build draws in at the waist
    const waist = slim && (y === 19 || y === 20) ? 1 : 0;
    if (dir === 'left') torso.push(slim ? [6, 10 - waist] : [5, 10]);
    else torso.push(slim ? [5 + waist, 10 - waist] : [4, 11]);
  }
  const arms: Pose['arms'] = [];
  if (dir === 'left') {
    const ax = step > 0 ? 5 : step < 0 ? 8 : 7;
    arms.push({ x: ax, y: BODY_TOP + 1, w: 2, h: bottom - BODY_TOP - 2, hand: { x: ax, y: bottom - 1, w: 2, h: 1 } });
  } else {
    // arms swing opposite to the legs
    const [l, r] = slim ? [4, 11] : [3, 12];
    const up = (raised: boolean) => (raised ? 1 : 0);
    const lu = up(step > 0);
    const ru = up(step < 0);
    arms.push({ x: l, y: BODY_TOP + 1 - lu, w: 1, h: bottom - BODY_TOP - 1, hand: { x: l, y: bottom - lu, w: 1, h: 1 } });
    arms.push({ x: r, y: BODY_TOP + 1 - ru, w: 1, h: bottom - BODY_TOP - 1, hand: { x: r, y: bottom - ru, w: 1, h: 1 } });
  }
  const legs: Pose['legs'] = [];
  const top = LEG_TOP;
  if (dir === 'left') {
    if (step === 0) {
      legs.push({ x: 6, y: top, w: 4, h: FOOT - top, shade: 9, foot: { x: 5, y: FOOT, w: 5, h: 1 } });
    } else {
      // the front leg forward (to the left), the back one behind and a pixel up
      const f = step > 0 ? 0 : 1;
      legs.push({ x: 8 - f, y: top, w: 3, h: FOOT - top - 1, shade: 10 - f, foot: { x: 8 - f, y: FOOT - 1, w: 4, h: 1 } });
      legs.push({ x: 4 + f, y: top, w: 3, h: FOOT - top, shade: 6 + f, foot: { x: 3 + f, y: FOOT, w: 4, h: 1 } });
    }
  } else {
    const l = step < 0 ? -1 : 0;
    const r = step > 0 ? -1 : 0;
    legs.push({ x: 5, y: top, w: 3, h: FOOT - top + l, shade: 7, foot: { x: 5, y: FOOT + l, w: 3, h: 1 } });
    legs.push({ x: 8, y: top, w: 3, h: FOOT - top + r, shade: 10, foot: { x: 8, y: FOOT + r, w: 3, h: 1 } });
  }
  return { dir, step, build, torso, arms, legs };
}

const torsoRect = (p: Pose) => {
  const xs = p.torso.flatMap(([a, b]) => [a, b]);
  return { x0: Math.min(...xs), x1: Math.max(...xs) };
};

/** Paint the torso rows `from`…`to` (absolute y) in `c`, the right edge in `C`. */
function fillTorso(g: Grid, p: Pose, c: string, C: string, from = BODY_TOP, to = LEG_TOP, grow = 0) {
  p.torso.forEach(([a, b], i) => {
    const y = BODY_TOP + i;
    if (y < from || y > to) return;
    g.hline(a - grow, y, b - a + 1 + 2 * grow, c).set(b + grow, y, C);
  });
}

/** Below the waist, a garment carries on as a skirt: `rows` rows under the torso, flaring by `flare`. */
function skirt(g: Grid, p: Pose, c: string, C: string, from: number, rows: number, flare = 0) {
  const { x0, x1 } = p.dir === 'left' ? { x0: p.build === 'slim' ? 6 : 5, x1: 10 } : { x0: 5, x1: 10 };
  for (let i = 0; i < rows; i++) {
    const y = from + i;
    const f = Math.min(flare, i + (flare ? 1 : 0));
    const a = x0 - f;
    const b = x1 + (p.dir === 'left' ? Math.min(f, 1) : f);
    g.hline(a, y, b - a + 1, c).set(b, y, C);
  }
}

// ---------------------------------------------------------------------------
// Body, face, hair
// ---------------------------------------------------------------------------

function body(g: Grid, p: Pose, sk: string, SK: string) {
  const x = 2;
  const top = HEAD_TOP;
  // the head: a rounded 12×11 block with a shade on the right and under the chin
  g.rect(x + 1, top, 10, 11, sk).rect(x, top + 1, 12, 9, sk);
  g.vline(x + 11, top + 2, 7, SK).hline(x + 2, top + 10, 8, SK);
  if (p.dir === 'left') g.set(x + 7, top + 6, SK).set(x + 7, top + 7, SK); // the ear
  // under the clothes: the torso, the arms, the legs, all skin
  fillTorso(g, p, sk, SK);
  if (p.dir === 'down') g.set(7, BODY_TOP, sk).set(8, BODY_TOP, SK);
  for (const a of p.arms) g.rect(a.x, a.y, a.w, a.h, sk).rect(a.hand.x, a.hand.y, a.hand.w, a.hand.h, sk);
  for (const l of p.legs) g.rect(l.x, l.y, l.w, l.h, sk).vline(l.shade, l.y, l.h, SK).rect(l.foot.x, l.foot.y, l.foot.w, 1, SK);
}

function face(g: Grid, p: Pose, look: HeroLook, closed: boolean, [h]: readonly [string, string], [, SK]: readonly [string, string]) {
  const top = HEAD_TOP;
  const { eyes, brows, mouth } = look.face;
  if (p.dir === 'up') return;
  if (p.dir === 'down') {
    // eyes centred on x 5 and 10, rows 11–12
    for (const ex of [5, 10]) {
      if (closed) g.hline(ex - (ex === 5 ? 1 : 0), top + 7, 2, 'k');
      else if (eyes === 'dot') g.vline(ex, top + 6, 2, 'k');
      else if (eyes === 'round') g.rect(ex === 5 ? 4 : 10, top + 6, 2, 2, 'k').set(ex === 5 ? 4 : 10, top + 6, 'w');
      else if (eyes === 'smile') g.set(ex - 1, top + 7, 'k').set(ex, top + 6, 'k').set(ex + 1, top + 7, 'k');
      else g.hline(ex === 5 ? 4 : 10, top + 7, 2, 'k');
      if (brows === 'thin') g.hline(ex === 5 ? 4 : 10, top + 5, 2, h);
      if (brows === 'thick') g.hline(ex === 5 ? 3 : 10, top + 5, 3, h);
    }
    g.set(4, top + 8, 'N').set(11, top + 8, 'N');
    if (mouth === 'smile') g.set(6, top + 8, SK).hline(7, top + 9, 2, 'q').set(9, top + 8, SK);
    else g.hline(7, top + 9, 2, SK);
    return;
  }
  // facing left: one eye near the front
  if (closed) g.hline(3, top + 7, 2, 'k');
  else if (eyes === 'dot') g.vline(4, top + 6, 2, 'k');
  else if (eyes === 'round') g.rect(3, top + 6, 2, 2, 'k').set(3, top + 6, 'w');
  else if (eyes === 'smile') g.set(3, top + 7, 'k').set(4, top + 6, 'k').set(5, top + 7, 'k');
  else g.hline(3, top + 7, 2, 'k');
  if (brows === 'thin') g.hline(3, top + 5, 2, h);
  if (brows === 'thick') g.hline(2, top + 5, 3, h);
  g.set(5, top + 8, 'N');
  g.set(2, top + 9, mouth === 'smile' ? 'q' : SK);
}

/**
 * Hair: `back` is what falls behind the shoulders (drawn before the body),
 * the rest sits on the head. Under a hat nothing grows above the hat line.
 */
function hair(g: Grid, p: Pose, style: string, [h, H]: readonly [string, string], part: 'back' | 'front', hat: boolean) {
  const x = 2;
  const top = HEAD_TOP;
  const w = 12;
  const d = p.dir;
  if (part === 'back') {
    if (d === 'down' && style === 'long') g.rect(x, top + 8, 2, 7, h).rect(x + w - 2, top + 8, 2, 7, h).vline(x + w - 1, top + 8, 7, H);
    if (d === 'left' && style === 'long') g.rect(x + 9, top + 9, 3, 6, h).vline(x + 11, top + 9, 6, H);
    return;
  }
  if (style === 'bald') {
    if (d === 'up') g.rect(x + 2, top + 5, w - 4, 3, h);
    else if (d === 'down') g.rect(x, top + 4, 2, 3, h).rect(x + w - 2, top + 4, 2, 3, h).hline(x + 3, top + 1, 3, 'w');
    else g.rect(x + 7, top + 4, 4, 3, h);
    return;
  }
  // the cap of hair every style starts from (a buzz cut is only a thin one)
  const buzz = style === 'buzz';
  if (d === 'up') {
    g.rect(x + 1, top, w - 2, buzz ? 7 : 10, h).rect(x, top + 1, w, buzz ? 5 : 8, h).vline(x + w - 1, top + 2, buzz ? 4 : 6, H);
    if (buzz) g.hline(x + 1, top + 7, w - 2, H);
  } else if (d === 'down') {
    if (buzz) {
      g.rect(x + 1, top, w - 2, 2, h).rect(x, top + 1, w, 2, h).rect(x, top + 1, 1, 5, h).rect(x + w - 1, top + 1, 1, 5, h).hline(x + 1, top, 4, H);
    } else {
      g.rect(x + 1, top, w - 2, 4, h).rect(x, top + 1, w, 3, h).rect(x, top + 1, 2, 6, h).rect(x + w - 2, top + 1, 2, 6, h);
      g.vline(x + w - 1, top + 1, 5, H).hline(x + 1, top, 4, H);
    }
  } else {
    if (buzz) g.rect(x + 3, top, w - 4, 2, h).rect(x + 7, top, w - 7, 7, h).vline(x + w - 1, top + 2, 4, H);
    else g.rect(x + 3, top, w - 4, 4, h).rect(x + 6, top, w - 6, 9, h).rect(x + 1, top + 1, 5, 3, h).vline(x + w - 1, top + 2, 7, H);
  }
  switch (style) {
    case 'short':
      if (d === 'down') g.hline(x + 2, top + 4, 3, h).hline(x + 7, top + 4, 2, h);
      break;
    case 'side':
      // swept to one side from a parting
      if (d === 'down') g.hline(x + 1, top + 4, 6, h).hline(x + 1, top + 5, 3, h).set(x + 8, top, H).set(x + 8, top + 1, H);
      if (d === 'left') g.hline(x + 1, top + 4, 4, h);
      break;
    case 'long':
      if (d === 'down') g.rect(x, top + 1, 2, 9, h).rect(x + w - 2, top + 1, 2, 9, h).vline(x + w - 1, top + 1, 9, H).hline(x + 2, top + 4, 2, h).hline(x + 8, top + 4, 2, h);
      else if (d === 'left') g.rect(x + 6, top, w - 6, 11, h).vline(x + w - 1, top + 2, 9, H);
      else g.rect(x, top + 1, w, 13, h).rect(x + 1, top + 14, w - 2, 1, h).vline(x + w - 1, top + 2, 12, H);
      break;
    case 'ponytail':
      if (d === 'up') g.rect(x + 5, top + 9, 2, 7, h).vline(x + 6, top + 9, 7, H).hline(x + 5, top + 8, 2, 'r');
      else if (d === 'left') g.rect(x + w - 1, top + 3, 2, 7, h).vline(x + w, top + 4, 6, H).set(x + w - 2, top + 3, 'r');
      else g.rect(x + w - 1, top + 5, 2, 4, H).hline(x + 3, top + 4, 6, h);
      break;
    case 'buns':
      if (!hat) {
        if (d === 'left') g.oval(x + 7, top - 3, 5, 5, h).set(x + 8, top - 2, H);
        else g.oval(x - 1, top - 2, 5, 5, h).oval(x + w - 4, top - 2, 5, 5, h).set(x + w - 2, top - 1, H).set(x, top - 1, H);
      }
      if (d === 'down') g.hline(x + 2, top + 4, 8, h);
      break;
    case 'bob':
      if (d === 'down') g.rect(x - 1, top + 2, 3, 8, h).rect(x + w - 2, top + 2, 3, 8, h).vline(x + w, top + 2, 8, H).hline(x + 2, top + 4, 4, h);
      else if (d === 'left') g.rect(x + 5, top, w - 4, 11, h).vline(x + w, top + 2, 8, H).hline(x + 1, top + 4, 3, h);
      else g.rect(x - 1, top + 2, w + 2, 9, h).vline(x + w, top + 2, 9, H);
      break;
    case 'curly':
      // a bumpy crown and wider sides
      if (!hat) for (let i = 1; i < w - 1; i += 3) g.hline(x + i, top - 1, 2, h);
      if (d === 'down') g.rect(x - 1, top + 2, 2, 7, h).rect(x + w - 1, top + 2, 2, 7, h).set(x - 1, top + 3, H).set(x + w, top + 5, H).hline(x + 2, top + 4, 8, h).set(x + 4, top + 4, H).set(x + 7, top + 4, H);
      else if (d === 'left') g.rect(x + w, top + 2, 1, 7, h).vline(x + w, top + 3, 2, H).hline(x + 1, top + 4, 4, h);
      else g.rect(x - 1, top + 2, w + 2, 9, h).vline(x + w, top + 2, 9, H);
      break;
    case 'fringe':
      // 刘海: straight bangs down to the brows
      if (d === 'down') g.rect(x + 1, top + 4, w - 2, 2, h).hline(x + 2, top + 5, 8, H);
      if (d === 'left') g.rect(x + 1, top + 4, 5, 2, h).hline(x + 1, top + 5, 4, H);
      break;
    default:
  }
}

// ---------------------------------------------------------------------------
// Clothes: each a drawer over the pose, in colour keys 1–4
// ---------------------------------------------------------------------------

type Draw = (g: Grid, p: Pose) => void;

/** Sleeves over the arms: `rows` long from the shoulder, all of it when undefined; `cuff` paints the last row in key 3. */
function sleeves(g: Grid, p: Pose, rows?: number, cuff = false, wide = false) {
  for (const a of p.arms) {
    const n = rows ?? a.h;
    g.rect(a.x, a.y, a.w, n, p.dir === 'left' ? '2' : '1');
    if (p.dir !== 'left') g.set(a.x, a.y + n - 1, '2');
    if (cuff && rows === undefined) g.rect(a.x, a.y + a.h - 1, a.w, 1, '3');
    if (wide && p.dir !== 'left') g.set(a.x + (a.x < 8 ? -1 : 1), a.y + a.h - 2, '1').set(a.x + (a.x < 8 ? -1 : 1), a.y + a.h - 1, '2');
    if (wide && p.dir === 'left') g.rect(a.x - 1, a.y + a.h - 2, a.w + 1, 2, '1');
  }
}

/** A collar at the neck: open (a V of skin), a high band, or a shirt collar in key 3. */
function collar(g: Grid, p: Pose, kind: 'open' | 'band' | 'shirt' | 'round') {
  if (p.dir === 'up') {
    if (kind === 'band' || kind === 'shirt') g.hline(6, BODY_TOP, 4, kind === 'band' ? '3' : '3');
    return;
  }
  if (p.dir === 'left') {
    if (kind === 'band') g.hline(5, BODY_TOP, 3, '3');
    if (kind === 'shirt') g.set(5, BODY_TOP, '3').set(6, BODY_TOP, '3');
    return;
  }
  if (kind === 'band') g.hline(6, BODY_TOP, 4, '3');
  if (kind === 'shirt') g.set(6, BODY_TOP, '3').set(9, BODY_TOP, '3').set(7, BODY_TOP + 1, '3');
  if (kind === 'round') g.hline(6, BODY_TOP, 4, '2');
}

const tops: Record<string, Draw> = {
  // the blue jacket the hero arrived in: a zip down the front
  jacket: (g, p) => {
    fillTorso(g, p, '1', '2');
    sleeves(g, p);
    collar(g, p, 'band');
    if (p.dir === 'down') g.vline(8, BODY_TOP + 1, 7, '2');
    fillTorso(g, p, '2', '2', LEG_TOP, LEG_TOP);
  },
  tshirt: (g, p) => {
    fillTorso(g, p, '1', '2');
    sleeves(g, p, 2);
    collar(g, p, 'round');
  },
  // a T-shirt with a little 胡同 print on the chest
  'hutong-tee': (g, p) => {
    fillTorso(g, p, '1', '2');
    sleeves(g, p, 2);
    collar(g, p, 'round');
    if (p.dir === 'down') g.rect(6, BODY_TOP + 2, 4, 3, '3').hline(6, BODY_TOP + 3, 4, '4').set(7, BODY_TOP + 2, '4');
    if (p.dir === 'up') g.rect(6, BODY_TOP + 2, 3, 2, '3');
  },
  // a tracksuit top: stripes down the sleeves, a white zip
  'track-top': (g, p) => {
    fillTorso(g, p, '1', '2');
    sleeves(g, p);
    collar(g, p, 'band');
    for (const a of p.arms) g.vline(a.x + (p.dir === 'left' ? 0 : 0), a.y, a.h - 1, '3');
    if (p.dir === 'down') g.vline(8, BODY_TOP + 1, 7, '3');
  },
  sweater: (g, p) => {
    fillTorso(g, p, '1', '2');
    sleeves(g, p, undefined, false);
    collar(g, p, 'round');
    // a knitted band across the chest and a ribbed hem
    fillTorso(g, p, '3', '4', BODY_TOP + 3, BODY_TOP + 3);
    fillTorso(g, p, '2', '2', LEG_TOP, LEG_TOP);
  },
  shirt: (g, p) => {
    fillTorso(g, p, '1', '2');
    sleeves(g, p, undefined, false);
    collar(g, p, 'shirt');
    if (p.dir === 'down') for (let y = BODY_TOP + 2; y < LEG_TOP; y += 2) g.set(8, y, '2');
  },
  // a long coat: over the hips, lapels
  coat: (g, p) => {
    fillTorso(g, p, '1', '2');
    sleeves(g, p, undefined, true);
    skirt(g, p, '1', '2', LEG_TOP + 1, 2);
    if (p.dir === 'down') g.set(6, BODY_TOP, '2').set(7, BODY_TOP + 1, '2').set(9, BODY_TOP, '2').set(8, BODY_TOP + 1, '2').vline(8, BODY_TOP + 2, 9, '2');
    if (p.dir === 'down') g.set(6, BODY_TOP + 5, '3').set(9, BODY_TOP + 5, '3');
  },
  // 羽绒服: puffy, quilted, a size bigger
  'down-jacket': (g, p) => {
    fillTorso(g, p, '1', '2', BODY_TOP, LEG_TOP, 0);
    sleeves(g, p);
    collar(g, p, 'band');
    for (let y = BODY_TOP + 2; y <= LEG_TOP; y += 2) fillTorso(g, p, '2', '2', y, y);
    skirt(g, p, '1', '2', LEG_TOP + 1, 1);
    // the puff at the shoulders
    if (p.dir !== 'left') {
      const { x0, x1 } = torsoRect(p);
      g.vline(x0 - (p.build === 'slim' ? 2 : 1), BODY_TOP + 1, 3, '1').vline(x1 + (p.build === 'slim' ? 2 : 1), BODY_TOP + 1, 3, '2');
    }
  },
  // 西装: a jacket over a white shirt and a tie
  suit: (g, p) => {
    fillTorso(g, p, '1', '2');
    sleeves(g, p);
    skirt(g, p, '1', '2', LEG_TOP + 1, 1);
    if (p.dir === 'down') g.vline(7, BODY_TOP, 3, '3').vline(8, BODY_TOP, 3, '3').vline(7, BODY_TOP + 1, 4, '4').set(8, BODY_TOP + 3, '4').set(6, BODY_TOP + 1, '2').set(9, BODY_TOP + 1, '2');
    if (p.dir === 'left') g.set(5, BODY_TOP, '3').set(5, BODY_TOP + 1, '4');
    if (p.dir === 'up') g.hline(6, BODY_TOP, 4, '3');
  },
  // 旗袍: a high collar, the closure across to the right, down to the shins with a slit
  qipao: (g, p) => {
    fillTorso(g, p, '1', '2');
    sleeves(g, p, 2);
    collar(g, p, 'band');
    skirt(g, p, '1', '2', LEG_TOP + 1, 3);
    if (p.dir === 'down') {
      g.set(8, BODY_TOP + 1, '3').set(9, BODY_TOP + 2, '3').set(10, BODY_TOP + 3, '3');
      g.set(9, BODY_TOP + 5, '4').set(6, BODY_TOP + 7, '3').set(9, BODY_TOP + 7, '3');
      g.set(10, LEG_TOP + 3, '.');
    }
    if (p.dir === 'left') g.set(5, BODY_TOP + 1, '3').set(5, BODY_TOP + 2, '3');
  },
  // 唐装: a stand-up collar, knotted buttons down the front, cuffs
  tangzhuang: (g, p) => {
    fillTorso(g, p, '1', '2');
    sleeves(g, p, undefined, true);
    collar(g, p, 'band');
    skirt(g, p, '1', '2', LEG_TOP + 1, 1);
    if (p.dir === 'down') for (let y = BODY_TOP + 1; y < LEG_TOP; y += 2) g.hline(7, y, 2, '3');
    if (p.dir === 'left') for (let y = BODY_TOP + 2; y < LEG_TOP; y += 2) g.set(5, y, '3');
  },
  // 中山装: a closed collar, four pockets, five buttons
  zhongshan: (g, p) => {
    fillTorso(g, p, '1', '2');
    sleeves(g, p);
    collar(g, p, 'band');
    skirt(g, p, '1', '2', LEG_TOP + 1, 1);
    if (p.dir === 'down') {
      for (let y = BODY_TOP + 1; y <= LEG_TOP; y += 2) g.set(8, y, '3');
      g.hline(5, BODY_TOP + 2, 2, '2').hline(9, BODY_TOP + 2, 2, '2').hline(5, BODY_TOP + 6, 2, '2').hline(9, BODY_TOP + 6, 2, '2');
    }
  },
  // 汉服: a crossed collar, wide sleeves, a sash, down to the feet
  hanfu: (g, p) => {
    fillTorso(g, p, '1', '2');
    sleeves(g, p, undefined, true, true);
    skirt(g, p, '1', '2', LEG_TOP + 1, 3, 1);
    if (p.dir === 'down') {
      g.set(6, BODY_TOP, '3').set(7, BODY_TOP + 1, '3').set(8, BODY_TOP + 2, '3').set(9, BODY_TOP + 1, '3').set(10, BODY_TOP, '3');
      fillTorso(g, p, '4', '4', BODY_TOP + 5, BODY_TOP + 5);
    }
    if (p.dir === 'left') {
      g.set(5, BODY_TOP, '3').set(6, BODY_TOP + 1, '3');
      fillTorso(g, p, '4', '4', BODY_TOP + 5, BODY_TOP + 5);
    }
    if (p.dir === 'up') fillTorso(g, p, '4', '4', BODY_TOP + 5, BODY_TOP + 5);
  },
};

/** Trousers down to the ankle over each leg (or `rows` of them: shorts), a stripe in key 3 when `stripe`. */
function trouserLegs(g: Grid, p: Pose, rows?: number, stripe = false) {
  for (const l of p.legs) {
    const n = rows ?? l.h;
    g.rect(l.x, l.y, l.w, n, '1').vline(l.shade, l.y, n, '2');
    if (stripe) g.vline(p.dir === 'left' ? l.x : l.x === 5 ? l.x : l.x + l.w - 1, l.y, n, '3');
  }
}

const bottoms: Record<string, Draw> = {
  trousers: (g, p) => trouserLegs(g, p),
  jeans: (g, p) => {
    trouserLegs(g, p);
    // a turned-up hem
    for (const l of p.legs) g.hline(l.x, l.y + l.h - 1, l.w, '3');
  },
  'track-pants': (g, p) => trouserLegs(g, p, undefined, true),
  shorts: (g, p) => trouserLegs(g, p, 2),
  skirt: (g, p) => skirt(g, p, '1', '2', LEG_TOP, 3, 1),
  'long-skirt': (g, p) => skirt(g, p, '1', '2', LEG_TOP, 4, 1),
};

const shoes: Record<string, Draw> = {
  // trainers: a stripe of key 2 at the toe
  sneakers: (g, p) => {
    for (const l of p.legs) {
      g.rect(l.foot.x, l.foot.y, l.foot.w, 1, '1');
      g.set(p.dir === 'left' ? l.foot.x : l.foot.x + (l.foot.x === 5 ? 0 : l.foot.w - 1), l.foot.y, '2');
    }
  },
  // 回力: canvas shoes, white with a red stripe up to the ankle
  huili: (g, p) => {
    for (const l of p.legs) {
      g.rect(l.foot.x, l.foot.y, l.foot.w, 1, '1');
      g.set(l.foot.x + 1, l.foot.y, '2');
      g.hline(l.x, l.foot.y - 1, l.w, '1');
    }
  },
  // 布鞋: cloth uppers on a white sole
  buxie: (g, p) => {
    for (const l of p.legs) g.rect(l.foot.x, l.foot.y, l.foot.w, 1, '1').set(p.dir === 'left' ? l.foot.x : l.foot.x + 1, l.foot.y, '2');
  },
  leather: (g, p) => {
    for (const l of p.legs) g.rect(l.foot.x, l.foot.y, l.foot.w, 1, '1').set(p.dir === 'left' ? l.foot.x : l.foot.x + l.foot.w - 1, l.foot.y, '2');
  },
};

const hats: Record<string, Draw> = {
  // 毛线帽: a knitted hat with a turned-up band and a bobble
  beanie: (g, p) => {
    g.rect(3, HEAD_TOP - 1, 10, 2, '1').rect(2, HEAD_TOP + 1, 12, 2, '1').hline(2, HEAD_TOP + 3, 12, '2').vline(13, HEAD_TOP, 3, '2');
    g.rect(p.dir === 'left' ? 9 : 7, HEAD_TOP - 3, 2, 2, '3');
  },
  // 草帽: a wide brim
  straw: (g, p) => {
    g.rect(4, HEAD_TOP - 2, 8, 4, '1').hline(4, HEAD_TOP + 1, 8, '3');
    if (p.dir === 'left') g.hline(1, HEAD_TOP + 2, 13, '2');
    else g.hline(1, HEAD_TOP + 2, 14, '2').hline(2, HEAD_TOP + 3, 12, '2');
  },
  // 鸭舌帽: a cap with a peak
  cap: (g, p) => {
    g.rect(3, HEAD_TOP - 1, 10, 2, '1').rect(2, HEAD_TOP + 1, 12, 2, '1').vline(13, HEAD_TOP, 3, '2');
    if (p.dir === 'down') g.hline(3, HEAD_TOP + 3, 10, '2');
    if (p.dir === 'left') g.hline(1, HEAD_TOP + 3, 4, '2');
    if (p.dir === 'up') g.hline(2, HEAD_TOP + 3, 12, '2');
  },
  // 礼帽: a tall hat with a band
  tophat: (g, p) => {
    g.rect(4, HEAD_TOP - 4, 8, 6, '1').vline(11, HEAD_TOP - 4, 6, '2').hline(4, HEAD_TOP, 8, '3');
    g.hline(p.dir === 'left' ? 1 : 1, HEAD_TOP + 2, 14, '2');
  },
  // 熊猫帽: white, with round black ears
  panda: (g, p) => {
    g.rect(3, HEAD_TOP - 1, 10, 2, '1').rect(2, HEAD_TOP + 1, 12, 2, '1').hline(2, HEAD_TOP + 3, 12, '2');
    if (p.dir === 'left') g.oval(7, HEAD_TOP - 4, 4, 4, '3');
    else g.oval(1, HEAD_TOP - 3, 4, 4, '3').oval(11, HEAD_TOP - 3, 4, 4, '3');
  },
  // an old flat cap (潘家园)
  flatcap: (g, p) => {
    g.rect(2, HEAD_TOP, 12, 3, '1').hline(3, HEAD_TOP - 1, 10, '1').vline(13, HEAD_TOP, 3, '2');
    if (p.dir === 'down') g.hline(3, HEAD_TOP + 3, 10, '2');
    if (p.dir === 'left') g.hline(1, HEAD_TOP + 3, 3, '2');
  },
};

const accessories: Record<string, Draw> = {
  // 围巾: round the neck, a tail hanging in front (behind, going away)
  scarf: (g, p) => {
    const { x0, x1 } = torsoRect(p);
    g.hline(x0 + 1, BODY_TOP, x1 - x0 - 1, '1').hline(x0, BODY_TOP + 1, x1 - x0 + 1, '1').set(x1, BODY_TOP + 1, '2');
    if (p.dir === 'down') g.rect(9, BODY_TOP + 2, 2, 4, '1').vline(10, BODY_TOP + 2, 4, '2').hline(9, BODY_TOP + 6, 2, '3');
    if (p.dir === 'up') g.rect(5, BODY_TOP + 2, 2, 3, '1').vline(6, BODY_TOP + 2, 3, '2');
    if (p.dir === 'left') g.rect(x0, BODY_TOP + 2, 2, 3, '1').set(x0, BODY_TOP + 5, '3');
  },
  // 丝巾: a small silk scarf knotted at the throat
  silk: (g, p) => {
    if (p.dir === 'up') return void g.hline(6, BODY_TOP, 4, '1');
    if (p.dir === 'left') return void g.hline(5, BODY_TOP, 3, '1').set(5, BODY_TOP + 1, '3');
    g.hline(6, BODY_TOP, 4, '1').set(7, BODY_TOP + 1, '3').set(8, BODY_TOP + 1, '2').set(7, BODY_TOP + 2, '1').set(8, BODY_TOP + 2, '1');
  },
  // round glasses: a ring round each eye
  glasses: (g, p) => {
    const y = HEAD_TOP + 5;
    if (p.dir === 'up') return;
    if (p.dir === 'left') return void g.rect(3, y, 3, 4, '1').rect(4, y + 1, 1, 2, '.').hline(6, y + 1, 3, '1');
    for (const ex of [5, 10]) g.rect(ex - 1, y, 3, 4, '1').rect(ex, y + 1, 1, 2, '.');
    g.hline(7, y + 1, 2, '1');
  },
  // 墨镜: dark lenses
  sunglasses: (g, p) => {
    const y = HEAD_TOP + 6;
    if (p.dir === 'up') return;
    if (p.dir === 'left') return void g.rect(2, y, 3, 2, '1').hline(5, y, 4, '2');
    g.rect(3, y, 4, 2, '1').rect(9, y, 4, 2, '1').hline(7, y, 2, '2').set(4, y, '3').set(10, y, '3');
  },
  // 帆布包: a canvas bag on a strap across the body
  bag: (g, p) => {
    if (p.dir === 'down') {
      for (let i = 0; i < 7; i++) g.set(5 + i, BODY_TOP + i, '2');
      g.rect(12, LEG_TOP - 2, 3, 4, '1').vline(14, LEG_TOP - 2, 4, '2').set(13, LEG_TOP - 1, '3');
    } else if (p.dir === 'up') {
      for (let i = 0; i < 7; i++) g.set(10 - i, BODY_TOP + i, '2');
      g.rect(1, LEG_TOP - 2, 3, 4, '1').vline(3, LEG_TOP - 2, 4, '2').set(2, LEG_TOP - 1, '3');
    } else {
      g.vline(8, BODY_TOP, 5, '2').rect(9, LEG_TOP - 3, 3, 4, '1').vline(11, LEG_TOP - 3, 4, '2').set(10, LEG_TOP - 2, '3');
    }
  },
};

/** Every garment drawing by the `clothes.json` id it belongs to, and how many colour keys it uses. */
export const GARMENT_ART: Record<string, { slot: Slot; keys: number; draw: Draw }> = {
  ...Object.fromEntries(Object.entries(tops).map(([k, d]) => [k, { slot: 'top' as const, keys: keysOf(d), draw: d }])),
  ...Object.fromEntries(Object.entries(bottoms).map(([k, d]) => [k, { slot: 'bottom' as const, keys: keysOf(d), draw: d }])),
  ...Object.fromEntries(Object.entries(shoes).map(([k, d]) => [k, { slot: 'shoes' as const, keys: keysOf(d), draw: d }])),
  ...Object.fromEntries(Object.entries(hats).map(([k, d]) => [k, { slot: 'hat' as const, keys: keysOf(d), draw: d }])),
  ...Object.fromEntries(Object.entries(accessories).map(([k, d]) => [k, { slot: 'accessory' as const, keys: keysOf(d), draw: d }])),
};

/** The highest colour key a drawer uses in any frame (so a colour must give that many letters). */
function keysOf(d: Draw): number {
  let n = 0;
  for (const dir of ['down', 'up', 'left'] as const) {
    for (const step of [0, 1, -1]) {
      for (const build of ['broad', 'slim'] as const) {
        const g = new Grid(16, 32);
        d(g, pose(dir, step, build));
        for (const row of g.rows) for (const c of row) if (c >= '1' && c <= '4') n = Math.max(n, Number(c));
      }
    }
  }
  return n;
}

/** A garment as the composer takes it: which drawing, in which palette letters. */
export interface Worn {
  art: string;
  /** letters for keys 1, 2, 3, 4 in order */
  palette: string;
}

export type WornOutfit = Partial<Record<Slot, Worn>>;

const recolour = (g: Grid, palette: string) => g.swap(Object.fromEntries([...palette].map((c, i) => [String(i + 1), c])));

/** One layer of one frame, on its own (for the atlas and the checks). */
export function layerFrame(layer: Layer, look: HeroLook, worn: WornOutfit, dir: Dir, step: number, closed = false): Grid {
  const g = new Grid(16, 32);
  const p = pose(dir, step, look.build);
  const skin = SKIN_TONES[look.skin] ?? SKIN_TONES[1]!;
  const hairTone = HAIR_TONES[look.hair.colour] ?? HAIR_TONES.black!;
  const slotOf: Partial<Record<Layer, Slot>> = { top: 'top', bottom: 'bottom', shoes: 'shoes', hat: 'hat', accessory: 'accessory' };
  if (layer === 'body') body(g, p, skin[0], skin[1]);
  else if (layer === 'face') face(g, p, look, closed, hairTone, skin);
  else if (layer === 'hair' || layer === 'hairBack') hair(g, p, look.hair.style, hairTone, layer === 'hair' ? 'front' : 'back', !!worn.hat);
  else {
    const w = worn[slotOf[layer]!];
    const art = w && GARMENT_ART[w.art];
    if (art) {
      art.draw(g, p);
      recolour(g, w.palette);
    }
  }
  return g;
}

/** One whole frame: the layers stacked in the direction's order, then the outline and the shadow. */
export function heroFrame(look: HeroLook, worn: WornOutfit, dir: Dir, step: number, closed = false): Grid {
  const fig = new Grid(16, 32);
  for (const layer of ORDER[dir]) {
    const l = layerFrame(layer, look, worn, dir, step, closed);
    // a hat sits on the head: no hair shows above its top line
    if (layer === 'hair' && worn.hat) for (let y = 0; y < HEAD_TOP - 1; y++) l.hline(0, y, 16, '.');
    fig.stamp(l, 0, 0);
  }
  // Nothing drawn in a key colour survives a missing palette letter: those are left out rather than drawn wrong.
  fig.where((_x, _y, c) => c >= '1' && c <= '9', '.');
  fig.outline('k');
  const out = new Grid(16, 32);
  out.oval(3, 28, 10, 3, '_');
  return out.stamp(fig, 0, 0);
}

/** The frame names every person in the game has (the scene only swaps the texture, W1). */
export const FRAME_NAMES = ['down-0', 'down-1', 'down-2', 'up-0', 'up-1', 'up-2', 'left-0', 'left-1', 'left-2', 'right-0', 'right-1', 'right-2', 'down-blink'] as const;

/** All thirteen frames: down/up/left × stand, step, step; right mirrored from left; a blink. */
export function heroFrames(look: HeroLook, worn: WornOutfit): Array<[string, Grid]> {
  const out: Array<[string, Grid]> = [];
  for (const dir of ['down', 'up', 'left'] as const) {
    out.push([`${dir}-0`, heroFrame(look, worn, dir, 0)], [`${dir}-1`, heroFrame(look, worn, dir, 1)], [`${dir}-2`, heroFrame(look, worn, dir, -1)]);
  }
  for (const i of [0, 1, 2]) out.push([`right-${i}`, out.find(([n]) => n === `left-${i}`)![1].mirror()]);
  out.push(['down-blink', heroFrame(look, worn, 'down', 0, true)]);
  return out;
}

/** An outfit's `item:colour` ids as drawings, given each id's palette (unknown ids are left off). */
export function wornOf(outfit: Outfit, palette: (id: string) => string | undefined): WornOutfit {
  const out: WornOutfit = {};
  for (const [slot, id] of Object.entries(outfit) as Array<[Slot, string]>) {
    const art = id.split(':')[0]!;
    const pal = palette(id);
    if (GARMENT_ART[art] && pal) out[slot] = { art, palette: pal };
  }
  return out;
}

/** Today's hero's clothes as drawings, without the content (the art build and tests). */
export const DEFAULT_WORN: WornOutfit = {
  top: { art: 'jacket', palette: 'nBB' },
  bottom: { art: 'trousers', palette: 'ak' },
  shoes: { art: 'sneakers', palette: 'we' },
  accessory: { art: 'scarf', palette: 'rRy' },
};

/** A grid's pixels as RGBA, row by row (for a canvas's ImageData, or a PNG). */
export function toRgba(g: Grid): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(g.w * g.h * 4));
  g.rows.forEach((row, y) =>
    row.forEach((ch, x) => {
      const c = colourOf(ch);
      if (c) out.set(c, (y * g.w + x) * 4);
    }),
  );
  return out;
}
