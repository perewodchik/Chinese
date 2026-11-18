import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type GeneratedText } from '../../domain/text';
import { studyText } from '../../store/commands';
import { isSpeakSectionEnabled } from '../../navigation/features';
import { Icon } from '../../ui/Icon';
import { NarrationPlayer } from './NarrationPlayer';
import { Narrate } from './Narrate';
import { addReading, castReading, narratedReadings, type Narrated } from '../shared/narratedClips';
import { onReadThrough, RATES, type Reading } from './readAloud';
import { stored } from '../../platform/storage';
import { Section } from './PartSection';

/** 听 Listen: the text read aloud, counted as far as the voice gets. */
export function ListenPart({ text, reading, spoken, partId }: { text: GeneratedText; reading: Reading; spoken: string[]; partId: string }) {
  const st = text.study ?? {};
  const listens = st.listens ?? (st.heard ? 1 : 0);
  const aside = listens
    ? `Heard to the end ${listens === 1 ? 'once' : `${listens} times`}`
    : st.listened
      ? `Heard to line ${Math.min(st.listened, spoken.length)} of ${spoken.length}`
      : 'Not heard yet';
  return (
    <Section id={partId} han="听" title="Listen" aside={aside}>
      <ListenBody text={text} reading={reading} spoken={spoken} />
    </Section>
  );
}

/**
 * The player: the whole text, or from any line; back and on a line at a time;
 * slower to follow; and every line in a list to follow along, lit as it is
 * read. Stopping remembers the line, so Play goes on from there.
 */
/** The narrators' readings of this text, and which one Listen plays; "sentences" for the sentence player. */
const LISTEN_CHOICE = 'hanzi.listen.reading';
const SENTENCES = 'sentences';
const storedChoice = () => {
  try {
    return stored.get(LISTEN_CHOICE);
  } catch {
    return null;
  }
};

/**
 * Listen: a narrator's reading of the whole text where there is one — played
 * with a slider — and otherwise the sentence player, which reads line by line
 * in any other voice. The narrators come first among the voices.
 */
