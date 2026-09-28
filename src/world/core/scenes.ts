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

export function sceneFor(scenes: readonly Scene[], save: WorldSave, who: { npc?: string; look?: string; zone?: string; map?: string; use?: string }): Scene | null {
  const fits = scenes.filter((s) => {
    // a scene for a used item answers only to that item; plain talk and looking never start it
    if ((s.use ?? undefined) !== who.use) return false;
    if (who.npc !== undefined && !(s.trigger === 'talk' && s.npc === who.npc)) return false;
    // a look scene belongs to an object on its own map: `object` (or its id) names it
    if (who.look !== undefined && !(s.trigger === 'look' && (s.object ?? s.id) === who.look && (who.map === undefined || s.map === who.map))) return false;
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
