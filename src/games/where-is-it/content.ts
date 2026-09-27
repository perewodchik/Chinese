import type { SyllabusWord } from '../../data/types';
import { wordId } from '../../domain/ids';
import { pictureWords } from '../kit/pool';
import type { TileOption } from '../kit/Tiles';
import type { GameContext } from '../types';

/**
 * 在哪儿 — where is it? Place words, done with the hands.
 *
 * 「猫在桌子下面。」 and a cat to drag there. Most prompts are drags: the
 * drop is checked against zones worked out from the anchor's box, so 下面
 * means between the legs of the table and 旁边 means close beside it, not
 * anywhere on the left half of the screen. 前面 and 后面 cannot be dragged
 * on a flat picture, so those come the other way round: the scene is already
 * arranged, the cat half hidden behind the bed or big in front of it, and the
 * question is which sentence says so.
 */

export type AnchorId = 'table' | 'bed' | 'home';

export interface Anchor {
  id: AnchorId;
  w: string;
  py: string;
  /** its box on the stage, as shares of the stage: x, y (top), width, height */
  box: { x: number; y: number; w: number; h: number };
}

export const ANCHORS: Record<AnchorId, Anchor> = {
  table: { id: 'table', w: '桌子', py: 'zhuōzi', box: { x: 0.32, y: 0.46, w: 0.36, h: 0.34 } },
  bed: { id: 'bed', w: '床', py: 'chuáng', box: { x: 0.28, y: 0.5, w: 0.44, h: 0.3 } },
  home: { id: 'home', w: '家', py: 'jiā', box: { x: 0.32, y: 0.22, w: 0.36, h: 0.6 } },
};

/** A place word, and the anchors it can be said of. */
export interface Place {
  w: string;
  py: string;
  /** the relation it means */
  rel: 'on' | 'under' | 'in' | 'out' | 'left' | 'right' | 'beside' | 'front' | 'behind';
  anchors: AnchorId[];
}

/** HSK 1 has the short forms; HSK 2 the ones with 面 and 边, and the sides. */
export const PLACES: Place[] = [
  { w: '上', py: 'shàng', rel: 'on', anchors: ['table', 'bed'] },
  { w: '下', py: 'xià', rel: 'under', anchors: ['table', 'bed'] },
  { w: '里', py: 'lǐ', rel: 'in', anchors: ['home'] },
  { w: '外边', py: 'wàibian', rel: 'out', anchors: ['home'] },
  { w: '上面', py: 'shàngmian', rel: 'on', anchors: ['table', 'bed'] },
  { w: '下面', py: 'xiàmian', rel: 'under', anchors: ['table', 'bed'] },
  { w: '里面', py: 'lǐmian', rel: 'in', anchors: ['home'] },
  { w: '外面', py: 'wàimian', rel: 'out', anchors: ['home'] },
  { w: '旁边', py: 'pángbiān', rel: 'beside', anchors: ['table', 'bed', 'home'] },
  { w: '左边', py: 'zuǒbian', rel: 'left', anchors: ['table', 'bed', 'home'] },
  { w: '右边', py: 'yòubian', rel: 'right', anchors: ['table', 'bed', 'home'] },
  { w: '前面', py: 'qiánmian', rel: 'front', anchors: ['table', 'bed'] },
  { w: '后面', py: 'hòumian', rel: 'behind', anchors: ['table', 'bed'] },
];

/** Things small enough to put anywhere, with a photo. */
const MOVERS = new Set(['猫', '狗', '苹果', '书', '杯子', '手机', '鸟', '球', '书包', '鸡蛋', '手表', '笔']);

/**
 * Where a drop at `p` (shares of the stage) is, relative to an anchor: every
 * relation it satisfies. Generous enough for a finger, strict enough that the
 * answer means something.
 */
export function zonesOf(p: { x: number; y: number }, a: Anchor): Set<Place['rel']> {
  const { x, y, w, h } = a.box;
  const out = new Set<Place['rel']>();
  const overX = p.x >= x - 0.04 && p.x <= x + w + 0.04;
  const level = p.y >= y - 0.25 && p.y <= y + h + 0.12;
  if (a.id === 'home') {
    const inside = p.x > x && p.x < x + w && p.y > y + h * 0.3 && p.y < y + h;
    if (inside) out.add('in');
    else out.add('out');
  } else {
    // on: on or just above the top; under: below the top, between the legs
    if (overX && p.y < y + h * 0.18 && p.y > y - 0.3) out.add('on');
    if (p.x > x + 0.02 && p.x < x + w - 0.02 && p.y > y + h * 0.3 && p.y < y + h + 0.1) out.add('under');
  }
  if (level && p.x < x) out.add('left');
  if (level && p.x > x + w) out.add('right');
  if (level && ((p.x < x && p.x > x - 0.24) || (p.x > x + w && p.x < x + w + 0.24))) out.add('beside');
  return out;
}

