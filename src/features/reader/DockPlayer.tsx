import { useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { narrationAudio } from '../../api/narration';
import type { GeneratedText } from '../../domain/text';
import { studyText } from '../../store/commands';
import { Icon } from '../../ui/Icon';
import type { Narrated } from '../shared/narratedClips';
import type { Reading } from './readAloud';
import { stored } from '../../platform/storage';

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The narrator's speeds, a tap stepping through them: slower to follow, back to as recorded. */
const RATES = [1, 0.85, 0.7] as const;
const RATE_KEY = 'hanzi.reader.rate';
const storedRate = (): number => {
  try {
    const r = Number(stored.get(RATE_KEY));
    return (RATES as readonly number[]).includes(r) ? r : 1;
  } catch {
    return 1;
  }
};

/** What the bar's listen button does with the player: start it, or stop it. */
export interface PlayerControl {
  start: () => void;
  stop: () => void;
}

/**
 * The narrator, in one row under the bar while it is open: the sentence
 * before, play, the next, a slider through the reading, the speed, and ✕.
 * The line being read is lit in the text (`onLine`). Which reading it plays
 * is chosen at the top of the text (Listen); the sentence voices read line by
 * line.
 *
 * It is there, hidden, from the moment the text opens, so its recording is
 * loaded before the listen button is tapped and starts from the tap itself:
 * iOS plays sound only in answer to a tap.
 *
 * It counts as Listen's player does: how far in it has got, and, heard to
 * the end, once more.
 */
export function DockPlayer({
  text,
  reading,
  spoken,
  narrated,
  lineRange,
  onLine,
  onPlaying,
  control,
  onClose,
}: {
  text: GeneratedText;
  reading: Reading;
  spoken: string[];
  /** the reading chosen at the top of the text (Listen); null for the sentence voices, undefined while they are asked for */
  narrated: Narrated | null | undefined;
  /** inclusive [from, to] line indices in `text` when playing one split part of a chapter */
  lineRange?: [number, number];
  onLine: (i: number | null) => void;
  /** whether it is reading now, for Listen's own button */
  onPlaying: (on: boolean) => void;
  control: MutableRefObject<PlayerControl | null>;
  onClose: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [rate, setRate] = useState(storedRate);
  const audio = useRef<HTMLAudioElement>(null);
  // The speed holds for every reading, and for this one as soon as it has loaded.
  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
  }, [rate, src]);
  const nextRate = () => {
    const r = RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length]!;
    setRate(r);
    try {
      stored.set(RATE_KEY, String(r));
    } catch {
      // private browsing: it holds for this visit
    }
  };

  const allTimings = narrated?.n.timings ?? [];
  const fullDuration = narrated?.n.durationMs ?? 0;
  const fromLine = lineRange?.[0] ?? 0;
  const toLineIdx = lineRange?.[1] ?? Math.max(0, allTimings.length - 1);
  const timings = useMemo(
    () => (lineRange ? allTimings.slice(fromLine, toLineIdx + 1) : allTimings),
    [lineRange, allTimings, fromLine, toLineIdx],
  );
  const startMs = lineRange ? (timings[0]?.[0] ?? 0) : 0;
  const endMs = useMemo(() => {
    if (!lineRange) return fullDuration;
    const rawEnd = timings[timings.length - 1]?.[1] ?? fullDuration;
    const nextStart = allTimings[toLineIdx + 1]?.[0];
    return nextStart !== undefined ? Math.min(rawEnd + 200, nextStart) : rawEnd;
  }, [lineRange, fullDuration, timings, allTimings, toLineIdx]);
  const duration = Math.max(0, endMs - startMs);

  useEffect(() => {
    setSrc(null);
    setAt(startMs);
    if (!narrated) return;
    let live = true;
    narrationAudio(narrated.n).then((u) => live && setSrc(u), () => undefined);
    return () => {
      live = false;
      audio.current?.pause();
    };
  }, [narrated, startMs]);

  const line = useMemo(() => {
    const ms = dragging ?? at;
    let i = 0;
    timings.forEach(([s], k) => {
      if (s <= ms) i = k;
    });
    return i;
  }, [at, dragging, timings]);

  // The line being read, lit in the text; nothing lit once it is stopped at the start.
  const sentenceLine = reading.at;
  useEffect(() => {
    if (narrated) onLine(playing || at > startMs ? line : null);
  }, [narrated, playing, at, startMs, line, onLine]);
  useEffect(() => () => onLine(null), [onLine]);
  const going = reading.at !== null || reading.loading;
  useEffect(() => onPlaying(narrated ? playing : going), [narrated, playing, going, onPlaying]);
  useEffect(() => () => onPlaying(false), [onPlaying]);

  // How far the voice has got counts, as in Listen.
  const furthest = text.study?.listened ?? 0;
  useEffect(() => {
    const absLine = fromLine + line + 1;
    if (playing && absLine > furthest) studyText(text.id, { listened: absLine });
  }, [playing, fromLine, line, furthest, text.id]);

  // The bar's button starts it from where it was and ✕ stops it; a text no narrator has read reads in the sentence voices.
  control.current = {
    start: () => {
      if (narrated === null) reading.readFrom(spoken, 0);
      else {
        const el = audio.current;
        if (!el) return;
        const cur = el.currentTime * 1000;
        if (lineRange && (cur < startMs || cur >= endMs - 50)) {
          el.currentTime = startMs / 1000;
          setAt(startMs);
        }
        void el.play().catch(() => undefined);
      }
    },
    stop: () => {
      audio.current?.pause();
      if (reading.at !== null || reading.loading) reading.stop();
    },
  };
  useEffect(() => () => control.current?.stop(), [control]);

  const close = (
    <button className="rd-dock-close" onClick={onClose} aria-label="Close the narrator">
      <Icon name="close" size={20} />
    </button>
  );

  const seek = (ms: number) => {
    const el = audio.current;
    if (!el) return;
    const clamped = Math.min(endMs, Math.max(startMs, ms));
    el.currentTime = clamped / 1000;
    setAt(clamped);
  };

  if (narrated === null) {
    // No narrator has read it, or the sentence voices were chosen: a line at a time.
    const n = sentenceLine ?? 0;
    return (
      <div className="rd-dock-play">
        <button
          className="rd-dock-step"
          onClick={() => reading.readFrom(spoken, n - 1)}
          disabled={!going || n === 0}
          aria-label="The sentence before"
        >
          <Icon name="prev" size={20} />
        </button>
        <button
          className="rd-dock-playbtn"
          onClick={() => (going ? reading.stop() : reading.readFrom(spoken, 0))}
          disabled={!reading.choices.length && !reading.system}
          aria-label={going ? 'Stop' : 'Listen to the text'}
        >
          <Icon name={going ? 'pause' : 'play'} size={20} />
        </button>
        <button
          className="rd-dock-step"
          onClick={() => reading.readFrom(spoken, n + 1)}
          disabled={!going || n >= spoken.length - 1}
          aria-label="The next sentence"
        >
          <Icon name="next" size={20} />
        </button>
        <div className="rd-dock-track">
          <div className="rd-dock-bar">
            <i style={{ width: `${going ? ((n + 1) / spoken.length) * 100 : 0}%` }} />
          </div>
        </div>
        {close}
      </div>
    );
  }

  const shown = dragging ?? at;
  const shownRel = Math.max(0, Math.min(duration, shown - startMs));
  /** To the start of sentence `i`, playing or not. */
  const toLine = (i: number) => {
    const start = timings[Math.max(0, Math.min(timings.length - 1, i))]?.[0];
    if (start !== undefined) seek(start);
  };
  // Back goes to the start of this sentence; at its very start, to the one before.
  const startOf = timings[line]?.[0] ?? startMs;
  const back = () => toLine(shown - startOf > 1200 ? line : line - 1);
  return (
    <div className="rd-dock-play">
      {src && (
        <audio
          ref={audio}
          src={src}
          preload="auto"
          onTimeUpdate={(e) => {
            const ms = e.currentTarget.currentTime * 1000;
            if (lineRange && ms >= endMs) {
              e.currentTarget.pause();
              e.currentTarget.currentTime = startMs / 1000;
              setPlaying(false);
              setAt(startMs);
              if (toLineIdx + 1 > furthest) studyText(text.id, { listened: toLineIdx + 1 });
              return;
            }
            setAt(ms);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setAt(startMs);
            const s = text.study ?? {};
            if (lineRange) {
              if (toLineIdx + 1 > furthest) studyText(text.id, { listened: toLineIdx + 1 });
            } else {
              studyText(text.id, { heard: Date.now(), listened: text.lines.length, listens: (s.listens ?? (s.heard ? 1 : 0)) + 1 });
            }
          }}
        />
      )}
      <button className="rd-dock-step" onClick={back} disabled={!src || !timings.length || shownRel <= 0} aria-label="The sentence before">
        <Icon name="prev" size={20} />
      </button>
      <button
        className="rd-dock-playbtn"
        disabled={!src}
        onClick={() => {
          const el = audio.current;
          if (!el) return;
          if (playing) el.pause();
          else {
            const cur = el.currentTime * 1000;
            if (lineRange && (cur < startMs || cur >= endMs - 50)) {
              el.currentTime = startMs / 1000;
              setAt(startMs);
            }
            void el.play();
          }
        }}
        aria-label={playing ? 'Pause' : 'Listen to the text'}
      >
        <Icon name={playing ? 'pause' : 'play'} size={20} />
      </button>
      <button
        className="rd-dock-step"
        onClick={() => toLine(line + 1)}
        disabled={!src || line >= timings.length - 1}
        aria-label="The next sentence"
      >
        <Icon name="next" size={20} />
      </button>
      <div className="rd-dock-track">
        <span className="rd-dock-time">{clock(shownRel)}</span>
        <input
          className="rd-dock-range"
          type="range"
          min={0}
          max={duration || 1}
          step={100}
          value={shownRel}
          disabled={!src}
          aria-label="Where in the reading"
          onChange={(e) => setDragging(startMs + Number(e.target.value))}
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
          style={{ '--fill': `${Math.round((shownRel / (duration || 1)) * 100)}%` } as CSSProperties}
        />
        <span className="rd-dock-time">{clock(duration)}</span>
      </div>
      <button className="rd-dock-rate" onClick={nextRate} disabled={!src} aria-label={`Speed ${rate} times; tap for the next`}>
        {rate === 1 ? '1×' : `${rate}×`}
      </button>
      {close}
    </div>
  );
}
