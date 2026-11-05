import { useRef } from 'react';
import type { RecorderState } from './useRecorder';

/** The recorder's states, and the wait while the service scores what was said. */
export type SayItState = RecorderState | 'checking';

const LABEL: Record<SayItState, string> = {
  idle: 'Say it',
  opening: 'Opening the microphone…',
  listening: 'Listening… tap to stop',
  hearing: 'Hearing you…',
  checking: 'Scoring…',
};

/**
 * The one big button of a speaking exercise.
 *
 * Round, and large enough to hit without looking, because the eyes are on the
 * word. While it listens it fills with the pronunciation colour and a ring
 * swells with the voice — proof, before anything is judged, that the
 * microphone is actually hearing something.
 */
export function RecordButton({
  state,
  level,
  onToggle,
  disabled,
  compact,
  stopSquare,
}: {
  state: SayItState;
  level: number;
  onToggle: () => void;
  disabled?: boolean;
  /** Beside a text box rather than alone on a drill: smaller, and no label under it. */
  compact?: boolean;
  /** while it records, a square to stop it rather than the level bars: for a screen that shows the level elsewhere */
  stopSquare?: boolean;
}) {
  const live = state === 'listening' || state === 'hearing';
  // Loudness is roughly logarithmic to the ear; so is the ring.
  const swell = live ? Math.min(1, Math.max(0, (Math.log10(level + 1e-4) + 3.2) / 2.4)) : 0;
  // The last few loudnesses, newest in the middle: five bars that move with the voice, as a level meter does.
  const recent = useRef<number[]>([0, 0, 0, 0, 0]);
  if (live) recent.current = [...recent.current.slice(1), swell];
  else recent.current = [0, 0, 0, 0, 0];
  const [a, b, c, d, e] = recent.current;
  const bars = [b!, d!, e!, c!, a!];
  return (
    <div className="rec" data-compact={compact || undefined}>
      <button
        type="button"
        className="rec-button"
        data-live={live || undefined}
        aria-pressed={live}
        disabled={disabled || state === 'opening' || state === 'checking'}
        onClick={onToggle}
        aria-label={live ? 'Stop recording' : 'Record yourself'}
        style={{ ['--swell' as string]: swell }}
      >
        <span className="rec-ring" aria-hidden />
        <span className="rec-ripple" aria-hidden />
        {live && stopSquare ? (
          <span className="rec-stop" aria-hidden />
        ) : live ? (
          <span className="rec-bars" aria-hidden>
            {bars.map((v, i) => (
              <i key={i} style={{ transform: `scaleY(${0.18 + v * 0.82})` }} />
            ))}
          </span>
        ) : (
          <span className="rec-dot" aria-hidden />
        )}
        {state === 'checking' && <span className="rec-spin" aria-hidden />}
      </button>
      {/* The label is the whole state of a drill, but beside a text box the
          button is one control in a row and its state is its own colour. It
          still reaches a screen reader through the button's own label. */}
      {!compact && (
        <span className="rec-label tiny" aria-live="polite">
          {LABEL[state]}
        </span>
      )}
    </div>
  );
}
