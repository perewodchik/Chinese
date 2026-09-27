import { wordId } from '../../domain/ids';
import type { TileOption } from '../kit/Tiles';
import type { GameContext } from '../types';

/**
 * 一家人 — a family around 我: who is who.
 *
 * Grandparents on top (HSK 2), parents, then 我 among brothers and sisters —
 * the older ones taller and on the left, the younger ones shorter and on the
 * right, which is the whole difference between 哥哥 and 弟弟.
 */

export interface Person {
  w: string;
  py: string;
  en: string;
  /** where in the drawing: generation row, and position along it */
  row: 0 | 1 | 2;
  x: number;
  sex: 'm' | 'f';
  /** drawn height, 0–1 */
  tall: number;
  old?: boolean;
}

export const PEOPLE: Person[] = [
  { w: '爷爷', py: 'yéye', en: "dad's dad", row: 0, x: 0.36, sex: 'm', tall: 0.92, old: true },
  { w: '奶奶', py: 'nǎinai', en: "dad's mum", row: 0, x: 0.64, sex: 'f', tall: 0.86, old: true },
  { w: '爸爸', py: 'bàba', en: 'dad', row: 1, x: 0.36, sex: 'm', tall: 1 },
  { w: '妈妈', py: 'māma', en: 'mum', row: 1, x: 0.64, sex: 'f', tall: 0.93 },
  { w: '哥哥', py: 'gēge', en: 'older brother', row: 2, x: 0.1, sex: 'm', tall: 0.9 },
  { w: '姐姐', py: 'jiějie', en: 'older sister', row: 2, x: 0.3, sex: 'f', tall: 0.82 },
  { w: '我', py: 'wǒ', en: 'me', row: 2, x: 0.5, sex: 'm', tall: 0.72 },
  { w: '弟弟', py: 'dìdi', en: 'younger brother', row: 2, x: 0.7, sex: 'm', tall: 0.58 },
  { w: '妹妹', py: 'mèimei', en: 'younger sister', row: 2, x: 0.9, sex: 'f', tall: 0.52 },
];

export interface FamilyRound {
  person: Person;
  right: string;
  options: TileOption[];
}

export const ROUNDS = 6;

export const peopleAt = (ctx: GameContext) =>
  PEOPLE.filter((p) => p.w === '我' || ctx.words.some((w) => w.w === p.w));

export function buildFamily(ctx: GameContext, n = ROUNDS): FamilyRound[] {
  const here = peopleAt(ctx).filter((p) => p.w !== '我');
  return ctx.rng
    .shuffle(here)
    .slice(0, n)
    .map((person) => {
      // wrong answers from the same row first: that is where they get confused
      const near = here.filter((p) => p.w !== person.w && p.row === person.row);
      const far = here.filter((p) => p.w !== person.w && p.row !== person.row);
      const others = [...ctx.rng.shuffle(near), ...ctx.rng.shuffle(far)].slice(0, 3);
      return {
        person,
        right: person.w,
        options: ctx.rng.shuffle([person, ...others]).map((p) => ({ id: p.w, label: p.w, body: null })),
      };
    });
}

export const itemsOf = (r: FamilyRound) => [wordId(r.person.w)];
