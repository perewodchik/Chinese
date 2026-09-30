/**
 * What the street sounds like where you are (prompt G1): a pure answer from
 * the map's life and the part of the day, so the synth only plays it.
 * Pigeon whistles (鸽哨) over the lanes by day, bicycle bells where bikes go,
 * a murmur of people as busy as the map, the chime in stations.
 */

import type { Season } from '../core/calendar';
import type { MapLife } from '../core/maptext';
import type { PartOfDay } from '../core/types';

export interface Mix {
  /** 0–1, the murmur of people */
  crowd: number;
  /** seconds between pigeon whistles overhead, 0 for none */
  pigeonsEvery: number;
  /** seconds between bicycle bells, 0 for none */
  bellsEvery: number;
  /** a station: the chime when you arrive, and in the train */
  station: boolean;
  /** §13 N1: the city's own sounds here now — seconds between each, by kind */
  sounds: Partial<Record<CitySound, number>>;
  /** §13 N1: the street's voices here now (吆喝, a loudspeaker, a rider): shown as a caption when heard */
  voices: CityVoice[];
}

export const SILENT: Mix = { crowd: 0, pigeonsEvery: 0, bellsEvery: 0, station: false, sounds: {}, voices: [] };

/** §13 N1: what is happening in the city at this moment (the page knows the calendar; the mix stays pure). */
export interface CityTime {
  /** 0–23 */
  hour: number;
  season: Season;
  festival: string | null;
}

export function mixFor(mapId: string, life: MapLife, time: PartOfDay, when?: CityTime): Mix {
  const station = mapId.startsWith('station-');
  const night = time === 'night';
  const indoors = !station && life.crowd === 0 && life.pigeons === 0 && life.bikes === 0;
  const city = when ? cityOf(mapId, !indoors && !station, when) : { sounds: {}, voices: [] };
  if (indoors) return { ...SILENT, crowd: 0.08, ...city };
  const people = Math.min(1, life.crowd / 10);
  return {
    crowd: station ? 0.35 : Math.max(0.05, people * (night ? 0.35 : time === 'evening' ? 0.9 : 0.7)),
    // the flocks fly by day; more pigeons, more often
    pigeonsEvery: !station && life.pigeons > 0 && !night && time !== 'evening' ? Math.max(18, 60 - life.pigeons * 5) : 0,
    bellsEvery: !station && life.bikes > 0 && !night ? Math.max(12, 40 - life.bikes * 8) : 0,
    station,
    ...city,
  };
}

// ---------------------------------------------------------------------------
// §13 N1 — voices of the city
// ---------------------------------------------------------------------------

/** The city's sounds without words (`audio/city.ts` makes each on the spot). */
export type CitySound = 'muyu' | 'jingju' | 'mahjong' | 'dance' | 'cicadas' | 'crows' | 'firecrackers';

export interface CityVoice {
  id: string;
  /** what is called out, as the caption shows it (tap a word: the word drawer) */
  zh: string;
  en: string;
  /** who, in a word or two */
  who: string;
  /** about this many seconds between two */
  every: number;
}

/** 胡同 and the lanes round them: the knife grinder, the recycler, a 京剧 radio, 麻将 at night. */
export const HUTONGS: ReadonlySet<string> = new Set(['hutong-home', 'siheyuan-yard', 'nanluo-main', 'yandai-xiejie', 'gulou-dongdajie', 'subway-lane']);
/** the busy streets: the 糖葫芦 seller, the sweet-potato stove, riders and scooters */
export const STREETS: ReadonlySet<string> = new Set(['nanluo-main', 'yandai-xiejie', 'houhai-lake', 'wangfujing-street', 'qianmen-street', 'dashilar', 'gulou-dongdajie', 'subway-lane', 'yonghegong-street', 'sanlitun-street']);
/** temples where monks chant and the 木鱼 keeps time (雍和宫, and the Daoist 白云观 and 东岳庙) */
export const TEMPLES: ReadonlySet<string> = new Set(['yonghegong-front', 'yonghegong-wanfuge', 'baiyunguan', 'dongyuemiao']);
/** squares and parks where the 广场舞 dancers gather in the evening */
export const DANCE_SQUARES: ReadonlySet<string> = new Set(['gulou-square', 'tiantan-park', 'ditan', 'olympic-park', 'jingshan-park', 'beihai-north']);

