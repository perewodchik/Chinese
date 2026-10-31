import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ItemId } from '../../domain/ids';
import { hskLabel, type GeneratedText } from '../../domain/text';
import { itemForToken } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { setShelfStudy, studyText } from '../../store/commands';
import { Icon } from '../../ui/Icon';
import { useLibrary } from '../shared/library';
import { AnswerBox } from './AnswerBox';
import { CopyOut } from './CopyOut';
import { Dictation, openDictation } from './Dictation';
import { VideoStudio } from './video/VideoStudio';
import { NarrationPlayer } from './NarrationPlayer';
import { Narrate } from './Narrate';
import { addReading, narratedReadings, pickReading, prepareClips } from './narratedClips';
import type { TextNarrationDto } from '../../../shared/narration';
import type { Standing } from './Passage';
import { onReadThrough, RATES, type Reading } from './readAloud';

/**
 * The parts of a text, as the strip at the top of the page names them.
 *
 * They are parts of one text, not steps: read it, write it out, hear it, take
 * the words worth having, answer the questions — in any order, as often as
 * you like. Each fills the line under its name as it is done, so coming back
 * to a text shows at a glance what is left of it. Listening counts as far as
 * the voice has got, and is done once the text has been heard to the end.
 *
 * Translating and dictation are there too, under More, and count for nothing:
 * they are ways of going over the text, not things to finish.
 */
export type PartId = 'read' | 'write' | 'listen' | 'words' | 'questions';
export type TabId = PartId | 'more';

export const PARTS: Array<{ id: PartId; han: string; label: string }> = [
  { id: 'read', han: '读', label: 'Text' },
  { id: 'write', han: '写', label: 'Write' },
  { id: 'listen', han: '听', label: 'Listen' },
  { id: 'words', han: '词', label: 'Words' },
  { id: 'questions', han: '问', label: 'Questions' },
];

export const MORE = { id: 'more' as const, han: '更', label: 'More' };

const hanCount = (text: GeneratedText) => text.lines.reduce((n, l) => n + [...l.zh].filter((c) => /\p{Script=Han}/u.test(c)).length, 0);

/** How far each part has got, from nothing (0) to done (1). */
export function partFill(text: GeneratedText, standing: (w: string) => Standing): Record<PartId, number> {
  const s = text.study ?? {};
  const words = text.vocab.length ? text.vocab.filter((w) => standing(w.w) !== 'new').length / text.vocab.length : 1;
  const answered = text.questions.length ? (s.answered ?? []).length / text.questions.length : 1;
  return {
    read: text.read ? 1 : 0,
    write: Math.min(1, (s.copied ?? 0) / (hanCount(text) || 1)),
    listen: s.listens || s.heard ? 1 : Math.min(1, (s.listened ?? 0) / (text.lines.length || 1)),
    words: Math.min(1, words),
    questions: Math.min(1, answered),
  };
}

/** The parts a text has: no questions, no Questions. Every text can be copied out, so Write is always there. */
export function partsOf(text: GeneratedText): typeof PARTS {
  return PARTS.filter((p) => p.id !== 'questions' || text.questions.length > 0);
}

