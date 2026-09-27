import { wordId } from '../../domain/ids';
import type { TileOption } from '../kit/Tiles';
import type { GameContext } from '../types';

/**
 * 颜色 — 「红色的苹果」: paint the apple the colour the words say.
 *
 * The one place in the app where colour is the content. The pots carry no
 * labels — reading 红色 is the whole point — and the colours are fixed,
 * not theme tokens, because a red apple is red in the dark too.
 */

export const COLOURS = [
  { w: '红色', py: 'hóngsè', hex: '#c8392b' },
  { w: '绿色', py: 'lǜsè', hex: '#3f9142' },
  { w: '白色', py: 'báisè', hex: '#ffffff' },
  { w: '黑色', py: 'hēisè', hex: '#1d1b19' },
] as const;

export const THINGS = [
  { w: '苹果', py: 'píngguǒ' },
  { w: '车', py: 'chē' },
  { w: '猫', py: 'māo' },
  { w: '花', py: 'huā' },
  { w: '杯子', py: 'bēizi' },
  { w: '鱼', py: 'yú' },
] as const;

export type Colour = (typeof COLOURS)[number];
export type Thing = (typeof THINGS)[number];

export interface ColourRound {
  thing: Thing;
  colour: Colour;
  right: string;
  options: TileOption[];
}

export const ROUNDS = 8;

export const coloursAt = (ctx: GameContext) => COLOURS.filter((c) => ctx.words.some((w) => w.w === c.w));
export const thingsAt = (ctx: GameContext) => THINGS.filter((t) => ctx.words.some((w) => w.w === t.w));

export function buildColours(ctx: GameContext, n = ROUNDS): ColourRound[] {
  const colours = coloursAt(ctx);
  const things = thingsAt(ctx);
  const out: ColourRound[] = [];
  let last = '';
  while (out.length < n) {
    const colour = ctx.rng.pick(colours);
    const thing = ctx.rng.pick(things);
    const key = colour.w + thing.w;
    if (key === last) continue;
    last = key;
    out.push({
      thing,
      colour,
      right: colour.w,
      options: ctx.rng.shuffle(colours).map((c) => ({ id: c.w, label: c.w, body: null })),
    });
  }
  return out;
}

export const phrase = (r: ColourRound) => `${r.colour.w}的${r.thing.w}`;
export const itemsOf = (r: ColourRound) => [wordId(r.colour.w), wordId(r.thing.w)];
