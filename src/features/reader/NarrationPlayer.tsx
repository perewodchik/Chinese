import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { TextNarrationDto } from '../../../shared/narration';
import { narrationAudio } from '../../api/narration';
import type { GeneratedText } from '../../domain/text';
import { studyText } from '../../store/commands';
import { Icon } from '../../ui/Icon';

const RATES = [0.8, 1] as const;
const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * A narrator's reading of the whole text, played as one recording: a slider
 * to go anywhere in it, back and on a line at a time, slower, and the lines
 * below lit as they are read — the reading's timings say where each line is.
 *
 * It counts the way the sentence player does: how far in it has got, and,
 * heard to the end, once more.
 */
export function NarrationPlayer({ text, narration, name, between }: { text: GeneratedText; narration: TextNarrationDto; name: string; between?: ReactNode }) {
  return (
    <ReadingPlayer
      lines={text.lines.map((l) => l.zh)}
      narration={narration}
      between={between}
      lede={`${name} reads the whole text. Hear it once following the lines, then once more without looking. Tap a line to go to it.`}
      furthest={text.study?.listened ?? 0}
      onReached={(n) => studyText(text.id, { listened: n })}
      onEnded={() => {
        const s = text.study ?? {};
        studyText(text.id, { heard: Date.now(), listened: text.lines.length, listens: (s.listens ?? (s.heard ? 1 : 0)) + 1 });
      }}
    />
  );
}

/** The player itself, for any lines with a kept reading: a Read text's, or one of the learner's own in Voices. */
export function ReadingPlayer({
  lines,
  narration,
  lede,
  between,
  furthest = 0,
  onReached,
  onEnded,
}: {
  lines: string[];
  narration: TextNarrationDto;
  lede?: ReactNode;
  between?: ReactNode;
  /** how many lines in it has got before */
  furthest?: number;
  onReached?: (lines: number) => void;
  onEnded?: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<(typeof RATES)[number]>(1);
  const [dragging, setDragging] = useState<number | null>(null);
  const duration = narration.durationMs;
  const timings = narration.timings;

  useEffect(() => {
    let live = true;
    setSrc(null);
    setFailed(null);
    setAt(0);
    narrationAudio(narration).then(
      (u) => live && setSrc(u),
      (err: Error) => live && setFailed(err.message),
    );
    return () => {
      live = false;
      audio.current?.pause();
    };
  }, [narration]);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
  }, [rate, src]);

  const line = useMemo(() => {
    const ms = dragging ?? at;
    let i = timings.findIndex(([s, e]) => ms >= s && ms < e + 300);
    if (i < 0) i = timings.findIndex(([s]) => s > ms) - 1;
    return i < 0 ? (ms >= duration - 50 ? timings.length - 1 : 0) : i;
  }, [at, dragging, timings, duration]);

  // How far the voice has got counts, as it does for the sentence player.
  useEffect(() => {
    if (playing && line + 1 > furthest) onReached?.(line + 1);
  }, [playing, line, furthest, onReached]);

  const seek = (ms: number, play = false) => {
    const el = audio.current;
    if (!el) return;
    el.currentTime = Math.max(0, ms) / 1000;
    setAt(Math.max(0, ms));
    if (play) void el.play();
  };
  const toLine = (i: number) => seek(timings[Math.max(0, Math.min(timings.length - 1, i))]![0], true);

  return (
    <>
      {lede && <p className="rd-part-lede">{lede}</p>}
      <div className="rd-player rd-narration">
        {src && (
          <audio
            ref={audio}
            src={src}
            preload="auto"
            onTimeUpdate={(e) => setAt(e.currentTarget.currentTime * 1000)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              onEnded?.();
            }}
          />
        )}
        <div className="rd-player-top">
          <span className="rd-player-where">
            {failed ?? (src ? `Line ${line + 1} of ${timings.length}` : 'Getting the reading…')}
          </span>
          <div className="seg sm rd-speed" role="group" aria-label="Speed">
            {RATES.map((r) => (
              <button key={r} aria-pressed={rate === r} onClick={() => setRate(r)}>
                {r === 1 ? 'Normal' : 'Slow'}
              </button>
            ))}
          </div>
        </div>
        <div className="rd-scrub">
          <input
            type="range"
            min={0}
            max={duration}
            step={100}
            value={dragging ?? at}
            disabled={!src}
            aria-label="Where in the reading"
            onChange={(e) => setDragging(Number(e.target.value))}
            onPointerUp={() => {
              if (dragging !== null) seek(dragging);
              setDragging(null);
            }}
            onKeyUp={() => {
              if (dragging !== null) seek(dragging);
              setDragging(null);
            }}
            onBlur={() => {
              if (dragging !== null) seek(dragging);
              setDragging(null);
            }}
            style={{ '--fill': `${Math.round(((dragging ?? at) / (duration || 1)) * 100)}%` } as CSSProperties}
          />
          <div className="rd-scrub-times tiny muted">
            <span>{clock(dragging ?? at)}</span>
            <span>{clock(duration)}</span>
          </div>
        </div>
        <div className="rd-player-row">
          <button className="rd-skip" onClick={() => toLine(line - 1)} disabled={!src || line <= 0} aria-label="Previous line">
            <Icon name="prev" />
          </button>
          <button
            className="rd-play"
            disabled={!src}
            onClick={() => {
              const el = audio.current;
              if (!el) return;
              if (playing) el.pause();
              else void el.play();
            }}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={22} />
          </button>
          <button className="rd-skip" onClick={() => toLine(line + 1)} disabled={!src || line >= timings.length - 1} aria-label="Next line">
            <Icon name="next" />
          </button>
        </div>
      </div>

      {between}

      <ol className="rd-listen">
        {lines.map((zh, i) => (
          <li key={i}>
            <button className="rd-listen-line" data-on={(playing && line === i) || undefined} data-current={!playing && i === line && at > 0 ? true : undefined} onClick={() => toLine(i)}>
              <span className="rd-listen-n">{i + 1}</span>
              <span className="hanzi">{zh}</span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}
