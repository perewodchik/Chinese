import { useMemo } from 'react';
import { Link } from 'react-router';
import { weakSpots, type SpotTarget, type WeakSpot, type WeakSpotReport } from '../../domain/pinyin/weakSpots';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';
import { usePinyinMemory } from './voice';

/** Where a spot is practised. */
export function spotPath(t: SpotTarget): string {
  switch (t.kind) {
    case 'practice':
      return paths.speakingPractice(t.set);
    case 'sound':
      return paths.speakingSounds(t.lesson, t.step);
    case 'drill':
      return paths.drill(t.drill);
    case 'shadow':
      return paths.speakingShadow();
  }
}

/** The weak spots, from this device's tallies and the account's reviews. */
export function useWeakSpots(): WeakSpotReport {
  const lib = useLibrary();
  const tallies = usePinyinMemory().tallies;
  const recall = useStore((s) => s.recall);
  return useMemo(() => weakSpots(tallies, recall, lib), [tallies, recall, lib]);
}

/** One spot as a row: what it is, how it is going, and the way to practise it. */
export function SpotRow({ spot }: { spot: WeakSpot }) {
  return (
    <Link className="spot" to={spotPath(spot.target)}>
      <span className="spot-main">
        <b>{spot.title}</b>
        <span className="tiny muted">
          {spot.chars ? <span className="hanzi spot-chars">{spot.chars.join(' ')}</span> : spot.detail}
        </span>
      </span>
      <span className="spot-score tiny" data-state={spot.score === null ? 'wrong' : spot.score < 0.5 ? 'wrong' : 'close'}>
        {spot.score === null ? `${spot.tries} missed` : `${Math.round(spot.score * 100)}%`}
      </span>
      <span className="spot-go" aria-hidden>
        →
      </span>
    </Link>
  );
}

/**
 * The top of the Speaking page: what to practise, before the map of
 * everything there is.
 *
 * The tallies are kept on this device, so on a new iPad the list starts
 * empty; it says so, and offers the first thing worth trying instead of an
 * empty box.
 */
export function WeakSpotsCard({ limit = 3 }: { limit?: number }) {
  const report = useWeakSpots();
  const shown = report.weak.slice(0, limit);
  const next = report.untried[0];

  return (
    <div className="spots-card">
      <div className="spots-head">
        <h2 className="pinyin-label" style={{ margin: 0 }}>
          Weak spots
        </h2>
        <span className="tiny muted">
          {report.weak.length > limit
            ? `${limit} of ${report.weak.length}, worst first`
            : report.judged
              ? 'from your recent tries'
              : ''}
        </span>
      </div>
      {shown.length ? (
        <div className="spots">
          {shown.map((s) => (
            <SpotRow key={s.id} spot={s} />
          ))}
        </div>
      ) : (
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          {report.judged
            ? 'Nothing is going wrong often enough to single out. '
            : 'Not enough tries on this device yet to say where it goes wrong. '}
          {next && (
            <>
              Try <Link to={spotPath(next.target)}>{next.title.toLowerCase()}</Link> next.
            </>
          )}
        </p>
      )}
    </div>
  );
}
