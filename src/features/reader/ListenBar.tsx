import { useEffect, useMemo, useRef, useState } from "react";
import type { GeneratedText } from "../../domain/text";
import { isSpeakSectionEnabled } from "../../navigation/features";
import { Icon } from "../../ui/Icon";
import {
  addReading,
  castReading,
  narratedReadings,
  type Narrated,
} from "../shared/narratedClips";
import { Narrate } from "./Narrate";
import type { Reading } from "./readAloud";
import { stored } from "../../platform/storage";

/** Which voice Listen reads in: a narrator's id, or "sentences" for the sentence voices. Kept on the device. */
const LISTEN_CHOICE = "hanzi.listen.reading";
const SENTENCES = "sentences";
const storedChoice = () => {
  try {
    return stored.get(LISTEN_CHOICE);
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
export function useListenVoice(
  text: GeneratedText,
  reading: Reading,
): ListenVoice {
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
      stored.set(LISTEN_CHOICE, id);
    } catch {
      // forgotten between visits
    }
  };

  const list = readings ?? [];
  const cast = pickedHere ? null : castReading(list);
  const current =
    readings === null
      ? undefined
      : (cast ??
        (choice === SENTENCES
          ? null
          : (list.find((r) => r.n.narratorId === choice) ?? list[0] ?? null)));
  const sentenceVoice =
    reading.choices.find((v) => v.active) ?? reading.choices[0];
  const value = current
    ? `n:${current.n.narratorId}`
    : current === null && sentenceVoice
      ? `s:${sentenceVoice.key}`
      : "";

  return {
    readings: list,
    current,
    value,
    choose: (v) => {
      reading.stop();
      if (v.startsWith("n:")) keep(v.slice(2));
      else {
        keep(SENTENCES);
        reading.choices.find((c) => `s:${c.key}` === v)?.pick();
      }
    },
    made: (r) => {
      reading.stop();
      addReading(lines, r);
      setReadings((was) => [
        ...(was ?? []).filter((x) => x.n.narratorId !== r.n.narratorId),
        r,
      ]);
      keep(r.n.narratorId);
    },
  };
}

/**
 * Listen, beside the chapter's title: play, and ▾ for the voice. The menu
 * lists the voices — narrators that read the whole text first, then the
 * sentence voices — says how far the text has been heard, and offers a new
 * narrator's reading. Play opens the player under the bar (back, next, the
 * slider, the speed), which stays in sight while the text scrolls.
 */
export function ListenControl({
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
  const [open, setOpen] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOpen(false);
    setNarrating(false);
  }, [text.id]);
  // A tap anywhere else, or Escape, closes it.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const st = text.study ?? {};
  const listens = st.listens ?? (st.heard ? 1 : 0);
  const heard = listens
    ? `Heard to the end ${listens === 1 ? "once" : `${listens} times`}.`
    : st.listened
      ? `Heard to line ${Math.min(st.listened, text.lines.length)} of ${text.lines.length}.`
      : "Not heard yet.";
  const canPlay =
    voice.current !== undefined &&
    (voice.current !== null || reading.choices.length > 0 || reading.system);
  const lines = useMemo(() => text.lines.map((l) => l.zh), [text.lines]);

  const row = (value: string, name: string) => (
    <button
      key={value}
      role="menuitemradio"
      aria-checked={voice.value === value}
      className="rd-listen-voice-row"
      onClick={() => {
        voice.choose(value);
        setOpen(false);
      }}
    >
      <span className="grow">{name}</span>
      {voice.value === value && <Icon name="check" size={18} />}
    </button>
  );

  return (
    <div className="rd-listen-ctl no-print" ref={root}>
      <button
        className="rd-listen-play"
        onClick={onPlay}
        disabled={!canPlay}
        aria-label={playing ? "Pause" : "Listen to the text"}
        title={playing ? "Pause" : "Listen"}
      >
        <Icon name={playing ? "pause" : "play"} size={18} />
      </button>
      <button
        className="rd-listen-more"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Voice"
        title="Voice"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="down" size={16} />
      </button>
      {open && (
        <div className="rd-listen-menu" role="menu" aria-label="Voice">
          <p className="rd-listen-heard">{heard}</p>
          {voice.readings.length > 0 && (
            <>
              <p className="rd-listen-group">The whole text</p>
              {voice.readings.map((r) => row(`n:${r.n.narratorId}`, r.name))}
            </>
          )}
          {reading.choices.length > 0 && (
            <>
              <p className="rd-listen-group">Line by line</p>
              {reading.choices.map((c) => row(`s:${c.key}`, c.name))}
            </>
          )}
          {!voice.readings.length && !reading.choices.length && (
            <p className="rd-listen-group">No voice here yet.</p>
          )}
          {/* Narrators are made in Speak › Voices: without Speak, a text has no narrator to add. */}
          {isSpeakSectionEnabled && (
            <div className="rd-listen-new">
              <button
                className="rd-listen-voice-row"
                aria-expanded={narrating}
                onClick={() => setNarrating((n) => !n)}
              >
                <Icon name="plus" size={18} />
                <span className="grow">A new narrator’s reading</span>
              </button>
              {narrating && (
                <Narrate
                  embedded
                  key={text.id}
                  lines={lines}
                  onMade={(n, name) => voice.made({ n, name })}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
