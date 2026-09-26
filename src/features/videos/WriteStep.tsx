import { useEffect, useState } from 'react';
import { useVideoCtx } from './context';

/**
 * Writing it out, by hand, in the notebook.
 *
 * The screen shows no text at all — only which line is playing, by the number
 * the notebook uses — and the controls are few and large: this line, again,
 * the next. The pen is the input; nothing is typed here.
 */
export function WriteStep() {
  const { lines, canPlay, playLine, playPart, pack, go, player } = useVideoCtx();
  const [at, setAt] = useState(0);
  const n = lines.length;

  // Keys for a keyboard beside the notebook: space plays, arrows move.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        playLine(at);
      } else if (e.key === 'ArrowRight') {
        const next = Math.min(n - 1, at + 1);
        setAt(next);
        playLine(next);
      } else if (e.key === 'ArrowLeft') setAt((a) => Math.max(0, a - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [at, n, playLine]);

  return (
    <div className="video-step">
      <p className="small muted" style={{ marginTop: 0 }}>
        Number the lines in your notebook, 1 to {n}, and write the pinyin of each with its tones. Leave a gap where
        you cannot hear it.
      </p>

      {pack?.listening.length ? (
        <div className="card listen-for">
          <header>
            <h2>Listen for</h2>
          </header>
          <div className="body">
            {pack.listening.map((l) => (
              <p key={l.n} className="small" style={{ margin: '0 0 6px' }}>
                <button className="line-ref" onClick={() => setAt(l.n - 1)}>
                  {l.n}
                </button>{' '}
                {l.why}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {canPlay ? (
        <div className="line-player">
          <div className="line-player-now">
            <span className="tiny muted">Line</span>
            <b className="line-player-n">{at + 1}</b>
            <span className="tiny muted">of {n}</span>
          </div>
          <div className="line-player-buttons">
            <button className="btn" disabled={at === 0} onClick={() => setAt(at - 1)} aria-label="Previous line">
              ←
            </button>
            <button className="btn primary line-play" onClick={() => playLine(at)}>
              {player.playing ? 'Playing…' : 'Play line'}
            </button>
            <button
              className="btn"
              disabled={at >= n - 1}
              onClick={() => {
                setAt(at + 1);
                playLine(at + 1);
              }}
            >
              Next →
            </button>
          </div>
          <div className="line-strip" aria-label="Lines">
            {lines.map((_, i) => (
              <button key={i} aria-current={i === at || undefined} onClick={() => setAt(i)}>
                {i + 1}
              </button>
            ))}
          </div>
          <p className="tiny muted key-hint">Space plays the line, → goes to the next one.</p>
        </div>
      ) : (
        <p className="notice">
          This text has no times, so lines cannot be played one at a time here. Play the video in YouTube and pause after
          each line.
        </p>
      )}

      <div className="row video-actions">
        {canPlay && (
          <button className="btn ghost" onClick={playPart}>
            Play the whole part
          </button>
        )}
        <div className="spacer" />
        <button className="btn" onClick={() => go('check')}>
          I’ve finished writing →
        </button>
      </div>
    </div>
  );
}
