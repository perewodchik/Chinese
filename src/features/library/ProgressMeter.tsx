import { useMemo } from 'react';
import { Link } from 'react-router';
import { charId } from '../../domain/ids';
import { wordBands } from '../../domain/wordProgress';
import { paths } from '../../navigation/paths';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';

/** The bands in the order they are climbed; 7 stands for 7–9, which the syllabus treats as one. */
const BANDS = [1, 2, 3, 4, 5, 6, 7];

const bandName = (band: number) => (band === 7 ? 'HSK 7–9' : `HSK ${band}`);

/**
 * Where you are on the whole syllabus, in the bar across the top.
 *
 * It used to measure the band the Library happened to be filtered to, so
 * glancing at HSK 2 in the Library made the header claim you were working on
 * HSK 2. A filter is a view, not a position. This reads the position off what
 * you have learned instead: one segment per band, and the numbers for the
 * lowest band you have not finished — the one with something left to do in it.
 * Counting towards 3000 alone would still make a good week look like nothing
 * happened; a segment filling up does not.
 */
export function ProgressMeter() {
  const lib = useLibrary();
  const learned = useStore((s) => s.learned);
  const recall = useStore((s) => s.recall);

  // A band is its characters and its words: both fill its segment, and the
  // numbers say which is which.
  const { bands, chars, words, current, total } = useMemo(() => {
    const chars = BANDS.map((band) => ({ band, done: 0, size: 0 }));
    let total = 0;
    for (const c of lib.characters) {
      const b = chars[Math.min(c.hsk, 7) - 1];
      if (!b) continue;
      b.size++;
      if (learned.has(charId(c.c))) {
        b.done++;
        total++;
      }
    }
    const words = wordBands(lib, recall);
    const bands = chars.map((b, i) => ({ ...b, size: b.size + words[i]!.size, done: b.done + words[i]!.done }));
    total += words.reduce((n, w) => n + w.done, 0);
    const current = bands.find((b) => b.size && b.done < b.size) ?? null;
    return { bands, chars, words, current, total };
  }, [lib, learned, recall]);

  const summary = bands
    .map((b, i) => `${bandName(b.band)}: ${chars[i]!.done} of ${chars[i]!.size} characters, ${words[i]!.done} of ${words[i]!.size} words`)
    .join('\n');

  return (
    <Link
      className="progress-meter"
      to={`${paths.library()}?show=todo`}
      title={`${total} learned in all\n\n${summary}${current ? `\n\nClick for what is left in ${bandName(current.band)}` : ''}`}
      // The one place the header does touch the Library's filter: on purpose,
      // to open it on what is left in the band shown here.
      onClick={() => current && setSettings({ hskBand: current.band })}
    >
      <div className="tiny muted" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        {current ? (
          <span>
            <b className="ink">{bandName(current.band)}</b> · <span className="meter-kind">字</span>
            {chars[current.band - 1]!.done}/{chars[current.band - 1]!.size} ·{' '}
            <span className="meter-kind">词</span>
            {words[current.band - 1]!.done}/{words[current.band - 1]!.size}
          </span>
        ) : (
          <span>
            <b className="ink">All bands</b> · done
          </span>
        )}
        <span>{total} learned</span>
      </div>
      <div className="band-bar" style={{ marginTop: 4 }}>
        {bands.map((b) => (
          <div key={b.band} className="bar" data-current={b === current || undefined}>
            <i className="learned" style={{ width: `${b.size ? (b.done / b.size) * 100 : 0}%` }} />
          </div>
        ))}
      </div>
    </Link>
  );
}
