import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { charId, type ItemId } from '../../domain/ids';
import { cardsFor } from '../../domain/teach';
import { hskLabel, type GeneratedText } from '../../domain/text';
import { itemForToken } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { gradeItem, setShelfStudy, studyText } from '../../store/commands';
import { useStore } from '../../store/store';
import { Glyph } from '../../ui/Glyph';
import { Icon } from '../../ui/Icon';
import { Modal } from '../../ui/Modal';
import { WritePad } from '../review/WritePad';
import { useLibrary } from '../shared/library';
import { AnswerBox } from './AnswerBox';
import { CopyOut } from './CopyOut';
import { Dictation, openDictation } from './Dictation';
import type { Standing } from './Passage';
import { onReadThrough, RATES, type Reading } from './readAloud';

/**
 * The parts of a text, as the strip at the top of the page names them.
 *
 * They are parts of one text, not steps: read it, hear it, check what it
 * says, take the words worth having, write the new characters, answer the
 * questions — in any order, as often as you like. Each fills the line under
 * its name as it is done, so coming back to a text shows at a glance what is
 * left of it.
 */
export type PartId = 'read' | 'listen' | 'translate' | 'words' | 'write' | 'questions';

export const PARTS: Array<{ id: PartId; han: string; label: string }> = [
  { id: 'read', han: '读', label: 'Text' },
  { id: 'listen', han: '听', label: 'Listen' },
  { id: 'translate', han: '译', label: 'Translate' },
  { id: 'words', han: '词', label: 'Words' },
  { id: 'write', han: '写', label: 'Write' },
  { id: 'questions', han: '问', label: 'Questions' },
];

