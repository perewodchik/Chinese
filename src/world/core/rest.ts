/**
 * Waiting without walking in circles (§13 Q2). A 20-minute learner should
 * not spend five of them pacing until 中秋 or until evening:
 *
 * - the bed offers 「睡到中秋节」 (or a date) when the step you follow — or the
 *   story's — can only happen on a later day: a festival, a season, the
 *   weather, "tomorrow";
 * - a step that waits for an hour says so ("after 17:00"), and where there is
 *   a seat (a teahouse, a stool, a park) you can wait there.
 *
 * Pure: the page builds the bed's talk from `bedScene` and the chip's button
 * from `stepWait`.
 */

import { dateOf, festivalOf } from './calendar';
import { dayOf, MINUTES_PER_DAY } from './clock';
import { holds } from './flags';
import { trackedQuest, type JournalContent } from './journal';
import { activeQuests } from './quests';
import { sceneMoves } from './sidequests';
import type { Condition, MapObject, Quest, QuestStep, Scene, WorldSave } from './types';

/** The steps worth waiting for: the one followed, and the story's. */
function stepsFollowed(s: WorldSave, quests: readonly Quest[]): { quest: Quest; step: QuestStep }[] {
  const out: { quest: Quest; step: QuestStep }[] = [];
  const t = trackedQuest(s, quests);
  if (t) out.push(t);
  const main = activeQuests(s, quests).find((a) => a.quest.kind === 'main');
  if (main && main.quest.id !== t?.quest.id) out.push(main);
  return out;
}

/** The conditions a step waits on: its scenes' `when`s (a scene that moves it) and its own `done`. */
function waitsOn(step: QuestStep, quest: Quest, scenes: readonly Scene[]): Condition[] {
  const own = scenes.filter((sc) => sceneMoves(sc, quest, step)).map((sc) => sc.when).filter((c): c is Condition => !!c);
  return own;
}

const leaves = (c: Condition): Condition[] => ('all' in c ? c.all.flatMap(leaves) : 'any' in c ? c.any.flatMap(leaves) : [c]);
/** a wait of days: a festival, a season, the weather, once a day */
const dayish = (c: Condition) =>
  leaves(c).some((x) => 'festival' in x || 'season' in x || 'weather' in x || 'daily' in x || 'fresh' in x || ('not' in x && ('daily' in x.not || 'fresh' in x.not)));

const at = (s: WorldSave, day: number, hour: number): WorldSave => ({ ...s, clock: (day - 1) * MINUTES_PER_DAY + hour * 60 });
const HOURS = [7, 9, 12, 15, 18, 21];

export interface SleepTarget {
  /** the game day to wake on, at 7:00 */
  day: number;
  /** 「睡到中秋节」 — what you say to sleep till then */
  zh: string;
  en: string;
}

/**
 * The first later day the step you follow (or the story's) can happen on,
 * when it cannot today — a festival, a season, the weather, "not again
 * today". Only past tomorrow: tomorrow is what plain 睡觉 already does.
 */
export function sleepTarget(s: WorldSave, content: Pick<JournalContent, 'quests' | 'scenes'>): SleepTarget | null {
  const today = dayOf(s.clock);
  for (const { quest, step } of stepsFollowed(s, content.quests)) {
    const conds = waitsOn(step, quest, content.scenes);
    if (!conds.length || conds.some((c) => holds(c, s)) || !conds.some(dayish)) continue;
    for (let d = today + 1; d <= today + 52; d++) {
      if (!conds.some((c) => HOURS.some((h) => holds(c, at(s, d, h))))) continue;
      if (d === today + 1) return null;
      const fest = festivalOf(d);
      if (fest && conds.some((c) => leaves(c).some((x) => 'festival' in x && x.festival === fest.id))) {
        return { day: d, zh: `睡到${fest.zh}`, en: `Sleep till ${fest.zh} (${fest.en})` };
      }
      const { month, date } = dateOf(d);
      return { day: d, zh: `睡到${month}月${date}号`, en: `Sleep till ${month}月${date}号 — the day it can happen` };
    }
  }
  return null;
}

/** The bed's talk: plain 睡觉, and 「睡到…」 when a later day is what you wait for. Said, as everything else. */
export function bedScene(base: Scene, target: SleepTarget | null): Scene {
  if (!target) return base;
  const a = base.nodes.find((n) => n.id === base.start)!;
  return {
    ...base,
    id: `${base.id}-until`,
    nodes: [
      {
        ...a,
        say: `睡觉吗？还是${target.zh}？`,
        translate: `Go to sleep? Or ${target.en.replace(/^Sleep/, 'sleep')}?`,
        expect: [
          { intent: 'until', match: [['睡到', target.zh.slice(2)]], go: 'u', actions: [{ do: 'sleep', until: target.day }] },
          ...(a.expect ?? []),
        ],
        hint: { word: target.zh, frame: '我要___。', full: `我要${target.zh}。` },
      },
      { id: 'u', say: '好，睡吧。', translate: 'Right — sleep.', speaker: 'hero' },
      ...base.nodes.filter((n) => n.id !== base.start),
    ],
  };
}

// --- waiting for an hour -----------------------------------------------------------

export interface StepWait {
  /** the hour it can happen from */
  from: number;
  /** "after 17:00" */
  text: string;
}

/** The hour the step you follow waits for, when that is all it waits for now (not a day away). */
export function stepWait(s: WorldSave, content: Pick<JournalContent, 'quests' | 'scenes'>): StepWait | null {
  const t = trackedQuest(s, content.quests);
  if (!t) return null;
  const conds = waitsOn(t.step, t.quest, content.scenes);
  if (!conds.length || conds.some((c) => holds(c, s))) return null;
  const today = dayOf(s.clock);
  const now = Math.floor((s.clock % MINUTES_PER_DAY) / 60);
  // the first hour later today (or early tomorrow) when one of its scenes could start
  for (let h = now + 1; h < now + 24; h++) {
    const day = h >= 24 ? today + 1 : today;
    const hour = h % 24;
    if (conds.some((c) => holds(c, at(s, day, hour)))) return { from: hour, text: `after ${hour}:00` };
  }
  return null;
}

/** Somewhere to sit and let the hours pass: a teahouse, a stool or a table, a park bench. */
const SEATS = /^(stool|tea-table|table|bench|barber-chair)\//;
const PARKS = new Set(['tiantan-park', 'jingshan-park', 'beihai-north', 'olympic-park', 'houhai-lake', 'yiheyuan-changlang', 'gulou-square']);
export function canWaitHere(map: string, objects: readonly MapObject[]): boolean {
  return PARKS.has(map) || objects.some((o) => o.kind === 'prop' && SEATS.test(o.frame));
}
