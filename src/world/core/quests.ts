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
import { apply, type ApplyContext } from './save';
import type { Quest, WorldSave } from './types';

/** Moves every quest on as far as its conditions allow. */
export function advanceQuests(s: WorldSave, quests: readonly Quest[], ctx: ApplyContext): WorldSave {
  let cur = s;
  // A reward can finish another quest's step, so go round until nothing moves (bounded).
  for (let round = 0; round < 10; round++) {
    const before = cur;
    for (const q of quests) {
      const st = cur.quests[q.id];
      if (!st || st.done) continue;
      const step = q.steps[st.index];
      if (!step?.done || !holds(step.done, cur)) continue;
      const next = q.steps[st.index + 1];
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
    const step = q.steps[st.index] ?? q.steps.find((x) => x.id === st.step);
    if (step) out.push({ quest: q, step });
  }
  return out.sort((a, b) => b.quest.chapter - a.quest.chapter || quests.indexOf(b.quest) - quests.indexOf(a.quest));
}

/** The companion's "What now?" in English. */
export function whatNow(s: WorldSave, quests: readonly Quest[]): string {
  const [first] = activeQuests(s, quests);
  if (first) return first.step.now;
  return 'Nothing urgent. Walk around, talk to people — someone always has a rumour.';
}
