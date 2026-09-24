import { useMemo } from 'react';
import { Link } from 'react-router';
import { collectedItems, SWEEP_BANDS, sweepOf } from '../../domain/sweep';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';

/**
 * The way into the sweep, for as long as there is something to sort.
 *
 * It sits on Review because that is where the words it sorts end up: the
 * ones you were not sure of are asked about there the same day, and the ones
 * you know come back over the next fortnight to check.
 */
export function SweepCard() {
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const collections = useStore((s) => s.collections);

  const open = useMemo(() => {
    const collected = collectedItems(collections);
    for (const b of SWEEP_BANDS) {
      const s = sweepOf(lib, b, recall, collected);
      if (s.unsorted.length) return s;
    }
    return null;
  }, [lib, recall, collections]);

  if (!open) return null;
  const sorted = open.words.length - open.unsorted.length;

  return (
    <div className="waiting-sheets">
      <Link className="waiting" to={paths.sweep(open.band)}>
        <span className="mark hanzi">词</span>
        <span className="meta">
          <b>Which HSK {open.band} words do you know?</b>
          <i>
            {sorted
              ? `${sorted} of ${open.words.length} sorted — pick up where you stopped`
              : `${open.words.length} words, a screenful at a time — about ten minutes`}
          </i>
        </span>
        <span className="go">Sort →</span>
      </Link>
    </div>
  );
}
