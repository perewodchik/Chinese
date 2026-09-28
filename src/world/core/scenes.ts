/**
 * Which scene plays when you talk to someone or look at something.
 *
 * Of the scenes for that person (or that sign) whose `when` holds now, and
 * that are not a `once` scene already played, the one with the lowest
 * `priority` wins; ties go to the one written first. When none fits, the
 * person makes small talk (the page draws a line from their card).
 */

import { holds } from './flags';
import type { Scene, WorldSave } from './types';

export function sceneFor(scenes: readonly Scene[], save: WorldSave, who: { npc?: string; look?: string; zone?: string }): Scene | null {
  const fits = scenes.filter((s) => {
    if (who.npc !== undefined && !(s.trigger === 'talk' && s.npc === who.npc)) return false;
    if (who.look !== undefined && !(s.trigger === 'look' && s.id === who.look)) return false;
    if (who.zone !== undefined && !(s.trigger === 'zone' && s.id === who.zone)) return false;
    if (s.once && save.scenes.includes(s.id)) return false;
    return holds(s.when, save);
  });
  if (!fits.length) return null;
  return fits.reduce((a, b) => ((b.priority ?? 0) < (a.priority ?? 0) ? b : a));
}

/** The scene that starts by itself on arriving somewhere (trigger `auto`), if any. */
export function autoScene(scenes: readonly Scene[], save: WorldSave, map: string): Scene | null {
  const fits = scenes.filter((s) => s.trigger === 'auto' && s.map === map && !save.scenes.includes(s.id) && holds(s.when, save));
  return fits.length ? fits.reduce((a, b) => ((b.priority ?? 0) < (a.priority ?? 0) ? b : a)) : null;
}
