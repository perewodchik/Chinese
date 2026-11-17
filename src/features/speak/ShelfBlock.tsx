import { useState, type ReactNode } from 'react';
import type { Source } from './sources';

/** How many of a shelf's texts are listed before All. */
const FOLD = 4;

/**
 * One shelf's texts to say. A long shelf shows four, starting from the first
 * not yet said to its end, and the rest behind All: thirty texts each marked
 * "New" put the one wanted a long way down the page.
 */
export function ShelfBlock({ name, list, row, done }: { name: string; list: Source[]; row: (s: Source) => ReactNode; done: (s: Source) => boolean }) {
  const [all, setAll] = useState(false);
  const fold = list.length > FOLD + 1;
  const first = list.findIndex((s) => !done(s));
  const from = Math.max(0, Math.min(first < 0 ? 0 : first, list.length - FOLD));
  return (
    <section className="block">
      <div className="block-head">
        <h2 className={`block-title${/\p{Script=Han}/u.test(name) ? ' hanzi ph-shelf' : ''}`}>{name}</h2>
        <span className="spacer" />
        {fold && (
          <button className="btn quiet sm" aria-expanded={all} onClick={() => setAll((a) => !a)}>
            {all ? 'Fewer' : `All ${list.length}`}
          </button>
        )}
      </div>
      <div className="list">{(fold && !all ? list.slice(from, from + FOLD) : list).map(row)}</div>
    </section>
  );
}
