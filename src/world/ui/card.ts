/**
 * What the game's card on /play says (concept §13, E7): which banner to
 * show, the one progress line, and where you stopped — from the save, or
 * "Start" when there is none yet.
 */

import { dayOf, formatTime, partOfDay } from '../core/clock';
import { dateZh, festivalOf, weatherOf } from '../core/calendar';
import { districtInfo } from '../core/districts';
import type { PartOfDay, WorldSave } from '../core/types';

/** the main story's spirits, one per chapter (concept §3): 石狮子 九尾狐 门神 麒麟 貔貅 年兽 龙 */
export const STORY_SPIRITS = 7;

export interface CardView {
  started: boolean;
  time: PartOfDay;
  chapter: number;
  spirits: number;
  idioms: number;
  stamps: number;
  /** 鼓楼 · 南锣鼓巷 · 9月6日 7:40 */
  where: string;
  /** today's snow on the banner, and a festival's name beside the label (X4) */
  snow: boolean;
  festival: string | null;
}

/** A save counts as begun once anything has happened in it: a step, a talk, a scene. */
export const begun = (s: WorldSave) => s.updatedAt > 0 && (s.scenes.length > 0 || s.flags.length > 0 || Object.keys(s.npcs).length > 0 || s.districts.length > 0 || s.clock > 7 * 60);

/** The card's view of a save; `null` is a game not begun. */
export function cardView(s: WorldSave | null, now: Date = new Date()): CardView {
  if (!s || !begun(s)) {
    // Before a first game the banner follows the real clock.
    const t = now.getHours() * 60 + now.getMinutes();
    return { started: false, time: partOfDay(t), chapter: 1, spirits: 0, idioms: 0, stamps: 0, where: '', snow: false, festival: null };
  }
  const place = districtInfo(s.district)?.name ?? '北京';
  return {
    started: true,
    time: partOfDay(s.clock),
    chapter: s.chapter,
    spirits: Object.keys(s.spirits).length,
    idioms: Object.keys(s.idioms).length,
    stamps: Object.keys(s.stamps).length,
    where: `${place} · ${dateZh(dayOf(s.clock))} ${formatTime(s.clock)}`,
    snow: weatherOf(dayOf(s.clock)) === 'snow',
    festival: festivalOf(dayOf(s.clock))?.zh ?? null,
  };
}

/** Of the device's copy and the server's, the one changed last. */
export const later = (a: WorldSave | null, b: WorldSave | null): WorldSave | null => (!a ? b : !b ? a : b.updatedAt > a.updatedAt ? b : a);
