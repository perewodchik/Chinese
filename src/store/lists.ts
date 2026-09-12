/**
 * List changes that stay correct when they are replayed on top of somebody
 * else's changes — which every change to a workspace may be (see sync/engine).
 */

/** `current` with whatever in `added` it does not have yet, in the order given — the same array when that is nothing. */
export function appendNew<T>(current: T[], added: readonly T[]): T[] {
  const seen = new Set(current);
  const fresh: T[] = [];
  for (const item of added) {
    if (seen.has(item)) continue;
    seen.add(item);
    fresh.push(item);
  }
  return fresh.length ? [...current, ...fresh] : current;
}

/**
 * `wanted` is the order the screen showed when a card was dropped. Anything
 * that has left the list since is skipped, and anything added since — on
 * another device, say — keeps a place at the end: a drag must not delete what
 * it could not see.
 */
export function reorderKeeping<T>(current: readonly T[], wanted: readonly T[]): T[] {
  const present = new Set(current);
  const placed = new Set<T>();
  const out: T[] = [];
  for (const item of wanted) {
    if (!present.has(item) || placed.has(item)) continue;
    placed.add(item);
    out.push(item);
  }
  for (const item of current) if (!placed.has(item)) out.push(item);
  return out;
}
