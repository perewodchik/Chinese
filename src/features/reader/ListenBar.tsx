import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { GeneratedText } from '../../domain/text';
import { Icon } from '../../ui/Icon';
import { addReading, castReading, narratedReadings, type Narrated } from '../shared/narratedClips';
import { Narrate } from './Narrate';
import type { Reading } from './readAloud';

/** Which voice Listen reads in: a narrator's id, or "sentences" for the sentence voices. Kept on the device. */
const LISTEN_CHOICE = 'hanzi.listen.reading';
const SENTENCES = 'sentences';
const storedChoice = () => {
  try {
    return localStorage.getItem(LISTEN_CHOICE);
  } catch {
    return null;
  }
};

export interface ListenVoice {
  /** the narrators' readings of this text; empty until they have been asked for */
  readings: Narrated[];
  /** the reading Listen plays: a narrator's; null for the sentence voices; undefined while they are asked for */
  current: Narrated | null | undefined;
  /** the picker's value: `n:<narrator>` or `s:<sentence voice>` */
  value: string;
  choose: (value: string) => void;
  /** a narrator has just read the text (Narrate): kept and chosen */
  made: (r: Narrated) => void;
}

/**
 * The voice the text is heard in: a narrator's reading of the whole of it
 * where there is one — a cast's first, until another is picked — and the
 * sentence voices, line by line, otherwise. The top of the text picks it, the
 * player under the bar plays it.
 */
export function useListenVoice(text: GeneratedText, reading: Reading): ListenVoice {
  const lines = useMemo(() => text.lines.map((l) => l.zh), [text.lines]);
  const [readings, setReadings] = useState<Narrated[] | null>(null);
  const [choice, setChoice] = useState<string | null>(storedChoice);
  // A text a cast has read is heard in its characters' voices, until another voice is picked here.
  const [pickedHere, setPickedHere] = useState(false);
  useEffect(() => setPickedHere(false), [text.id]);

  useEffect(() => {
    let live = true;
    setReadings(null);
    narratedReadings(lines).then(
      (list) => live && setReadings(list),
      () => live && setReadings([]),
    );
    return () => {
      live = false;
    };
  }, [lines]);

  const keep = (id: string) => {
    setPickedHere(true);
    setChoice(id);
    try {
      localStorage.setItem(LISTEN_CHOICE, id);
    } catch {
      // forgotten between visits
    }
  };

  const list = readings ?? [];
  const cast = pickedHere ? null : castReading(list);
  const current =
    readings === null ? undefined : (cast ?? (choice === SENTENCES ? null : (list.find((r) => r.n.narratorId === choice) ?? list[0] ?? null)));
  const sentenceVoice = reading.choices.find((v) => v.active) ?? reading.choices[0];
  const value = current ? `n:${current.n.narratorId}` : current === null && sentenceVoice ? `s:${sentenceVoice.key}` : '';

  return {
    readings: list,
    current,
    value,
    choose: (v) => {
      reading.stop();
      if (v.startsWith('n:')) keep(v.slice(2));
      else {
        keep(SENTENCES);
        reading.choices.find((c) => `s:${c.key}` === v)?.pick();
      }
    },
    made: (r) => {
      reading.stop();
      addReading(lines, r);
      setReadings((was) => [...(was ?? []).filter((x) => x.n.narratorId !== r.n.narratorId), r]);
      keep(r.n.narratorId);
    },
  };
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Listen, at the top of the text, before its first line: play, what it is
 * (how long, how far it has been heard), and the voice. Play opens the player
 * under the bar — back, next, the slider, the speed — which stays in sight
 * while the text scrolls under it, and the line being read is lit.
 *
 * The row is the same height whatever arrives: the voices come a moment after
 * the page, and the text under it must not move.
 */
export function ListenBar({
  text,
  voice,
  reading,
  playing,
  onPlay,
}: {
  text: GeneratedText;
  voice: ListenVoice;
  reading: Reading;
  /** the narrator is reading now */
  playing: boolean;
  onPlay: () => void;
}) {
  const st = text.study ?? {};
  const listens = st.listens ?? (st.heard ? 1 : 0);
  const heard = listens
    ? `heard to the end ${listens === 1 ? 'once' : `${listens} times`}`
    : st.listened
      ? `heard to line ${Math.min(st.listened, text.lines.length)} of ${text.lines.length}`
      : 'not heard yet';
  const length = voice.current ? clock(voice.current.n.durationMs) : `${text.lines.length} line${text.lines.length === 1 ? '' : 's'}`;
  const canPlay = voice.current !== undefined && (voice.current !== null || reading.choices.length > 0 || reading.system);
  const lines = useMemo(() => text.lines.map((l) => l.zh), [text.lines]);

  const options: ReactNode[] = [];
  if (voice.readings.length) {
    options.push(
      <optgroup key="n" label="The whole text">
        {voice.readings.map((r) => (
          <option key={r.n.narratorId} value={`n:${r.n.narratorId}`}>
            {r.name}
          </option>
        ))}
      </optgroup>,
    );
  }
  if (reading.choices.length) {
    options.push(
      <optgroup key="s" label="Line by line">
        {reading.choices.map((c) => (
          <option key={c.key} value={`s:${c.key}`}>
            {c.name}
          </option>
        ))}
      </optgroup>,
    );
  }

  return (
    <section className="rd-listen-bar no-print" aria-label="Listen">
      <button className="rd-listen-play" onClick={onPlay} disabled={!canPlay} aria-label={playing ? 'Pause' : 'Listen to the text'}>
        <Icon name={playing ? 'pause' : 'play'} size={20} />
      </button>
      <div className="rd-listen-what">
        <b>
          <span className="hanzi" aria-hidden>
            听
          </span>{' '}
          Listen
        </b>
        <span>
          {length}, {heard}
        </span>
      </div>
      <label className="rd-listen-voice">
        <span className="tiny muted">Voice</span>
        <span className="rd-listen-select">
          <select value={voice.value} onChange={(e) => voice.choose(e.target.value)} disabled={!options.length} aria-label="Voice">
            {!options.length && <option value="">{voice.current === undefined ? "…" : "None here"}</option>}
            {options}
          </select>
          <Icon name="down" size={16} />
        </span>
      </label>
      <Narrate key={text.id} lines={lines} onMade={(n, name) => voice.made({ n, name })} />
    </section>
  );
}
