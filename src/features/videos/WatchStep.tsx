import { useEffect, useRef } from 'react';
import { patchVideo, recordWatch } from '../../store/videoCommands';
import { useVideoCtx } from './context';

const UNDERSTOOD = [
  { id: 1, label: 'Hardly' },
  { id: 2, label: 'A little' },
  { id: 3, label: 'Half' },
  { id: 4, label: 'Most' },
  { id: 5, label: 'All' },
];

/**
 * Watching, and saying how it went — the lightest way to use a video.
 *
 * A part played through to its end counts as watched by itself. Everything
 * else is marked by hand, and every mark is optional: a video can be watched,
 * rated "most of it" and called done without a notebook ever coming out.
 */
export function WatchStep() {
  const { video: v, part, lines, canPlay, playPart, player } = useVideoCtx();
  const counting = useRef(false);
  const wasPlaying = useRef(false);

  // A whole part played to its end is a watch.
  useEffect(() => {
    if (wasPlaying.current && !player.playing && counting.current) {
      const last = lines[lines.length - 1];
      if (last && player.time >= last.end - 1.5) {
        counting.current = false;
        recordWatch(v.id);
      }
    }
    wasPlaying.current = player.playing;
  }, [player.playing, player.time, lines, v.id]);

  const marks = v.marks;
  return (
    <div className="video-step">
      <div className="row video-actions">
        {canPlay && (
          <button
            className="btn primary"
            onClick={() => {
              counting.current = true;
              playPart();
            }}
          >
            {v.parts.length > 1 ? `Play part ${part + 1}` : 'Play it'}
          </button>
        )}
        <span className="small muted">
          Watch without the text first. Twice is good; the second time you catch more.
        </span>
      </div>

      <div className="card video-marks">
        <header>
          <h2>Your marks</h2>
        </header>
        <div className="body">
          <div className="vmark-row">
            <span className="mark-name">Watched</span>
            <span className="mark-value">{marks.watched ? `${marks.watched}×` : 'not yet'}</span>
            <button className="btn sm" onClick={() => recordWatch(v.id)}>
              + I watched it
            </button>
          </div>
          <div className="vmark-row">
            <span className="mark-name">Understood</span>
            <div className="seg sm" role="group" aria-label="How much you understood">
              {UNDERSTOOD.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  aria-pressed={marks.understood === u.id}
                  onClick={() => patchVideo(v.id, { marks: { understood: u.id } })}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
          <Toggle label="Written out" on={!!marks.written} onChange={(written) => patchVideo(v.id, { marks: { written } })} />
          <Toggle label="Words taken" on={!!marks.words} onChange={(words) => patchVideo(v.id, { marks: { words } })} />
          <Toggle label="Can say it" on={!!marks.said} onChange={(said) => patchVideo(v.id, { marks: { said } })} />
          <p className="tiny muted" style={{ margin: '8px 0 0' }}>
            Set any of these yourself. Written out, words and saying it also tick themselves when you do them here.
          </p>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="vmark-row">
      <span className="mark-name">{label}</span>
      <span className="mark-value" data-state={on ? 'right' : undefined}>
        {on ? '✓ yes' : 'not yet'}
      </span>
      <button className="btn sm" aria-pressed={on} onClick={() => onChange(!on)}>
        {on ? 'Untick' : 'Tick'}
      </button>
    </div>
  );
}
