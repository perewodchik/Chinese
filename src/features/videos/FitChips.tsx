import { FIT_LABEL, type VideoFit } from '../../domain/videoFit';

const SPEED_LABEL = { slow: 'slow', natural: 'natural speed', fast: 'fast' } as const;

/**
 * How well a video fits, as the shelf and the video page show it: the verdict,
 * the share of words known as a thin bar, and the speed. Always the same
 * width whatever the numbers, so a card does not reflow when the fit is
 * worked out a moment after it is drawn.
 */
export function FitChips({ fit, compact }: { fit: VideoFit | null; compact?: boolean }) {
  if (!fit) {
    return (
      <span className="fit-chips" data-empty>
        <span className="fit-chip">No text yet</span>
      </span>
    );
  }
  const pct = Math.round(fit.coverage * 100);
  return (
    <span className="fit-chips" title={`${pct}% of the words said are ones you know or are learning`}>
      <span className="fit-chip" data-fit={fit.verdict}>
        {FIT_LABEL[fit.verdict]}
      </span>
      <span className="fit-bar" aria-label={`${pct}% of words known`}>
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="tiny muted fit-pct">{pct}%</span>
      {!compact && fit.speed && <span className="tiny muted">· {SPEED_LABEL[fit.speed]}</span>}
    </span>
  );
}

/** "12 new words · 5 in your band" — what is waiting to be learned. */
export function newWordsLine(fit: VideoFit | null): string {
  if (!fit) return '';
  const n = fit.newInBand.length + fit.newAbove.length;
  if (!n) return 'No new words';
  return `${n} new word${n === 1 ? '' : 's'}${fit.newInBand.length ? ` · ${fit.newInBand.length} worth learning now` : ''}`;
}