function Section({ id, han, title, aside, children }: { id: string; han: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rd-part" id={id} data-part>
      <header className="rd-part-head">
        <span className="hanzi" aria-hidden>
          {han}
        </span>
        <h2>{title}</h2>
        <span className="spacer" />
        {aside && <span className="rd-part-aside">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- 听 Listen */

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
    return localStorage.getItem(LISTEN_CHOICE);
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
  const [readings, setReadings] = useState<Array<{ n: TextNarrationDto; name: string }>>([]);
  const [choice, setChoice] = useState<string | null>(storedChoice);
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
    setChoice(id);
    try {
      localStorage.setItem(LISTEN_CHOICE, id);
    } catch {
      // forgotten between visits
    }
  };
  const current = choice === SENTENCES ? null : (readings.find((r) => r.n.narratorId === choice) ?? readings[0] ?? null);
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
  const narrate = (
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
      return IOS_SPEAK && localStorage.getItem(IOS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const set = (v: boolean) => {
    setOn(v);
    try {
      localStorage.setItem(IOS_KEY, v ? '1' : '0');
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

/* ---------------------------------------------------------------- 译 Translate */

function TranslateBody({ text }: { text: GeneratedText }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const all = open.size === text.lines.length;
  const reveal = (next: Set<number>) => {
    setOpen(next);
    if (next.size && !text.study?.translated) studyText(text.id, { translated: Date.now() });
  };
  return (
    <>
      <div className="row rd-more-lede">
        <p className="rd-part-lede grow">Say to yourself what each line means, then tap it to check.</p>
        <button className="btn quiet sm rd-show-all" onClick={() => reveal(all ? new Set() : new Set(text.lines.map((_, i) => i)))}>
          {all ? 'Hide all' : 'Show all'}
        </button>
      </div>
      <ol className="rd-pairs">
        {text.lines.map((l, i) => {
          const shown = open.has(i);
          return (
            <li key={i}>
              <button
                className="rd-pair"
                aria-expanded={shown}
                onClick={() => {
                  const next = new Set(open);
                  if (shown) next.delete(i);
                  else next.add(i);
                  reveal(next);
                }}
              >
                <span className="hanzi rd-pair-zh">{l.zh}</span>
                <span className="rd-pair-en" data-hidden={!shown || undefined}>
                  {shown ? l.en : 'Tap to see the translation'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/* ---------------------------------------------------------------- 更 More */

/**
 * Translating and dictation: two ways of going over the text again, folded
 * away until one is wanted, and counted nowhere. Translate opens where it is;
 * dictation has the screen to itself.
 */
export function MorePart({ text, partId }: { text: GeneratedText; partId: string }) {
  const [open, setOpen] = useState<'translate' | null>(null);
  const [dictating, setDictating] = useState(false);
  const [filming, setFilming] = useState(false);
  useEffect(() => setOpen(null), [text.id]);
  // A narrator's reading, fetched before Dictation is opened, so its first
  // sentence can be said inside the tap that opens it.
  useEffect(() => {
    let live = true;
    void narratedReadings(text.lines.map((l) => l.zh)).then((list) => {
      const r = pickReading(list);
      if (live && r) void prepareClips(text.id, r).catch(() => undefined);
    }, () => undefined);
    return () => {
      live = false;
    };
  }, [text.id, text.lines]);
  const dictated = Math.min(text.lines.length, text.study?.dictated ?? 0);
  const row = (id: 'translate', han: string, title: string, sub: string) => (
    <button className="rd-more-row" aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>
      <span className="hanzi" aria-hidden>
        {han}
      </span>
      <span className="grow">
        <b>{title}</b>
        <span className="small muted">{sub}</span>
      </span>
      <Icon name="chevron" />
    </button>
  );
  return (
    <Section id={partId} han="更" title="More" aside="Practice, not counted">
      <div className="rd-more-list">
        {row('translate', '译', 'Translate', 'Say what a line means, then check')}
        {open === 'translate' && (
          <div className="rd-more-body">
            <TranslateBody key={text.id} text={text} />
          </div>
        )}
        <button
          className="rd-more-row"
          onClick={() => {
            openDictation(text);
            setDictating(true);
          }}
        >
          <span className="hanzi" aria-hidden>
            默
          </span>
          <span className="grow">
            <b>Dictation</b>
            <span className="small muted">
              {dictated >= text.lines.length
                ? 'Written to the end. Again?'
                : dictated
                  ? `${dictated} of ${text.lines.length} sentences so far: go on from there`
                  : 'Hear a sentence, write it down, then see it'}
            </span>
          </span>
          <Icon name="chevron" />
        </button>
        <button className="rd-more-row" onClick={() => setFilming(true)}>
          <span className="hanzi" aria-hidden>
            影
          </span>
          <span className="grow">
            <b>Video</b>
            <span className="small muted">The text as an upright video: its pictures, the narrator, subtitles</span>
          </span>
          <Icon name="chevron" />
        </button>
      </div>
      {dictating && <Dictation text={text} onClose={() => setDictating(false)} />}
      {filming && <VideoStudio text={text} onClose={() => setFilming(false)} />}
    </Section>
  );
}

/* ---------------------------------------------------------------- 词 Words */

export function WordsPart({
  text,
  setId,
  study,
  standing,
  onShowLine,
  partId,
}: {
  text: GeneratedText;
  setId: string | null;
  study: ReadonlySet<ItemId>;
  standing: (w: string) => Standing;
  onShowLine: (i: number) => void;
  partId: string;
}) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const [all, setAll] = useState(false);
  const words = text.vocab;
  const learning = words.filter((w) => standing(w.w) === 'learning').length;
  // The new ones first: they are what the part is for.
  const ordered = useMemo(
    () => [...words].sort((a, b) => Number(standing(a.w) === 'known') - Number(standing(b.w) === 'known')),
    [words, standing],
  );
  const shown = all ? ordered : ordered.slice(0, 6);

  /** The line a grammar note's example comes from, so it can be pointed at in the text. */
  const lineOf = (zh: string | undefined) => {
    if (!zh) return -1;
    const bare = (s: string) => s.replace(/[^\p{Script=Han}]/gu, '');
    const z = bare(zh);
    return text.lines.findIndex((l) => bare(l.zh).includes(z) || (z.length > 3 && z.includes(bare(l.zh))));
  };

  return (
    <Section id={partId} han="词" title="Words" aside={words.length ? `${learning} of ${words.length} learning` : undefined}>
      {words.length > 0 ? (
        <>
          <ul className="rd-words">
            {shown.map((w) => {
              const id = itemForToken(lib, w.w);
              const s = standing(w.w);
              const band = lib.byWord.get(w.w)?.hsk;
              return (
                <li key={w.w} className="rd-word">
                  <button className="rd-word-main" onClick={() => openItem(id)}>
                    <span className="hanzi rd-word-zh">{w.w}</span>
                    <span className="rd-word-text">
                      <span className="rd-word-py">{w.py}</span>
                      <span className="rd-word-d">
                        {w.d}
                        {band ? <span className="tiny muted"> {hskLabel(band)}</span> : null}
                      </span>
                    </span>
                  </button>
                  {s === 'known' ? (
                    <span className="rd-add" data-state="known" title="You know this one">
                      <Icon name="check" />
                    </span>
                  ) : (
                    <button
                      className="rd-add"
                      data-state={s}
                      disabled={!setId}
                      aria-pressed={study.has(id) || s === 'learning'}
                      title={study.has(id) ? 'On this shelf’s list: tap to take it off' : 'Learn this word'}
                      onClick={() => setId && setShelfStudy(setId, [id], !study.has(id))}
                    >
                      <Icon name={s === 'learning' ? 'check' : 'plus'} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {ordered.length > shown.length && (
            <button className="btn quiet sm rd-more" onClick={() => setAll(true)}>
              Show all {ordered.length}
            </button>
          )}
        </>
      ) : (
        <p className="rd-part-lede">This text came without a word list. Tap any word in it to look it up.</p>
      )}

      {text.grammar.map((g, k) => {
        const at = lineOf(g.zh);
        return (
          <div key={k} className="rd-grammar">
            <div className="row" style={{ gap: 8 }}>
              <b>{g.point}</b>
              <span className="spacer" />
              {at >= 0 && (
                <button className="btn quiet sm" onClick={() => onShowLine(at)}>
                  In line {at + 1}
                </button>
              )}
            </div>
            {g.en && <p className="rd-grammar-en">{g.en}</p>}
            {g.zh && <p className="hanzi rd-grammar-zh">{g.zh}</p>}
          </div>
        );
      })}

      {text.note.trim() && <p className="rd-note">{text.note}</p>}
    </Section>
  );
}

/* ---------------------------------------------------------------- 写 Write */

/**
 * Copying out, the part the learner likes best, shown as what it is: a strip
 * of the exercise book with the characters copied so far in ink, the next one
 * waiting in its square, and the ones after it faint, the way the copying
 * screen itself shows them. Tapping the strip is the same as the button.
 */
export function WritePart({ text, partId }: { text: GeneratedText; partId: string }) {
  const [copying, setCopying] = useState(false);
  const chars = useMemo(() => text.lines.flatMap((l) => [...l.zh].filter((c) => /\p{Script=Han}/u.test(c))), [text.lines]);
  const total = chars.length;
  const copied = Math.min(total, text.study?.copied ?? 0);
  const done = total > 0 && copied >= total;
  // A window of the text around the place: two copied behind it, the rest ahead.
  const from = done ? Math.max(0, total - WRITE_SQUARES) : Math.max(0, Math.min(copied - 2, total - WRITE_SQUARES));
  const shown = chars.slice(from, from + WRITE_SQUARES);
  // The rest of the sentence the place is in, so the strip has a sentence to it.
  const where = useMemo(() => {
    let n = 0;
    for (const l of text.lines) {
      const han = [...l.zh].filter((c) => /\p{Script=Han}/u.test(c)).length;
      if (copied < n + han) {
        let k = copied - n;
        let i = 0;
        const zh = [...l.zh];
        while (k > 0 && i < zh.length) if (/\p{Script=Han}/u.test(zh[i++]!)) k--;
        return zh.slice(i).join('');
      }
      n += han;
    }
    return '';
  }, [text.lines, copied]);

  return (
    <Section id={partId} han="写" title="Write" aside={done ? 'Copied out' : `${copied} of ${total} characters`}>
      <p className="rd-part-lede">Copy the text into your notebook, a word at a time, with its strokes beside it. Copied to the end, the text counts as written.</p>
      <button className="rd-write" onClick={() => setCopying(true)} aria-label={done ? 'Copy the text out again' : 'Go on copying'}>
        <span className="rd-write-squares" aria-hidden>
          {Array.from({ length: WRITE_SQUARES }, (_, k) => {
            const c = shown[k];
            const at = from + k;
            return (
              <span key={k} className="rd-write-sq" data-state={!c ? 'empty' : done || at < copied ? 'done' : at === copied ? 'now' : undefined}>
                {c && <span className="hanzi">{c}</span>}
              </span>
            );
          })}
        </span>
        <span className="rd-write-line" aria-hidden>
          <i style={{ width: `${(copied / Math.max(1, total)) * 100}%` }} />
        </span>
        <span className="rd-write-foot">
          <span className="small muted grow">
            {done ? (
              'The whole text, copied out.'
            ) : (
              <>
                {copied ? 'Go on from' : 'Start with'} <span className="hanzi">{where}</span>
              </>
            )}
          </span>
        </span>
      </button>
      <button className="btn primary lg rd-write-go" onClick={() => setCopying(true)}>
        {done ? 'Copy it out again' : copied ? 'Go on copying' : 'Start copying'}
      </button>
      {copying && <CopyOut text={text} onClose={() => setCopying(false)} />}
    </Section>
  );
}

/** How many squares of the exercise book the Write part shows. */
const WRITE_SQUARES = 8;

/* ---------------------------------------------------------------- 问 Questions */

export function QuestionsPart({ text, partId, showPinyin }: { text: GeneratedText; partId: string; showPinyin: boolean }) {
  const answered = new Set(text.study?.answered ?? []);
  return (
    <Section id={partId} han="问" title="Questions" aside={`${answered.size} of ${text.questions.length} answered`}>
      <ol className="rd-questions">
        {text.questions.map((q, i) => (
          <li key={i} data-done={answered.has(i) || undefined}>
            {showPinyin && <p className="rd-q-py">{q.py}</p>}
            <p className="hanzi rd-q-zh">{q.zh}</p>
            {q.en && <p className="rd-q-en">{q.en}</p>}
            <AnswerBox text={text} index={i} question={q} />
          </li>
        ))}
      </ol>
    </Section>
  );
}
