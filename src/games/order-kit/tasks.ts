import type { Rng } from '../kit/rng';
import type { Band } from '../types';
import type { Brand, Task, Want } from './types';

const itemsOf = (wants: Want[]) => wants.flatMap((w) => (w.kind === 'line' ? [w.item] : []));

/**
 * The orders of one game, rising in level: band 1 stays at levels 1–2, band 2
 * uses 2–3, and table service ends band 2 on a level-4 meal (§3.3). Each
 * order comes from a hand-written template whose slots are filled from the
 * menu, so every task can be ordered with the menu it is for. No template is
 * used twice in a game, and orders avoid repeating an item where they can.
 */
export function levelsFor(band: Band, n: number, table = false): (1 | 2 | 3 | 4)[] {
  const plan: (1 | 2 | 3 | 4)[] = band === 1 ? [1, 2, 2, 2] : table ? [2, 3, 3, 4] : [2, 3, 3, 3];
  return plan.slice(0, n);
}

export function buildTasks(brand: Brand, rng: Rng, band: Band, n: number): Task[] {
  const used = new Set<string>();
  const seen = new Set<string>();
  let extra = false;
  const out: Task[] = [];
  for (const wanted of levelsFor(band, n, brand.model === 'table')) {
    // a level the brand has no template left for falls back to the one below
    for (let level = wanted; level >= 1; level--) {
      const pool = rng.shuffle(brand.templates.filter((t) => t.level === level && !used.has(t.id) && !(extra && t.extra)));
      let done = false;
      for (const t of pool) {
        let made: ReturnType<typeof t.build> = null;
        for (let k = 0; k < 6; k++) {
          const m = t.build({ brand, int: rng.int, pick: rng.pick, sample: rng.sample });
          if (!m) continue;
          made = m;
          if (!itemsOf([...m.wants, ...(m.later?.wants ?? [])]).some((i) => seen.has(i))) break;
        }
        if (!made) continue;
        used.add(t.id);
        if (t.extra) extra = true;
        itemsOf([...made.wants, ...(made.later?.wants ?? [])]).forEach((i) => seen.add(i));
        out.push({ ...made, level: level as Task['level'], template: t.id });
        done = true;
        break;
      }
      if (done) break;
    }
  }
  return out;
}
