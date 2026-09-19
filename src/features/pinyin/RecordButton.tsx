import type { RecorderState } from './useRecorder';

const LABEL: Record<RecorderState, string> = {
  idle: 'Say it',
  opening: 'Opening the microphone…',
  listening: 'Listening…',
  hearing: 'Hearing you…',
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
}: {
  state: RecorderState;
  level: number;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const live = state === 'listening' || state === 'hearing';
  // Loudness is roughly logarithmic to the ear; so is the ring.
  const swell = live ? Math.min(1, Math.max(0, (Math.log10(level + 1e-4) + 3.2) / 2.4)) : 0;
  return (
    <div className="rec">
      <button
        type="button"
        className="rec-button"
        data-live={live || undefined}
        aria-pressed={live}
        disabled={disabled || state === 'opening'}
        onClick={onToggle}
        aria-label={live ? 'Stop recording' : 'Record yourself'}
        style={{ ['--swell' as string]: swell }}
      >
        <span className="rec-ring" aria-hidden />
        <span className="rec-dot" aria-hidden />
      </button>
      <span className="rec-label tiny" aria-live="polite">
        {LABEL[state]}
      </span>
    </div>
  );
}