/** The street cries and loudspeakers (N1): real Beijing calls, said in the game's own voices. */
export const CITY_VOICES = {
  tanghulu: { id: 'tanghulu', zh: '冰糖葫芦——', en: 'Candied haws on a stick!', who: '卖糖葫芦的', every: 90 },
  modao: { id: 'modao', zh: '磨剪子嘞——戗菜刀——', en: 'Scissors to grind — kitchen knives to sharpen!', who: '磨刀的', every: 150 },
  huishou: { id: 'huishou', zh: '高价回收旧冰箱、旧彩电、旧手机……', en: 'Top prices for old fridges, old TVs, old phones…', who: '收破烂儿的喇叭', every: 80 },
  hongshu: { id: 'hongshu', zh: '热乎的烤红薯！', en: 'Hot roast sweet potatoes!', who: '卖红薯的', every: 100 },
  baozi: { id: 'baozi', zh: '包子，热乎的！', en: 'Buns — piping hot!', who: '早点铺', every: 70 },
  waimai: { id: 'waimai', zh: '您的外卖到了！', en: 'Your delivery is here!', who: '外卖小哥', every: 120 },
  daoche: { id: 'daoche', zh: '请注意，倒车。', en: 'Caution — reversing.', who: '电动车', every: 140 },
} as const satisfies Record<string, CityVoice>;

const between = (h: number, from: number, to: number) => (from <= to ? h >= from && h < to : h >= from || h < to);

/** What the city sounds like on this map at this hour, season and festival (N1). */
export function cityOf(mapId: string, outdoors: boolean, w: CityTime): { sounds: Mix['sounds']; voices: CityVoice[] } {
  const sounds: Mix['sounds'] = {};
  const voices: CityVoice[] = [];
  const h = w.hour;
  const V = CITY_VOICES;
  if (TEMPLES.has(mapId) && between(h, 6, 17)) sounds.muyu = 26;
  if (HUTONGS.has(mapId)) {
    if (between(h, 9, 18)) sounds.jingju = 70;
    if (between(h, 19, 24)) sounds.mahjong = 45;
    if (between(h, 7, 12) && mapId !== 'siheyuan-yard') voices.push(V.huishou);
    if (between(h, 9, 17) && (mapId === 'hutong-home' || mapId === 'nanluo-main')) voices.push(V.modao);
  }
  if (STREETS.has(mapId)) {
    if (w.season !== 'summer' && between(h, 10, 21) && mapId !== 'subway-lane' && mapId !== 'gulou-dongdajie') voices.push(V.tanghulu);
    if (w.season === 'winter' && between(h, 10, 20)) voices.push(V.hongshu);
    if (between(h, 11, 13) || between(h, 17, 20)) voices.push(V.waimai);
    if (between(h, 8, 20)) voices.push(V.daoche);
  }
  if ((mapId === 'nanluo-main' || mapId === 'zaodian') && between(h, 6, 10)) voices.push(V.baozi);
  if (DANCE_SQUARES.has(mapId) && between(h, 18, 21)) sounds.dance = 1;
  if (outdoors) {
    if (w.season === 'summer' && between(h, 10, 19)) sounds.cicadas = 20;
    if (w.season === 'winter' && between(h, 16, 19)) sounds.crows = 35;
    // 春节 and 元宵: a few bursts in the evening — not all night
    if ((w.festival === 'chunjie' || w.festival === 'yuanxiao') && between(h, 18, 24)) sounds.firecrackers = 50;
  }
  return { sounds, voices };
}

/** Seconds until the next such sound: around `every`, never the same twice (±40 %). */
export const nextIn = (every: number, rand: () => number) => every * (0.6 + rand() * 0.8);

/**
 * The 鼓楼's drum shows (§13 V3, facts.md `gulou-drum-times`): the drummers
 * play for visitors several times a day — about 9:30, 10:30, 11:30, 13:30,
 * 14:30, 15:30 and a last show near 16:30 (the times shift by season).
 */
export const DRUM_SHOWS: readonly number[] = [9 * 60 + 30, 10 * 60 + 30, 11 * 60 + 30, 13 * 60 + 30, 14 * 60 + 30, 15 * 60 + 30, 16 * 60 + 30];

/** Whether the drums start at this game minute. */
export const isDrumShow = (minute: number) => DRUM_SHOWS.includes(((minute % 1440) + 1440) % 1440);
