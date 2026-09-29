/**
 * The game's calendar and weather (prompt X4).
 *
 * One game day stands for one week of the year, so the festivals come round
 * every few sessions: day 1 is the first week of September, 中秋 is two
 * days later, 国庆 two after that, and the whole year turns in 52 game days.
 * Weather is drawn from the day number by the season — the same on every
 * device, so nothing about it needs saving or merging.
 */

import { dayOf } from './clock';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow' | 'wind';
export type FestivalId = 'chunjie' | 'yuanxiao' | 'duanwu' | 'qixi' | 'zhongqiu' | 'guoqing';

/** the week of the year (0-based) game day 1 stands for: early September */
export const START_WEEK = 35;
export const WEEKS = 52;

export interface Festival {
  id: FestivalId;
  zh: string;
  en: string;
  /** the week of the year it falls in (the lunar ones on a typical year) */
  week: number;
}

export const FESTIVALS: readonly Festival[] = [
  { id: 'chunjie', zh: '春节', en: 'Spring Festival', week: 5 },
  { id: 'yuanxiao', zh: '元宵节', en: 'Lantern Festival', week: 7 },
  { id: 'duanwu', zh: '端午节', en: 'Dragon Boat Festival', week: 23 },
  { id: 'qixi', zh: '七夕', en: 'Qixi, the lovers’ festival', week: 32 },
  { id: 'zhongqiu', zh: '中秋节', en: 'Mid-Autumn Festival', week: 37 },
  { id: 'guoqing', zh: '国庆节', en: 'National Day', week: 39 },
];

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** The week of the year a game day stands for. */
export const weekOf = (day: number) => (((START_WEEK + day - 1) % WEEKS) + WEEKS) % WEEKS;

/** The date shown for a game day: the Wednesday of its week. */
export function dateOf(day: number): { month: number; date: number } {
  let doy = weekOf(day) * 7 + 3;
  let month = 0;
  while (doy >= MONTH_DAYS[month]!) doy -= MONTH_DAYS[month++]!;
  return { month: month + 1, date: doy + 1 };
}

export function seasonOf(day: number): Season {
  const { month } = dateOf(day);
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}

export const festivalOf = (day: number): Festival | null => FESTIVALS.find((f) => f.week === weekOf(day)) ?? null;

/** A number in [0, 1) from the day, the same everywhere. */
function roll(day: number): number {
  let h = 0x811c9dc5 ^ day;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/** How likely each weather is in each season (the rest is clear). */
const ODDS: Record<Season, readonly [Weather, number][]> = {
  winter: [['snow', 0.3], ['wind', 0.15], ['cloudy', 0.15]],
  spring: [['wind', 0.3], ['rain', 0.15], ['cloudy', 0.15]],
  summer: [['rain', 0.35], ['cloudy', 0.15]],
  autumn: [['wind', 0.2], ['rain', 0.1], ['cloudy', 0.15]],
};

export function weatherOf(day: number): Weather {
  // the first days of a new game are clear, so the story starts in the sun
  if (day <= 2) return 'clear';
  // festivals are dry, except 春节, which likes a little snow
  const f = festivalOf(day);
  if (f) return f.id === 'chunjie' ? 'snow' : 'clear';
  let r = roll(day);
  for (const [w, p] of ODDS[seasonOf(day)]) {
    if (r < p) return w;
    r -= p;
  }
  return 'clear';
}

export const WEATHER_ZH: Record<Weather, string> = { clear: '晴', cloudy: '阴', rain: '雨', snow: '雪', wind: '风' };
export const WEATHER_ICON: Record<Weather, string> = { clear: '☀', cloudy: '☁', rain: '☂', snow: '❄', wind: '🌬' };
export const WEATHER_EN: Record<Weather, string> = { clear: 'clear', cloudy: 'cloudy', rain: 'rain', snow: 'snow', wind: 'windy' };

/** Everything about a moment of the game clock. */
export function today(clock: number) {
  const day = dayOf(clock);
  return { day, ...dateOf(day), season: seasonOf(day), festival: festivalOf(day), weather: weatherOf(day) };
}

/** 「9月3日」 */
export const dateZh = (day: number) => {
  const d = dateOf(day);
  return `${d.month}月${d.date}日`;
};

/** What the engine draws falling from the sky for a weather. */
export const skyOf = (w: Weather): 'none' | 'rain' | 'snow' => (w === 'rain' || w === 'snow' ? w : 'none');
