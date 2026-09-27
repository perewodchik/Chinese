import { wordId } from '../../domain/ids';
import { count, countPy, plain, plainPy } from '../kit/numbers';
import type { TileOption } from '../kit/Tiles';
import type { GameContext } from '../types';

/**
 * 几点了 — reading a clock in Chinese.
 *
 * Hours and half hours at HSK 1 (三点, 三点半, 两点 — never 二点), minutes in
 * fives on top of that at HSK 2 (三点十五分, 三点零五分), and at HSK 2 the part
 * of the day too, told by a sun or a moon beside the clock (上午, 下午, 晚上).
 * The wrong answers are the mistakes people make: the hands swapped, the hour
 * one off, the half hour read as the hour.
 */

export interface Time {
  h: number; // 1–12
  m: number; // 0–55, in fives
  /** 0 morning, 1 afternoon, 2 evening — only asked at HSK 2 */
  part: 0 | 1 | 2;
}

export const PARTS = [
  { zh: '上午', py: 'shàngwǔ', en: 'morning' },
  { zh: '下午', py: 'xiàwǔ', en: 'afternoon' },
  { zh: '晚上', py: 'wǎnshang', en: 'evening' },
] as const;

export function say(t: Time, withPart: boolean): string {
  const hour = `${count(t.h)}点`;
  const min = t.m === 0 ? '' : t.m === 30 ? '半' : `${t.m < 10 ? '零' : ''}${plain(t.m)}分`;
  return `${withPart ? PARTS[t.part].zh : ''}${hour}${min}`;
}

export function sayPy(t: Time, withPart: boolean): string {
  const hour = `${countPy(t.h)} diǎn`;
  const min = t.m === 0 ? '' : t.m === 30 ? ' bàn' : ` ${t.m < 10 ? 'líng ' : ''}${plainPy(t.m)} fēn`;
  return `${withPart ? `${PARTS[t.part].py} ` : ''}${hour}${min}`;
}

export interface ClockRound {
  time: Time;
  withPart: boolean;
  right: string;
  options: TileOption[];
}

export const ROUNDS = 8;

const same = (a: Time, b: Time, part: boolean) => a.h === b.h && a.m === b.m && (!part || a.part === b.part);

function randomTime(ctx: GameContext, band: 1 | 2): Time {
  const h = 1 + ctx.rng.int(12);
  const m = band === 1 ? (ctx.rng.int(2) ? 30 : 0) : 5 * ctx.rng.int(12);
  // the part of the day has to fit the hour: 下午 is not at 11
  const part: Time['part'] = h >= 7 && h <= 11 ? 0 : h === 12 || h <= 5 ? 1 : 2;
  return { h, m, part };
}

function distractors(ctx: GameContext, t: Time, withPart: boolean): Time[] {
  const out: Time[] = [];
  const add = (x: Time) => {
    if (!same(x, t, withPart) && !out.some((o) => same(o, x, withPart))) out.push(x);
  };
  const minuteAsHour = Math.round(t.m / 5) || 12;
  // the hands swapped
  add({ ...t, h: minuteAsHour, m: t.h === 12 ? 0 : t.h * 5 });
  // an hour off either way
  add({ ...t, h: (t.h % 12) + 1 });
  add({ ...t, h: ((t.h + 10) % 12) + 1 });
  // the half hour misread
  add({ ...t, m: t.m === 30 ? 0 : 30 });
  if (withPart) add({ ...t, part: ((t.part + 1) % 3) as Time['part'] });
  return ctx.rng.sample(out, 3);
}

export function buildClock(ctx: GameContext, n = ROUNDS): ClockRound[] {
  const withPart = ctx.band === 2;
  const rounds: ClockRound[] = [];
  const used = new Set<string>();
  while (rounds.length < n) {
    const time = randomTime(ctx, ctx.band);
    const right = say(time, withPart);
    if (used.has(right)) continue;
    used.add(right);
    const options = ctx.rng
      .shuffle([time, ...distractors(ctx, time, withPart)])
      .map((x) => ({ id: say(x, withPart), label: say(x, withPart), body: null }));
    rounds.push({ time, withPart, right, options });
  }
  return rounds;
}

export const itemsOf = (r: ClockRound) => [
  wordId('点'),
  ...(r.time.m === 30 ? [wordId('半')] : r.time.m ? [wordId('分')] : []),
  ...(r.withPart ? [wordId(PARTS[r.time.part].zh)] : []),
];