function ListenBody({ text, reading, spoken }: { text: GeneratedText; reading: Reading; spoken: string[] }) {
  const [readings, setReadings] = useState<Narrated[]>([]);
  const [choice, setChoice] = useState<string | null>(storedChoice);
  // A text a cast has read is heard in its characters' voices, until another voice is picked here.
  const [pickedHere, setPickedHere] = useState(false);
  const linesZh = useMemo(() => text.lines.map((l) => l.zh), [text.lines]);

  useEffect(() => {
    let live = true;
    setReadings([]);
    void narratedReadings(linesZh).then(
      (list) => live && setReadings(list),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [linesZh]);

  const choose = (id: string) => {
    setPickedHere(true);
    setChoice(id);
    try {
      stored.set(LISTEN_CHOICE, id);
    } catch {
      // forgotten between visits
    }
  };
  const cast = pickedHere ? null : castReading(readings);
  const current = cast ?? (choice === SENTENCES ? null : (readings.find((r) => r.n.narratorId === choice) ?? readings[0] ?? null));
  const chips = readings.map((r) => (
    <button
      key={`n:${r.n.narratorId}`}
      role="radio"
      aria-checked={current === r}
      className="chip"
      aria-pressed={current === r}
      onClick={() => {
        reading.stop();
        choose(r.n.narratorId);
      }}
    >
      {r.name}
    </button>
  ));
  // Narrators are made in Speak › Voices: without Speak, a text has no narrator to add.
  const narrate = isSpeakSectionEnabled && (
    <Narrate
      key={text.id}
      lines={linesZh}
      onMade={(n, name) => {
        reading.stop();
        addReading(linesZh, { n, name });
        setReadings((list) => [...list.filter((r) => r.n.narratorId !== n.narratorId), { n, name }]);
        choose(n.narratorId);
      }}
    />
  );

  if (current) {
    return (
      <NarrationPlayer
        key={current.n.key}
        text={text}
        narration={current.n}
        between={
          <>
            <div className="rd-voices" role="radiogroup" aria-label="Voice">
              {chips}
              {reading.choices.map((v) => (
                <button
                  key={v.key}
                  role="radio"
                  aria-checked={false}
                  className="chip"
                  aria-pressed={false}
                  onClick={() => {
                    choose(SENTENCES);
                    v.pick();
                  }}
                >
                  {v.name}
                </button>
              ))}
              {narrate}
            </div>
          </>
        }
      />
    );
  }
  return <SentenceListen text={text} reading={reading} spoken={spoken} extraChips={chips} onSentences={() => choose(SENTENCES)} narrate={narrate} />;
}

function SentenceListen({
  text,
  reading,
  spoken,
  extraChips,
  onSentences,
  narrate,
}: {
  text: GeneratedText;
  reading: Reading;
  spoken: string[];
  extraChips: ReactNode;
  onSentences: () => void;
  narrate: ReactNode;
}) {
  const [last, setLast] = useState(0);
  const [ios, setIos] = useIosSpeak();
  const lines = useRef<HTMLOListElement>(null);
  const playing = reading.at !== null || reading.loading;
  const at = reading.at ?? last;
  // Wherever the voice is, that is where Play will go on from.
  useEffect(() => {
    if (reading.at !== null) setLast(reading.at);
  }, [reading.at]);
  useEffect(() => setLast(0), [text.id]);
  // Heard to the end: next time starts at the top.
  useEffect(() => onReadThrough(() => setLast(0)), []);
  // How far the voice has got counts: once a line, the furthest only.
  const furthest = text.study?.listened ?? 0;
  useEffect(() => {
    if (reading.at !== null && reading.at + 1 > furthest) studyText(text.id, { listened: reading.at + 1 });
  }, [reading.at, furthest, text.id]);

  const from = (i: number) => {
    const n = Math.max(0, Math.min(spoken.length - 1, i));
    setLast(n);
    if (ios) selectLines(lines.current, n, n);
    else reading.readFrom(spoken, n);
  };
  const total = spoken.reduce((n, l) => n + [...l].length, 0) || 1;

  return (
    <>
      <div className="rd-player">
        <div className="rd-player-top">
          <span className="rd-player-where">
            {reading.made ? `Getting ready ${reading.made.done}/${reading.made.total}` : `Line ${at + 1} of ${spoken.length}`}
          </span>
          <div className="seg sm rd-speed" role="group" aria-label="Speed">
            {RATES.map((r) => (
              <button key={r} aria-pressed={reading.rate === r} onClick={() => reading.setRate(r)}>
                {r === 1 ? 'Normal' : 'Slow'}
              </button>
            ))}
          </div>
        </div>
        <div className="rd-seek" role="group" aria-label="Lines">
          {spoken.map((l, i) => (
            <button
              key={i}
              className="rd-seek-line"
              style={{ flexGrow: [...l].length / total }}
              data-state={i < at ? 'past' : i === at ? 'now' : undefined}
              aria-label={`From line ${i + 1}`}
              onClick={() => from(i)}
            />
          ))}
        </div>
        <div className="rd-player-row">
          <button className="rd-skip" onClick={() => from(at - 1)} disabled={at <= 0} aria-label="Previous line">
            <Icon name="prev" />
          </button>
          <button
            className="rd-play"
            onClick={() => (ios ? selectLines(lines.current, 0, spoken.length - 1) : playing ? reading.stop() : from(at))}
            aria-label={playing ? 'Pause' : at > 0 ? `Play from line ${at + 1}` : 'Play'}
            disabled={!reading.choices.length && !reading.system}
          >
            <Icon name={playing ? 'pause' : 'play'} size={22} />
          </button>
          <button className="rd-skip" onClick={() => from(at + 1)} disabled={at >= spoken.length - 1} aria-label="Next line">
            <Icon name="next" />
          </button>
        </div>
      </div>

      {/* The row is there from the start: the voices arrive a moment after the page, and the lines below should not jump. */}
      <div className="rd-voices" role="radiogroup" aria-label="Voice">
        {extraChips}
        {reading.choices.map((v) => (
          <button
            key={v.key}
            role="radio"
            aria-checked={v.active && !ios}
            className="chip"
            aria-pressed={v.active && !ios}
            onClick={() => {
              setIos(false);
              onSentences();
              v.pick();
            }}
          >
            {v.name}
          </button>
        ))}
        {IOS_SPEAK && (
          <button
            role="radio"
            aria-checked={ios}
            className="chip"
            aria-pressed={ios}
            onClick={() => {
              reading.stop();
              setIos(true);
            }}
          >
            Your device’s voice
          </button>
        )}
        {narrate}
      </div>
      {IOS_SPEAK && (
        <p className="small muted rd-voice-note">
          <b>Your device’s voice</b> reads in the Chinese voice set in Settings › Accessibility › Spoken Content ›
          Voices, on an iPhone or an iPad. Tap a line or Play: the text is selected, then tap <b>Speak</b> in the menu
          over it. The best voices, marked Premium, are a free download there.
        </p>
      )}

      <ol className="rd-listen" ref={lines} data-select={ios || undefined}>
        {text.lines.map((l, i) => {
          const on = reading.at === i;
          return (
            <li key={i}>
              {ios ? (
                // A button's text cannot be selected on iOS, and selected is what Speak needs.
                <div className="rd-listen-line" role="button" tabIndex={0} onClick={() => from(i)}>
                  {/* The number is drawn, not written, so a selection of several lines reads no numbers aloud. */}
                  <span className="rd-listen-n" data-n={i + 1} aria-hidden />
                  <span className="hanzi" data-line={i}>
                    {l.zh}
                  </span>
                </div>
              ) : (
                <button className="rd-listen-line" data-on={on || undefined} data-current={!playing && i === at && at > 0 ? true : undefined} onClick={() => from(i)}>
                  <span className="rd-listen-n">{i + 1}</span>
                  <span className="hanzi">{l.zh}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * Safari will not lend a page the voices downloaded in Settings — "Han
 * (Premium)" — but iOS reads any selected text in them itself: Speak, in the
 * menu over a selection. So on an iPhone or iPad Listen can do the selecting
 * and leave the reading to the system.
 */
const IOS_SPEAK =
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
const IOS_KEY = 'hanzi.listen.iosSpeak';

function useIosSpeak(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return IOS_SPEAK && stored.get(IOS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const set = (v: boolean) => {
    setOn(v);
    try {
      stored.set(IOS_KEY, v ? '1' : '0');
    } catch {
      // remembered for this visit only
    }
  };
  return [on, set];
}

/** Selects lines `from` to `to` of the list, the way a finger would, so the system's menu offers Speak. */
function selectLines(list: HTMLElement | null, from: number, to: number) {
  const first = list?.querySelector(`[data-line="${from}"]`);
  const last = list?.querySelector(`[data-line="${to}"]`);
  const sel = window.getSelection();
  if (!first || !last || !sel) return;
  const range = document.createRange();
  range.setStart(first, 0);
  range.setEnd(last, last.childNodes.length);
  sel.removeAllRanges();
  sel.addRange(range);
}
