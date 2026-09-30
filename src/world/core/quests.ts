/**
 * Quests move on by themselves: after every change to the save, each quest
 * under way checks whether its current step's `done` condition now holds,
 * and if so moves to the next step (or finishes and gives its reward). A
 * scene can also move a quest on directly with a `quest` action.
 *
 * "What now?" — the companion's answer — is the current step's `now` text
 * for the most recent quest of the highest chapter still under way.
 */

import { holds } from './flags';
import { apply, stepIndexOf, type ApplyContext } from './save';
import type { Quest, WorldSave } from './types';

/**
 * Every quest's stored `index` brought up to date with the content (§13 S1):
 * a chapter deepened after the save was made has new steps before the one
 * the save is at — they count as done, and the save keeps its step. A
 * finished quest sits on its last step. Returns the same save when nothing
 * changes.
 */
export function reindexQuests(s: WorldSave, quests: readonly Quest[]): WorldSave {
  let out: WorldSave['quests'] | null = null;
  for (const q of quests) {
    const st = s.quests[q.id];
    if (!st || !q.steps.length) continue;
    const index = st.done ? q.steps.length - 1 : stepIndexOf(q, st);
    const step = st.done ? q.steps[index]!.id : st.step;
    if (index === st.index && step === st.step) continue;
    out ??= { ...s.quests };
    out[q.id] = { ...st, index, step };
  }
  return out ? { ...s, quests: out } : s;
}

/**
 * A main chapter written after the save went past it (§13 S1: 5 香火 and
 * 9 过年 came between chapters an old save had played) opens now, at its
 * first step, beside the chapter under way. Every main quest is started by
 * the one before it, so one of a lower chapter than the save's that never
 * started can only be such a newcomer. Its reward cannot take the save
 * back: chapters and quests only move forward.
 */
export function openMissedChapters(s: WorldSave, quests: readonly Quest[], ctx: ApplyContext): WorldSave {
  let cur = s;
  for (const q of quests) {
    if (q.kind === 'main' && q.chapter < cur.chapter && !cur.quests[q.id] && q.steps[0]) cur = apply(cur, { do: 'quest', quest: q.id, step: q.steps[0].id }, ctx);
  }
  return cur;
}

/** Moves every quest on as far as its conditions allow (after bringing an older save up to the content: `reindexQuests`, `openMissedChapters`). */
export function advanceQuests(s: WorldSave, quests: readonly Quest[], ctx: ApplyContext): WorldSave {
  let cur = openMissedChapters(reindexQuests(s, quests), quests, ctx);
  // A reward can finish another quest's step, so go round until nothing moves (bounded).
  for (let round = 0; round < 10; round++) {
    const before = cur;
    for (const q of quests) {
      const st = cur.quests[q.id];
      if (!st || st.done) continue;
      const i = stepIndexOf(q, st);
      const step = q.steps[i];
      if (!step?.done || !holds(step.done, cur)) continue;
      const next = q.steps[i + 1];
      if (next) cur = apply(cur, { do: 'quest', quest: q.id, step: next.id }, ctx);
      else {
        cur = apply(cur, { do: 'quest_done', quest: q.id }, ctx);
        for (const a of q.reward ?? []) cur = apply(cur, a, ctx);
      }
    }
    if (cur === before) break;
  }
  return cur;
}

export interface Now {
  quest: Quest;
  step: Quest['steps'][number];
}

/** The quests under way, most important first: higher chapter, then the one started later in the list. */
export function activeQuests(s: WorldSave, quests: readonly Quest[]): Now[] {
  const out: Now[] = [];
  for (const q of quests) {
    const st = s.quests[q.id];
    if (!st || st.done) continue;
    const step = q.steps[stepIndexOf(q, st)];
    if (step) out.push({ quest: q, step });
  }
  return out.sort((a, b) => b.quest.chapter - a.quest.chapter || quests.indexOf(b.quest) - quests.indexOf(a.quest));
}

/**
 * The companion's "What now?" in English: the quest the player follows in
 * the journal (§10 J2) while it is under way, else the story's current
 * step, else the most important quest under way.
 */
export function whatNow(s: WorldSave, quests: readonly Quest[]): string {
  const active = activeQuests(s, quests);
  const first = active.find((a) => a.quest.id === s.tracked?.quest) ?? active.find((a) => a.quest.kind === 'main') ?? active[0];
  if (first) return first.step.now;
  return 'Nothing urgent. Walk around, talk to people — someone always has a rumour.';
}
