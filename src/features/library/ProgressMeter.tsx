import { useMemo } from 'react';
import { isClaimOnly } from '../../domain/memory';
import { bandName, progressOf } from '../../domain/progress';
import { wordBands } from '../../domain/wordProgress';
import { useOpenProgress } from '../../navigation/progressDrawer';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';

/**
 * Where you are on the whole syllabus, in the bar across the top.
 *
 * It reads the position off what you have learned, not off the band the
 * Library happens to be filtered to: one segment per band, and the numbers for
 * the lowest band you have not finished. That band's segment is drawn wide,
 * because it is the one that moves this week; the others stay as short marks
 * that say how far off they are, or turn green when they are done.
 *
 * Inside the segment, learned is two shades. Ticking a character is a claim;
 * getting it right in a review is evidence. The solid part is what a review
 * has confirmed, the pale part what is still only believed — so a morning of
 * ticking shows as pale, and turns solid as the reviews come round.
 *
 * Tapping it opens the rest of the picture (ProgressDrawer) over the page you
 * are on, rather than taking you away from it.
 */
export function ProgressMeter() {
  const lib = useLibrary();
  const learned = useStore((s) => s.learned);
  const recall = useStore((s) => s.recall);
  const sheets = useStore((s) => s.sheets);
  const open = useOpenProgress();

  const { bands: chars, learned: charTotal } = useMemo(
    () => progressOf(lib, recall, learned, sheets, Date.now()),
    [lib, recall, learned, sheets],
  );
  // A band is its characters and its words: both fill its segment, and the
  // numbers say which is which. A word ticked is believed; answered, proven.
  const words = useMemo(() => wordBands(lib, recall, (r) => Boolean(r) && !isClaimOnly(r)), [lib, recall]);
  const bands = chars.map((b, i) => ({
    ...b,
    size: b.size + words[i]!.size,
    done: b.done + words[i]!.done,
    proven: b.proven + words[i]!.proven,
  }));
  const current = bands.find((b) => b.size && b.done < b.size) ?? null;
  const total = charTotal + words.reduce((n, w) => n + w.done, 0);
  const cur = current ? { c: chars[current.band - 1]!, w: words[current.band - 1]! } : null;

  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
  const label = current
    ? `${bandName(current.band)}: ${cur!.c.done} of ${cur!.c.size} characters and ${cur!.w.done} of ${cur!.w.size} words learned, ${current.proven} confirmed in review. ${total} learned in all. Open your progress.`
    : `Every band done. ${total} learned in all. Open your progress.`;

  return (
    <button type="button" className="progress-meter" aria-label={label} title="Your progress" onClick={open}>
      <span className="meter-line tiny muted">
        {current ? (
          <>
            <b className="ink">{bandName(current.band)}</b>
            <span className="meter-count">
              <span className="meter-kind">字</span>
              {cur!.c.done}
              <span className="of">/{cur!.c.size}</span>
            </span>
            <span className="meter-count">
              <span className="meter-kind">词</span>
              {cur!.w.done}
              <span className="of">/{cur!.w.size}</span>
            </span>
            <span className="meter-pct">{pct(current.done, current.size)}%</span>
          </>
        ) : (
          <>
            <b className="ink">All bands</b>
            <span className="meter-count">{total}</span>
          </>
        )}
      </span>
      <span
        className="meter-bands"
        style={{
          gridTemplateColumns: bands
            .map((b) => (b === current ? 'minmax(0, 6fr)' : 'minmax(0, 1fr)'))
            .join(' '),
        }}
        aria-hidden
      >
        {bands.map((b) => (
          <span
            key={b.band}
            className="meter-band"
            data-current={b === current || undefined}
            data-complete={(b.size > 0 && b.done >= b.size) || undefined}
          >
            <i className="believed" style={{ width: `${pct(b.done, b.size)}%` }} />
            <i className="proven" style={{ width: `${pct(b.proven, b.size)}%` }} />
          </span>
        ))}
      </span>
    </button>
  );
}
