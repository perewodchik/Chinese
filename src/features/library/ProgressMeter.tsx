import { useMemo } from 'react';
import { charId } from '../../domain/ids';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';

/** How much of the band you are working on is learned, in the bar across the top. */
export function ProgressMeter() {
  const lib = useLibrary();
  const learned = useStore((s) => s.learned);
  const band = useStore((s) => s.settings.hskBand);

  const { done, total, label } = useMemo(() => {
    // Measured against the band you are actually working on. Counting towards
    // 3000 would make a good week look like nothing happened.
    const scope = band ? lib.characters.filter((c) => c.hsk === band) : lib.characters;
    return {
      done: scope.filter((c) => learned.has(charId(c.c))).length,
      total: scope.length || 1,
      label: band === 7 ? 'HSK 7–9' : band ? `HSK ${band}` : 'all bands',
    };
  }, [lib, learned, band]);

  return (
    <div className="progress-meter" title={`${done} of ${total} learned in ${label}`}>
      <div className="tiny muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{done} learned</span>
        <span>{label}</span>
      </div>
      <div className="bar" style={{ marginTop: 4 }}>
        <i className="learned" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}