export interface DragRound {
  kind: 'drag';
  mover: SyllabusWord;
  anchor: Anchor;
  place: Place;
}

export interface PickRound {
  kind: 'pick';
  mover: SyllabusWord;
  anchor: Anchor;
  place: Place;
  right: string;
  options: TileOption[];
}

export type WhereRound = DragRound | PickRound;

export const ROUNDS = 8;

export const placesAt = (ctx: GameContext) => PLACES.filter((p) => ctx.words.some((w) => w.w === p.w));

export const movers = (ctx: GameContext) => pictureWords(ctx, (w) => MOVERS.has(w.w));

/** 左边 and 右边 take 的 after a noun (在床的右边); the others do not (在桌子下面). */
const de = (p: Place) => p.rel === 'left' || p.rel === 'right';

export const sentence = (r: { mover: SyllabusWord; anchor: Anchor; place: Place }) =>
  `${r.mover.w}在${r.anchor.w}${de(r.place) ? '的' : ''}${r.place.w}。`;
export const sentencePy = (r: { mover: SyllabusWord; anchor: Anchor; place: Place }) =>
  `${r.mover.py} zài ${r.anchor.py}${de(r.place) ? ' de ' : ' '}${r.place.py}`;

export function buildWhere(ctx: GameContext, n = ROUNDS): WhereRound[] {
  const places = placesAt(ctx);
  const draggable = places.filter((p) => p.rel !== 'front' && p.rel !== 'behind');
  const depth = places.filter((p) => p.rel === 'front' || p.rel === 'behind');
  const ms = movers(ctx);
  const out: WhereRound[] = [];
  let last = '';
  for (let i = 0; out.length < n && i < n * 10; i++) {
    const mover = ms[i % ms.length];
    // one prompt in four is a sentence to pick, when there are depth words
    if (depth.length && out.length % 4 === 3) {
      const place = ctx.rng.pick(depth);
      const anchor = ANCHORS[ctx.rng.pick(place.anchors)];
      const others = places.filter((p) => p.rel !== place.rel && p.anchors.includes(anchor.id));
      const wrong = ctx.rng.sample(others, 2);
      const r = { mover, anchor, place };
      out.push({
        kind: 'pick',
        ...r,
        right: sentence(r),
        options: ctx.rng
          .shuffle([place, ...wrong])
          .map((p) => ({ id: sentence({ ...r, place: p }), label: sentence({ ...r, place: p }), body: null })),
      });
      continue;
    }
    const place = ctx.rng.pick(draggable);
    if (place.w === last) continue;
    last = place.w;
    out.push({ kind: 'drag', mover, anchor: ANCHORS[ctx.rng.pick(place.anchors)], place });
  }
  return out;
}

export const itemsOf = (r: WhereRound) => [wordId(r.mover.w), wordId(r.anchor.w), wordId(r.place.w)];

/** Where a thing goes to show a relation: for the answer, and for the picked scenes. */
export function spotFor(rel: Place['rel'], a: Anchor): { x: number; y: number; scale: number; behind?: boolean } {
  const { x, y, w, h } = a.box;
  switch (rel) {
    case 'on':
      return { x: x + w / 2, y: y - 0.08, scale: 1 };
    case 'under':
      return { x: x + w / 2, y: y + h * 0.66, scale: 0.9 };
    case 'in':
      return { x: x + w / 2, y: y + h * 0.72, scale: 0.8 };
    case 'out':
    case 'left':
      return { x: Math.max(0.1, x - 0.13), y: y + h * 0.7, scale: 1 };
    case 'right':
    case 'beside':
      return { x: Math.min(0.9, x + w + 0.13), y: y + h * 0.7, scale: 1 };
    case 'front':
      return { x: x + w * 0.62, y: y + h * 0.78, scale: 1.25 };
    case 'behind':
      return { x: x + w * 0.38, y: y - 0.02, scale: 0.72, behind: true };
  }
}
