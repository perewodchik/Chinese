import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Library } from '../../data/types';
import { charId } from '../../domain/ids';
import { alignPinyin, bandSpread, paragraphs, stepsAbove, wordBands } from '../../domain/reading';
import { segment, writerHints } from '../../domain/segment';
import { itemForToken } from '../../domain/words';
import { cardsFor } from '../../domain/teach';
import {
  coverageOf,
  genreLabel,
  hskLabel,
  isHanzi,
  levelLabel,
  textCharCount,
  type GeneratedText,
  type TextLine,
} from '../../domain/text';
import { useOpenItem } from '../../navigation/itemDrawer';
import { markRead, setLearned, setTextRead, toggleLearned } from '../../store/commands';
import { useStore } from '../../store/store';
import { Glyph } from '../../ui/Glyph';
import { useToast } from '../../ui/toast';
import { CollectionPicker, useCollect } from '../shared/collect';
import { useLibrary } from '../shared/library';
import { useWordKnowledge } from '../words/useWordKnowledge';
import { AnswerBox } from './AnswerBox';
import { Menu } from '../../ui/Menu';
import { SYSTEM_VOICE, prefetchFirst, useReading, type Reading } from './readAloud';

/** What the options bar has switched on, shared by every passage on the page. */
export interface ReaderView {
  layout: 'paragraph' | 'sentences';
  pinyin: boolean;
  english: boolean;
  traditional: boolean;
  markNew: boolean;
  markAbove: boolean;
  /** underline the words you have not learned */
  markUnknown: boolean;
  /** the band above which a word is marked */
  target: number;
}

/** The library's words, indexed once per library rather than once per sentence. */
const bandCache = new WeakMap<Library, Map<string, number>>();
const bandsOf = (lib: Library) => {
  let m = bandCache.get(lib);
  if (!m) bandCache.set(lib, (m = wordBands(lib)));
  return m;
};

/**
 * Which passage the voice is reading. The reading voice is one for the whole
 * app, and with a whole session on the page every passage would otherwise
 * light up its own third sentence while the second passage is being read.
 */
let speaking: string | null = null;

/**
 * One passage, on the page: the reading itself, and everything that comes
 * after it.
 *
 * The reading is the thing, so it takes the whole width of the column and
 * nothing sits beside it. What used to be a side panel — the new characters,
 * the words, the grammar, how much of it you know — is now underneath, folded
 * away until it is wanted, in the order a reader wants it: the questions
 * first, because they are what you do next.
 */
