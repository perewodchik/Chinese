import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { narrationAudio } from '../../api/narration';
import type { GeneratedText } from '../../domain/text';
import { studyText } from '../../store/commands';
import { Icon } from '../../ui/Icon';
import { narratedReadings, type Narrated } from './narratedClips';
import type { Reading } from './readAloud';

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The reading Listen last chose, when it is one of this text's. */
const chosen = () => {
  try {
    return localStorage.getItem('hanzi.listen.reading');
  } catch {
    return null;
  }
};

/**
 * The text heard from the bottom bar, under the thumb, while it is read: the
 * narrator's reading of the whole text with a slider through it, the line
 * being read lit in the text above (`onLine`). A text no narrator has read
 * plays line by line in the sentence voices instead.
 *
 * It counts as Listen's player does: how far in it has got, and, heard to
 * the end, once more.
 */
export function DockPlayer({ text, reading, spoken, onLine }: { text: GeneratedText; reading: Reading; spoken: string[]; onLine: (i: number | null) => void }) {
  const lines = useMemo(() => text.lines.map((l) => l.zh), [text.lines]);
  const [narrated, setNarrated] = useState<Narrated | null | undefined>(undefined);
  const [src, setSrc] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let live = true;
    setNarrated(undefined);
    setSrc(null);
    setAt(0);
    narratedReadings(lines).then(
      (list) => {
        if (!live) return;
        const c = chosen();
        setNarrated(list.find((r) => r.n.narratorId === c) ?? list[0] ?? null);
      },
      () => live && setNarrated(null),
    );
    return () => {
      live = false;
    };
  }, [lines]);

  useEffect(() => {
    if (!narrated) return;
    let live = true;
    narrationAudio(narrated.n).then((u) => live && setSrc(u), () => undefined);
    return () => {
      live = false;
      audio.current?.pause();
    };
  }, [narrated]);

  const timings = narrated?.n.timings ?? [];
  const duration = narrated?.n.durationMs ?? 0;
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
    if (narrated) onLine(playing || at > 0 ? line : null);
  }, [narrated, playing, at, line, onLine]);
  useEffect(() => () => onLine(null), [onLine]);

  // How far the voice has got counts, as in Listen.
  const furthest = text.study?.listened ?? 0;
  useEffect(() => {
    if (playing && line + 1 > furthest) studyText(text.id, { listened: line + 1 });
  }, [playing, line, furthest, text.id]);

  const seek = (ms: number) => {
    const el = audio.current;
    if (!el) return;
    el.currentTime = Math.max(0, ms) / 1000;
    setAt(Math.max(0, ms));
  };

  if (narrated === null) {
    // No narrator has read it: the sentence voices, a line at a time.
    const going = reading.at !== null || reading.loading;
    const n = sentenceLine ?? 0;
    return (
      <div className="rd-dock-play">
        <button
          className="rd-dock-playbtn"
          onClick={() => (going ? reading.stop() : reading.readFrom(spoken, 0))}
          disabled={!reading.choices.length && !reading.system}
          aria-label={going ? 'Stop' : 'Listen to the text'}
        >
          <Icon name={going ? 'pause' : 'play'} size={20} />
        </button>
        <div className="rd-dock-track">
          <div className="rd-dock-meta">
            <span className="rd-dock-label">{reading.choices.find((v) => v.active)?.name ?? 'Listen'}</span>
            <span className="rd-dock-time">{going ? `Line ${n + 1} of ${spoken.length}` : `${spoken.length} lines`}</span>
          </div>
          <div className="rd-dock-bar">
            <i style={{ width: `${going ? ((n + 1) / spoken.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
    );
  }

  const shown = dragging ?? at;
  return (
    <div className="rd-dock-play">
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
            setAt(0);
            const s = text.study ?? {};
            studyText(text.id, { heard: Date.now(), listened: text.lines.length, listens: (s.listens ?? (s.heard ? 1 : 0)) + 1 });
          }}
        />
      )}
      <button
        className="rd-dock-playbtn"
        disabled={!src}
        onClick={() => {
          const el = audio.current;
          if (!el) return;
          if (playing) el.pause();
          else void el.play();
        }}
        aria-label={playing ? 'Pause' : 'Listen to the text'}
      >
        <Icon name={playing ? 'pause' : 'play'} size={20} />
      </button>
      <div className="rd-dock-track">
        <div className="rd-dock-meta">
          <span className="rd-dock-label">{narrated?.name ?? 'Listen'}</span>
          <span className="rd-dock-time">
            {clock(shown)} / {clock(duration)}
          </span>
        </div>
        <input
          className="rd-dock-range"
          type="range"
          min={0}
          max={duration || 1}
          step={100}
          value={shown}
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
          style={{ '--fill': `${Math.round((shown / (duration || 1)) * 100)}%` } as CSSProperties}
        />
      </div>
    </div>
  );
}
