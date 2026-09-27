import type { Rng } from '../kit/rng';
import type { Band } from '../types';
import type { Brand, Task, Want } from './types';

const itemsOf = (wants: Want[]) => wants.flatMap((w) => (w.kind === 'line' ? [w.item] : []));

/**
 * The orders of one game, rising in level: band 1 stays at levels 1–2, band 2
 * uses 2–3 (§3.3). Each comes from a hand-written template whose slots are
 * filled from the menu, so every task can be ordered with the menu it is for.
 * No template is used twice in a game.
 */
export function levelsFor(band: Band, n: number): (1 | 2 | 3)[] {
  const plan: (1 | 2 | 3)[] = band === 1 ? [1, 2, 2, 2] : [2, 3, 3, 3];
  return plan.slice(0, n);
}

export function buildTasks(brand: Brand, rng: Rng, band: Band, n: number): Task[] {
  const used = new Set<string>();
  const seen = new Set<string>();
  const out: Task[] = [];
  for (const level of levelsFor(band, n)) {
    const pool = rng.shuffle(brand.templates.filter((t) => t.level === level && !used.has(t.id)));
    for (const t of pool) {
      // a few tries for an order about things the earlier orders were not
      let made: ReturnType<typeof t.build> = null;
      for (let k = 0; k < 6; k++) {
        const m = t.build({ brand, int: rng.int, pick: rng.pick, sample: rng.sample });
        if (!m) continue;
        made = m;
        if (!itemsOf(m.wants).some((i) => seen.has(i))) break;
      }
      if (!made) continue;
      used.add(t.id);
      itemsOf(made.wants).forEach((i) => seen.add(i));
      out.push({ ...made, level, template: t.id });
      break;
    }
  }
  return out;
}