export function Passage({ text, view, heading }: { text: GeneratedText; view: ReaderView; heading?: ReactNode }) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const known = useWordKnowledge();
  const voice = useReading();
  // The shared voice, seen from this passage: reading when it is this one.
  const reading = {
    ...voice,
    at: speaking === text.id ? voice.at : null,
    loading: speaking === text.id && voice.loading,
    readAll: (lines: string[]) => {
      speaking = text.id;
      voice.readAll(lines);
    },
    readLine: (lines: string[], i: number) => {
      speaking = text.id;
      voice.readLine(lines, i);
    },
  };
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  useEffect(() => setRevealed(new Set()), [text.id]);

  const spoken = useMemo(() => text.lines.map((l) => l.zh), [text.lines]);
  const canHear = reading.system || reading.voices.length > 0 || reading.voice !== SYSTEM_VOICE;
  const toast = useToast();

  // The chosen voice's first sentence, on its way while the title is read.
  useEffect(() => prefetchFirst(spoken), [spoken, reading.voice]);

  // A reading that stopped short says why — once, from the passage it was in.
  const failed = speaking === text.id ? voice.error : null;
  useEffect(() => {
    if (failed) toast(failed);
  }, [failed, toast]);
  const paras = useMemo(() => paragraphs(text), [text]);
  const teachSet = useMemo(() => new Set(text.teach), [text.teach]);
  const newWords = useMemo(() => new Set(text.vocab.filter((w) => w.isNew).map((w) => w.w)), [text.vocab]);
  const ownWords = useMemo(() => new Set(text.vocab.map((w) => w.w)), [text.vocab]);
  const bands = bandsOf(lib);
  const showTrad = view.traditional && text.lines.some((l) => l.zht);

  /** Each sentence cut into words, once per passage. */
  const tokens = useMemo(
    // The writer's own grouping, read out of its pinyin, joins the passage's
    // vocabulary for each sentence: 广州 and 食街 are words there even though
    // no dictionary has them.
    () => text.lines.map((l) => segment(l.zh, lib, new Set([...ownWords, ...writerHints(l.zh, l.py, lib)]))),
    [text.lines, lib, ownWords],
  );
  const syllables = useMemo(() => text.lines.map((l) => alignPinyin(l, lib)), [text.lines, lib]);

  const toggleLine = (i: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  /** One sentence's characters, word by word, marked as the bar asks. */
  function sentence(i: number, withRuby: boolean) {
    const line = text.lines[i];
    // Traditional is shown when there is a whole line of it; the marks and the
    // lookups stay on the simplified, which is what the library knows.
    if (showTrad && line.zht) return <span className="trad">{line.zht}</span>;
    const py = syllables[i];
    let h = 0;
    return tokens[i].map((t, k) => {
      if (!t.word) return <Fragment key={k}>{t.text}</Fragment>;
      // A word's reading goes over the word, as one — péngyou over 朋友, the
      // way pinyin is written — not a syllable over each character, which made
      // 朋 and 友 look like two things.
      const said: string[] = [];
      const glyphs = [...t.text].map((ch, j) => {
        const e = lib.byChar.get(ch);
        if (withRuby && isHanzi(ch)) said.push(py[h++] ?? '');
        return e ? (
          <span
            key={j}
            className="ch"
            role="button"
            tabIndex={0}
            title={`${e.py[0]} — ${e.def}`}
            onClick={() => openItem(itemForToken(lib, t.text))}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') openItem(itemForToken(lib, t.text));
            }}
          >
            {ch}
          </span>
        ) : (
          <span key={j} className="ch-plain">
            {ch}
          </span>
        );
      });
      const reading = said.join('');
      const chars = reading ? (
        <ruby>
          {glyphs}
          <rt>{reading}</rt>
        </ruby>
      ) : (
        glyphs
      );
      const isNew = view.markNew && (newWords.has(t.text) || [...t.text].some((c) => teachSet.has(c)));
      const step = view.markAbove ? stepsAbove(t, view.target) : 0;
      // Only once something is known about words at all: before the sweep,
      // every word in the passage would be underlined.
      const standing = view.markUnknown && known.any ? known.status(t.text) : 'known';
      return (
        <span
          key={k}
          className="w"
          data-new={isNew || undefined}
          data-above={step || undefined}
          data-unknown={standing === 'known' ? undefined : standing}
          title={step ? `${t.text} · ${t.band ? hskLabel(t.band) : 'outside the syllabus'}` : undefined}
        >
          {chars}
        </span>
      );
    });
  }

  return (
    <article className="passage-doc" lang="zh">
      <header className="passage-head">
        <div style={{ minWidth: 0 }}>
          {heading}
          <h1 className="passage-title hanzi">{text.titleZh || text.title}</h1>
          <p className="small muted" style={{ margin: 0 }}>
            {text.title}
          </p>
          <p className="tiny muted passage-meta">
            {text.topic && text.topic !== text.title ? `${text.topic} · ` : ''}
            {genreLabel(text.genre)}, {levelLabel(text.level).toLowerCase()}
            {text.hsk ? ` · written at ${hskLabel(text.hsk)}` : ''} · {textCharCount(text)} characters
          </p>
        </div>
        {/* Fixed widths and always present — a label that changes, or a picker
            that turns up once the voices have loaded, must not move anything. */}
        <div className="passage-tools no-print">
          <ReadToggle text={text} />
          <ListenButton reading={reading} canHear={canHear} onListen={() => reading.readAll(spoken)} />
        </div>
      </header>

      {view.layout === 'paragraph' ? (
        <>
          <div className="prose-zh" data-pinyin={view.pinyin || undefined}>
            {paras.map((p, n) => (
              <p key={n}>
                {p.map((i) => (
                  <span key={i} className="sent" data-reading={reading.at === i || undefined}>
                    {sentence(i, view.pinyin)}
                  </span>
                ))}
              </p>
            ))}
          </div>
          {view.english && (
            <section className="prose-en" aria-label="Translation">
              <h2 className="doc-label">Translation</h2>
              {paras.map((p, n) => (
                <p key={n}>{p.map((i) => text.lines[i].en).filter(Boolean).join(' ')}</p>
              ))}
            </section>
          )}
        </>
      ) : (
        <div className="passage">
          {text.lines.map((l, i) => {
            const open = revealed.has(i);
            return (
              <p key={i} className="passage-line" data-revealed={open || undefined} data-reading={reading.at === i || undefined}>
                <button
                  className="n"
                  onClick={() => toggleLine(i)}
                  title={open ? 'Hide the help for this line' : 'Show the reading and the translation for this line'}
                >
                  {i + 1}
                </button>
                {(view.pinyin || open) && <span className="py">{l.py}</span>}
                <span className="zh">{sentence(i, false)}</span>
                {(view.english || open) && <span className="en">{l.en}</span>}
                {canHear && (
                  <button
                    className="say no-print"
                    title={reading.at === i ? 'Stop' : 'Hear this sentence'}
                    aria-label={reading.at === i ? 'Stop reading' : `Hear sentence ${i + 1}`}
                    onClick={() => (reading.at === i ? reading.stop() : reading.readLine(spoken, i))}
                  >
                    {reading.at === i ? '◼' : '🔊'}
                  </button>
                )}
              </p>
            );
          })}
        </div>
      )}

      {text.note.trim() && <p className="notice teacher">{text.note}</p>}

      <div className="doc-sections">
        {text.questions.length > 0 && (
          <Fold title="Questions" count={text.questions.length} open>
            <ol className="questions">
              {text.questions.map((q, i) => (
                <li key={i}>
                  <Question q={q} view={view} />
                  <div className="no-print">
                    <AnswerBox text={text} question={q} />
                  </div>
                  <div className="print-only answer-lines" aria-hidden />
                </li>
              ))}
            </ol>
          </Fold>
        )}

        {text.vocab.length > 0 && (
          <Fold title="Vocabulary" count={text.vocab.length}>
            <div className="vocab">
              {text.vocab.map((w) => {
                const band = bands.get(w.w);
                return (
                  <div key={w.w} className="vocab-row" data-new={w.isNew || undefined}>
                    <span className="hanzi">{w.w}</span>
                    <span className="tiny" style={{ color: 'var(--accent)' }}>
                      {w.py}
                    </span>
                    <span className="tiny muted">
                      {w.d}
                      {band ? <span className="band-tag">{hskLabel(band)}</span> : null}
                      {w.isNew ? <span className="band-tag new">new</span> : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </Fold>
        )}

        {text.grammar.length > 0 && (
          <Fold title="Grammar" count={text.grammar.length}>
            {text.grammar.map((g, i) => (
              <div key={i} className="grammar">
                <b>{g.point}</b>
                {g.zh && <span className="hanzi">{g.zh}</span>}
                {g.en && <span className="tiny muted">{g.en}</span>}
              </div>
            ))}
          </Fold>
        )}

        <NewCharacters text={text} />
        <Shape text={text} target={view.target} />
      </div>
    </article>
  );
}

function Question({ q, view }: { q: TextLine; view: ReaderView }) {
  return (
    <p className="question">
      {view.pinyin && <span className="py">{q.py}</span>}
      <span className="zh hanzi">{view.traditional && q.zht ? q.zht : q.zh}</span>
      {view.english && q.en && <span className="en">{q.en}</span>}
    </p>
  );
}

/**
 * A section under the passage that can be folded away.
 *
 * Not a `<details>`: a closed one is left out of the printout, and the grammar
 * and questions are exactly what a printed passage should carry. This one is
 * only hidden on screen — print shows everything in it.
 */
export function Fold({
  title,
  count,
  open: initial = false,
  children,
  printable = true,
}: {
  title: string;
  count?: number;
  open?: boolean;
  children: ReactNode;
  printable?: boolean;
}) {
  const [open, setOpen] = useState(initial);
  return (
    <section className={`fold${printable ? '' : ' no-print'}`} data-open={open || undefined}>
      <button className="fold-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="fold-title">{title}</span>
        {count !== undefined && <span className="tiny muted">{count}</span>}
        <span className="spacer" />
        <span className="fold-mark" aria-hidden>
          ‹
        </span>
      </button>
      <div className="fold-body">{children}</div>
    </section>
  );
}

/**
 * The characters this passage taught, and the moment to say you have them.
 *
 * The moment to decide you have learned one is the moment you have just read
 * it in a sentence — not a week later in a grid.
 */
function NewCharacters({ text }: { text: GeneratedText }) {
  const lib = useLibrary();
  const toast = useToast();
  const collect = useCollect();
  const learned = useStore((s) => s.learned);
  const known = useMemo(() => new Set(text.basis), [text.basis]);
  const cards = useMemo(() => cardsFor(lib, text.teach, known, text.glosses), [lib, text.teach, known, text.glosses]);
  if (!cards.length) return null;
  const unlearned = text.teach.filter((c) => !learned.has(charId(c)));

  return (
    <Fold title="New characters" count={cards.length} printable={false}>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <span className="tiny muted">Tap one you now know to mark it learned.</span>
        <div className="spacer" />
        {unlearned.length > 0 && (
          <button
            className="btn ghost sm"
            onClick={() => {
              setLearned(unlearned.map(charId), true);
              toast(`Marked ${unlearned.length} as learned`);
            }}
          >
            Mark all learned
          </button>
        )}
      </div>
      <div className="teach-list teach-grid">
        {cards.map((c) => {
          const id = charId(c.c);
          const got = learned.has(id);
          return (
            <button
              key={c.c}
              className="teach-row"
              data-learned={got}
              onClick={() => toggleLearned(id)}
              title={got ? 'Marked learned — tap to undo' : 'Mark as learned'}
            >
              <Glyph char={c.c} strokes={lib.strokes} size={30} />
              <span className="meta">
                <b>{c.py}</b>
                <i>{c.def}</i>
                {c.words[0] && (
                  <em className="hanzi">
                    {c.words[0].w} <span className="tiny muted">{c.words[0].py}</span>
                  </em>
                )}
              </span>
              <span className="tick">{got ? '✓' : '+'}</span>
            </button>
          );
        })}
      </div>
      <CollectionPicker
        className="mt"
        placeholder={`Queue these ${cards.length} for handwriting…`}
        onPick={(target) => collect(target, text.teach.map(charId), { newName: `New from “${text.title}”` })}
      />
    </Fold>
  );
}

/**
 * How much of the passage was yours, and where the rest of it came from.
 *
 * Counted here from the characters themselves. The writer is asked for its
 * own count too, and where it has one it is shown beside ours: a writer that
 * thinks it stayed inside HSK 2 and did not is worth knowing about when
 * planning the next session.
 */
function Shape({ text, target }: { text: GeneratedText; target: number }) {
  const lib = useLibrary();
  const known = useMemo(() => new Set(text.basis), [text.basis]);
  const cover = useMemo(() => coverageOf(text, known), [text, known]);
  const spread = useMemo(() => bandSpread(text, lib), [text, lib]);
  const total = [...spread.values()].reduce((a, b) => a + b, 0) || 1;
  const rows = [1, 2, 3, 4, 5, 6, 7, 0].filter((b) => spread.get(b));
  const reported = text.hskReported;

  return (
    <Fold title="How it is made" printable={false}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <h3 className="field-title" style={{ marginTop: 0 }}>
            How much of it you knew
          </h3>
          <div className="bar">
            <i className="learned" style={{ width: `${cover.ratio * 100}%` }} />
          </div>
          <p className="tiny muted" style={{ margin: '6px 0 0' }}>
            {cover.known} of {cover.total} distinct characters were already yours; {cover.fresh.length}{' '}
            {cover.fresh.length === 1 ? 'was' : 'were'} new.
          </p>
        </div>
        <div>
          <h3 className="field-title" style={{ marginTop: 0 }}>
            Characters by band
          </h3>
          <div className="band-spread">
            {rows.map((b) => (
              <div key={b} className="band-row" data-above={stepsAbove({ word: true, band: b }, target) || undefined}>
                <span className="tiny">{b ? hskLabel(b) : 'Other'}</span>
                <span className="band-bar">
                  <i style={{ width: `${((spread.get(b) ?? 0) / total) * 100}%` }} />
                </span>
                <span className="tiny muted">
                  {spread.get(b)}
                  {reported?.[String(b)] !== undefined && reported[String(b)] !== spread.get(b)
                    ? ` · Claude said ${reported[String(b)]}`
                    : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          {new Date(text.createdAt).toLocaleDateString()} · {text.model} · from {text.basis.length} characters you knew
        </p>
      </div>
    </Fold>
  );
}

/**
 * Read, or not. A passage sits in a page with others, so its own state is
 * on it rather than on the bar above them all. Marking it read still counts
 * the reading and when it was — the reader just does not need to see a tally.
 */
function ReadToggle({ text }: { text: GeneratedText }) {
  return (
    <button
      className="btn sm read-toggle"
      data-read={text.read || undefined}
      aria-pressed={text.read}
      onClick={() => (text.read ? setTextRead(text.id, false) : markRead(text.id))}
      title={text.read ? 'Read — tap to mark it unread' : 'Mark it read'}
    >
      {text.read ? '✓ Read' : 'Mark read'}
    </button>
  );
}

/**
 * Listen, with the voice it listens in behind a chevron on its right: one
 * control, not a button and a dropdown competing for the same line. While the
 * clip is being made — a second or three, longer if the model has to load —
 * the button spins rather than sitting there looking broken.
 */
function ListenButton({ reading, canHear, onListen }: { reading: Reading; canHear: boolean; onListen: () => void }) {
  const playing = reading.at !== null;
  const name =
    reading.voice === SYSTEM_VOICE ? 'System voice' : (reading.voices.find((v) => v.id === reading.voice)?.name ?? '…');
  return (
    <div className="split-btn" data-on={playing || undefined}>
      <button
        className="btn sm listen"
        disabled={!canHear}
        onClick={() => (playing ? reading.stop() : onListen())}
        title={canHear ? (playing ? 'Stop reading' : `Read the whole passage aloud — ${name}`) : 'No voice on this device'}
        aria-busy={reading.loading || undefined}
      >
        {reading.loading ? (
          <span className="spinner" aria-label="Loading the voice" />
        ) : (
          <span aria-hidden>{playing ? '◼' : '▶'}</span>
        )}
        <span>{playing && !reading.loading ? 'Stop' : 'Listen'}</span>
      </button>
      <Menu label={<span className="chev" aria-hidden>⌄</span>} title={`Voice: ${name}`} className="btn sm split-chev">
        {(close) => (
          <>
            <div className="tiny muted menu-label">Read by</div>
            {[{ id: SYSTEM_VOICE, name: 'System voice' }, ...reading.voices].map((v) => (
              <button
                key={v.id}
                role="menuitemradio"
                aria-checked={reading.voice === v.id}
                className="btn ghost sm"
                onClick={() => {
                  close();
                  reading.setVoice(v.id);
                }}
              >
                <span className="menu-check" aria-hidden>
                  {reading.voice === v.id ? '✓' : ''}
                </span>
                {v.name}
              </button>
            ))}
          </>
        )}
      </Menu>
    </div>
  );
}