/** How far each part has got, from nothing (0) to done (1). */
export function partFill(text: GeneratedText, standing: (w: string) => Standing): Record<PartId, number> {
  const s = text.study ?? {};
  const words = text.vocab.length ? text.vocab.filter((w) => standing(w.w) !== 'new').length / text.vocab.length : 1;
  const chars = text.lines.reduce((n, l) => n + [...l.zh].filter((c) => /\p{Script=Han}/u.test(c)).length, 0) || 1;
  const copied = Math.min(1, (s.copied ?? 0) / chars);
  const taught = text.teach.length ? (s.written ?? []).filter((c) => text.teach.includes(c)).length / text.teach.length : copied;
  const dictated = Math.min(1, (s.dictated ?? 0) / Math.max(1, text.lines.length));
  // Three ways to write a text — its new characters, the whole text copied
  // out, the whole text from dictation — and any one done to the end is the
  // part done. As a third each, copying out every character showed a third of
  // a line, which read as work left over.
  const write = Math.max(taught, copied, dictated);
  const answered = text.questions.length ? (s.answered ?? []).length / text.questions.length : 1;
  return {
    read: text.read ? 1 : 0,
    listen: s.heard ? 1 : 0,
    translate: s.translated ? 1 : 0,
    words: Math.min(1, words),
    write: Math.min(1, write),
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

/**
 * The player: the whole text, or from any line; back and on a line at a time;
 * slower to follow; and every line in a list to follow along, lit as it is
 * read. Stopping remembers the line, so Play goes on from there.
 */
export function ListenPart({
  text,
  reading,
  spoken,
  partId,
}: {
  text: GeneratedText;
  reading: Reading;
  spoken: string[];
  partId: string;
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

  const from = (i: number) => {
    const n = Math.max(0, Math.min(spoken.length - 1, i));
    setLast(n);
    if (ios) selectLines(lines.current, n, n);
    else reading.readFrom(spoken, n);
  };
  const total = spoken.reduce((n, l) => n + [...l].length, 0) || 1;

  return (
    <Section id={partId} han="听" title="Listen" aside={text.study?.heard ? 'Heard to the end' : `${spoken.length} lines`}>
      <p className="rd-part-lede">
        Hear it once following the text, then once more without looking. Tap any line to go on from there.
      </p>

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
        {reading.choices.map((v) => (
          <button
            key={v.key}
            role="radio"
            aria-checked={v.active && !ios}
            className="chip"
            aria-pressed={v.active && !ios}
            onClick={() => {
              setIos(false);
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
            Your iPhone’s voice
          </button>
        )}
      </div>
      {ios && (
        <p className="tiny muted rd-voice-note">
          Tap a line, or Play for the whole text: it is selected, and Speak in the menu reads it in the voice set for
          Chinese in Settings, Accessibility, Spoken Content.
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
    </Section>
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

export function TranslatePart({ text, partId }: { text: GeneratedText; partId: string }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const all = open.size === text.lines.length;
  const reveal = (next: Set<number>) => {
    setOpen(next);
    if (next.size && !text.study?.translated) studyText(text.id, { translated: Date.now() });
  };
  return (
    <Section
      id={partId}
      han="译"
      title="Translate"
      aside={
        <button className="btn quiet sm rd-show-all" onClick={() => reveal(all ? new Set() : new Set(text.lines.map((_, i) => i)))}>
          {all ? 'Hide all' : 'Show all'}
        </button>
      }
    >
      <p className="rd-part-lede">Say to yourself what each line means, then tap it to check.</p>
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

export function WritePart({ text, partId }: { text: GeneratedText; partId: string }) {
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const known = useMemo(() => new Set(text.basis), [text.basis]);
  const cards = useMemo(() => cardsFor(lib, text.teach, known, text.glosses), [lib, text.teach, known, text.glosses]);
  const written = new Set(text.study?.written ?? []);
  const [writing, setWriting] = useState<number | null>(null);
  const card = writing === null ? null : cards[writing];

  const [copying, setCopying] = useState(false);
  const total = text.lines.reduce((n, l) => n + [...l.zh].filter((c) => /\p{Script=Han}/u.test(c)).length, 0);
  const copied = Math.min(total, text.study?.copied ?? 0);
  const [dictating, setDictating] = useState(false);
  const dictated = Math.min(text.lines.length, text.study?.dictated ?? 0);

  return (
    <Section id={partId} han="写" title="Write">
      <button className="rd-copy" onClick={() => setCopying(true)}>
        <span className="grow">
          <b>Copy out the text</b>
          <span className="small muted">
            {copied >= total
              ? 'Copied out to the end. Again?'
              : copied
                ? `${copied} of ${total} characters so far: go on from there`
                : 'A word or a character at a time, in your notebook'}
          </span>
        </span>
        <Icon name="chevron" />
      </button>
      <button
        className="rd-copy"
        onClick={() => {
          openDictation(text);
          setDictating(true);
        }}
      >
        <span className="grow">
          <b>Dictation</b>
          <span className="small muted">
            {dictated >= text.lines.length
              ? 'Written to the end. Again?'
              : dictated
                ? `${dictated} of ${text.lines.length} sentences so far: go on from there`
                : 'Hear a sentence, write it in your notebook, then see it'}
          </span>
        </span>
        <Icon name="chevron" />
      </button>
      {copying && <CopyOut text={text} onClose={() => setCopying(false)} />}
      {dictating && <Dictation text={text} onClose={() => setDictating(false)} />}
      {cards.length > 0 && (
        <>
          <p className="rd-part-lede rd-write-lede">
            The characters this text brought in, {cards.filter((c) => written.has(c.c)).length} of {cards.length} written. Look at
            each one, then write it from memory.
          </p>
      <div className="rd-write">
        {cards.map((c, i) => (
          <button key={c.c} className="rd-box" data-done={written.has(c.c) || undefined} onClick={() => setWriting(i)}>
            <span className="hanzi">{c.c}</span>
            <span className="rd-box-py">{c.py}</span>
          </button>
        ))}
      </div>
        </>
      )}
      {card && (
        <WriteOne
          key={card.c}
          char={card.c}
          py={card.py}
          gloss={card.def}
          strokes={lib.strokes}
          onClose={() => setWriting(null)}
          onDone={(rating) => {
            studyText(text.id, { written: [card.c] });
            // Writing it counts towards its writing schedule once it has one.
            if (recall[charId(card.c)]) gradeItem(charId(card.c), 'write', rating);
            setWriting(writing! + 1 < cards.length ? writing! + 1 : null);
          }}
        />
      )}
    </Section>
  );
}

function WriteOne({
  char,
  py,
  gloss,
  strokes,
  onClose,
  onDone,
}: {
  char: string;
  py: string;
  gloss: string;
  strokes: Parameters<typeof Glyph>[0]['strokes'];
  onClose: () => void;
  onDone: Parameters<typeof WritePad>[0]['onDone'];
}) {
  const [stage, setStage] = useState<'look' | 'write'>('look');
  return (
    <Modal title={stage === 'look' ? `${py}: ${gloss}` : 'Write it from memory'} onClose={onClose}>
      {stage === 'look' ? (
        <div className="rd-look">
          <span className="rd-look-box">
            <Glyph char={char} strokes={strokes} size={180} />
          </span>
          <p className="small muted">Trace it with your eyes, stroke by stroke, then write it without looking.</p>
          <button className="btn primary lg" onClick={() => setStage('write')}>
            Write it from memory
          </button>
        </div>
      ) : (
        <WritePad char={char} py={py} gloss={gloss} onDone={onDone} />
      )}
    </Modal>
  );
}

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
