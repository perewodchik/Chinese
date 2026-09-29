/**
 * Where the task in hand is (prompt §9⅞ M3): the maps the followed quest's
 * step is waiting on — the tracked quest, else the story's current step
 * (§10 J2). A thin wrapper around the journal's `stepMaps`: a scene to play
 * (its map), a station to reach, a person to meet, the step's own `where`.
 * Only what is not yet true counts.
 */

import { stepMaps, trackedQuest } from './journal';
import type { Shop } from './shop';
import type { NpcCard, Quest, Scene, WorldSave } from './types';

export function goalMaps(s: WorldSave, quests: readonly Quest[], scenes: readonly Scene[], npcs: readonly NpcCard[], shops?: readonly Shop[]): string[] {
  const t = trackedQuest(s, quests);
  return t ? stepMaps(t.step, { scenes, npcs, ...(shops ? { shops } : {}) }, s) : [];
}
