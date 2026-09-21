import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { charId } from '../../domain/ids';
import type { PaletteId, StyleId } from '../../domain/sheet';
import { cardsFor } from '../../domain/teach';
import {
  coverageOf,
  genreLabel,
  levelLabel,
  textCharCount,
  type GeneratedText,
  type TextSet,
} from '../../domain/text';
import { useOpenItem } from '../../navigation/itemDrawer';
import { paths } from '../../navigation/paths';
import { renderReading, renderTextSet } from '../../pdf/render';
import { PALETTES, STYLES } from '../../pdf/theme';
import {
  deleteText,
  markRead,
  setLearned,
  setSettings,
  setTextRead,
  toggleLearned,
} from '../../store/commands';
import { useStore } from '../../store/store';
import { Glyph } from '../../ui/Glyph';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { CollectionPicker, useCollect } from '../shared/collect';
import { useLibrary } from '../shared/library';
import { usePdfExport } from '../shared/usePdfExport';
import { SYSTEM_VOICE, useReading } from './readAloud';
import { readerSheet } from './readerSheet';

interface Props {
  text: GeneratedText;
  /** the session it belongs to, when it belongs to one */
  set: TextSet | null;
  /** that session's texts in reading order, or this one alone */
  siblings: GeneratedText[];
  index: number;
}

/**
 * One passage, read on screen or taken to the printer.
 *
 * Two things are worth keeping here. The coverage line, because a passage is
 * only worth reading if you can read it and the model is trusted but checked.
 * And the new characters, because the moment to decide you have learned one is
 * the moment you have just read it in a sentence — not a week later in a grid.
 */
export function TextView({ text, set, siblings, index }: Props) {
  useTitle(text.titleZh || text.title);
  const lib = useLibrary();
  const navigate = useNavigate();
  const openItem = useOpenItem();
  const toast = useToast();
  const collect = useCollect();
  const pdf = usePdfExport();
  const reading = useReading();
  const settings = useStore((s) => s.settings);
  const learned = useStore((s) => s.learned);
  const [pinyin, setPinyin] = useState(true);
  const [english, setEnglish] = useState(true);
  /**
   * Lines opened one at a time, when the help is switched off.
   *
   * The default state of a passage should cost you something: with the pinyin
   * showing above every line you read the pinyin, not the characters, and come
   * away having practised the alphabet you already knew. Turning it off and
   * opening one line when you are stuck is the same passage doing far more
   * work — and it stays a click away, which is the point.
   */
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  // The lines opened in one passage are not the lines to open in the next. The
  // pinyin and translation switches carry on, though: that is a way of reading.
  useEffect(() => setRevealed(new Set()), [text.id]);

  const prev = siblings[index - 1] ?? null;
  const next = siblings[index + 1] ?? null;
  const total = siblings.length;

  const spoken = useMemo(() => text.lines.map((l) => l.zh), [text.lines]);
  const canHear = reading.system || reading.voices.length > 0;

  const known = useMemo(() => new Set(text.basis), [text.basis]);
  const cover = useMemo(() => coverageOf(text, known), [text, known]);
  const cards = useMemo(
    () => cardsFor(lib, text.teach, known, text.glosses),
    [lib, text.teach, known, text.glosses],
  );
  const teachSet = useMemo(() => new Set(text.teach), [text.teach]);

  /**
   * Moving on marks the one behind you as read. Nobody clicks "mark read" on
   * the way out of a passage they have just finished; they click "next".
   */
  function go(to: GeneratedText) {
    if (!text.read) setTextRead(text.id, true);
    navigate(paths.text(to.id));
  }

  const sheet = readerSheet(settings);
  const printOptions = {
    footerNote: settings.footerNote,
    practice: settings.readerPractice,
    perPage: settings.practicePerPage,
  };

  function passagePdf() {
    void pdf.run('passage', {
      title: text.title,
      render: () => renderReading(lib, text, sheet, { ...printOptions, pinyin, english }),
    });
  }

  function sessionPdf() {
    if (!set) return;
    void pdf.run(set.id, {
      title: set.name,
      render: () => renderTextSet(lib, set.name, siblings, sheet, printOptions),
    });
  }

  function remove() {
    if (!confirm(`Delete “${text.title}”?`)) return;
    // Off the page first: once the text is gone there is nothing here to show.
    navigate(paths.texts(), { replace: true, flushSync: true });
    deleteText(text.id);
  }

  const unlearned = text.teach.filter((c) => !learned.has(charId(c)));

  return (
    <section className="reading">
      <div className="editor-bar">
        <Link className="btn ghost sm" to={paths.texts()} title="Back to all texts">
          ←
        </Link>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <b className="hanzi" style={{ fontSize: 19 }}>
              {text.titleZh}
            </b>
            <span className="small muted">{text.title}</span>
          </div>
          {set && (
            <p className="tiny muted" style={{ margin: 0 }}>
              {set.name} · {index + 1} of {total}
            </p>
          )}
        </div>
        <div className="spacer" />
        {total > 1 && (
          <div className="seg sm" role="group" aria-label="Move through the session">
            <button disabled={!prev} onClick={() => prev && go(prev)} title="Previous passage">
              ←
            </button>
            <button disabled={!next} onClick={() => next && go(next)} title="Next passage">
              →
            </button>
          </div>
        )}
        <ReadCount text={text} />
        <button className="btn sm" onClick={passagePdf} disabled={pdf.busy !== null}>
          {pdf.busy === 'passage' ? 'Building…' : 'This one as PDF'}
        </button>
        {set && (
          <button className="btn primary" onClick={sessionPdf} disabled={pdf.busy !== null}>
            {pdf.busy === set.id ? 'Building…' : 'Print the session'}
          </button>
        )}
      </div>

      <div className="scope-bar reading-bar">
        <div className="chips">
          <button className="chip" aria-pressed={pinyin} onClick={() => setPinyin(!pinyin)}>
            Pinyin
          </button>
          <button className="chip" aria-pressed={english} onClick={() => setEnglish(!english)}>
            Translation
          </button>
        </div>

        {canHear && (
          <div className="read-aloud">
            <button
              className={`btn sm${reading.at !== null ? ' primary' : ''}`}
              onClick={() => (reading.at !== null ? reading.stop() : reading.readAll(spoken))}
              title={reading.at !== null ? 'Stop reading' : 'Read the whole passage aloud'}
            >
              {reading.at !== null ? `◼ Stop — ${reading.at + 1}/${spoken.length}` : '▶ Read it aloud'}
            </button>
            {reading.voices.length > 0 && (
              <label className="field" style={{ width: 138 }}>
                <select
                  value={reading.voice}
                  aria-label="Reading voice"
                  onChange={(e) => reading.setVoice(e.target.value)}
                >
                  {reading.system && <option value={SYSTEM_VOICE}>System voice</option>}
                  {reading.voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        <div className="spacer" />
        <span className="tiny muted">
          {text.topic} · {genreLabel(text.genre).toLowerCase()}, {levelLabel(text.level).toLowerCase()} ·{' '}
          {text.lines.length} sentences · {textCharCount(text)} characters · from {text.basis.length} you know
        </span>
        <p className="tiny muted scope-note">
          The PDF prints what you have showing. With them off, click a line's number to open just that line —
          and any character to look it up.
        </p>
      </div>

      <div className="split reading-split">
        <div className="card">
          <div className="body passage">
            {text.lines.map((l, i) => {
              const open = revealed.has(i);
              return (
                <p
                  key={i}
                  className="passage-line"
                  data-revealed={open || undefined}
                  data-reading={reading.at === i || undefined}
                >
                  <button
                    className="n"
                    onClick={() =>
                      setRevealed((prevLines) => {
                        const nextLines = new Set(prevLines);
                        if (nextLines.has(i)) nextLines.delete(i);
                        else nextLines.add(i);
                        return nextLines;
                      })
                    }
                    title={open ? 'Hide the help for this line' : 'Show the reading and the translation for this line'}
                  >
                    {i + 1}
                  </button>
                  {(pinyin || open) && <span className="py">{l.py}</span>}
                  <span className="zh">
                    {[...l.zh].map((ch, j) => {
                      const e = lib.byChar.get(ch);
                      if (!e) return <span key={j}>{ch}</span>;
                      return (
                        <span
                          key={j}
                          className={`ch${teachSet.has(ch) ? ' fresh' : ''}`}
                          role="button"
                          tabIndex={0}
                          title={`${e.py[0]} — ${e.def}`}
                          onClick={() => openItem(charId(ch))}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter') openItem(charId(ch));
                          }}
                        >
                          {ch}
                        </span>
                      );
                    })}
                  </span>
                  {(english || open) && <span className="en">{l.en}</span>}
                  {canHear && (
                    <button
                      className="say"
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

            {text.grammar.length > 0 && (
              <>
                <div className="subtle-rule" />
                <h2 style={{ fontSize: 13, margin: '0 0 10px' }}>What this text is showing you</h2>
                {text.grammar.map((g, i) => (
                  <div key={i} className="grammar">
                    <b>{g.point}</b>
                    {g.zh && <span className="hanzi">{g.zh}</span>}
                    {g.en && <span className="tiny muted">{g.en}</span>}
                  </div>
                ))}
              </>
            )}

            {text.note.trim() && <p className="notice teacher">{text.note}</p>}

            {text.questions.length > 0 && (
              <>
                <div className="subtle-rule" />
                <h2 style={{ fontSize: 13, margin: '0 0 10px' }}>Questions</h2>
                {text.questions.map((q, i) => (
                  <p key={i} className="passage-line">
                    {pinyin && <span className="py">{q.py}</span>}
                    <span className="zh" style={{ fontSize: 17 }}>
                      {q.zh}
                    </span>
                    {english && <span className="en">{q.en}</span>}
                  </p>
                ))}
              </>
            )}

            {total > 1 && (
              <div className="read-on">
                {next ? (
                  <>
                    <span className="tiny muted">Next in {set?.name ?? 'this session'}</span>
                    <button className="btn primary" onClick={() => go(next)}>
                      <span className="hanzi">{next.titleZh || next.title}</span> →
                    </button>
                  </>
                ) : (
                  <>
                    <span className="tiny muted">That is the last one — {total} passages read.</span>
                    <button
                      className="btn"
                      onClick={() => {
                        if (!text.read) setTextRead(text.id, true);
                        navigate(paths.texts());
                      }}
                    >
                      Back to the shelf
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="card side">
          <div className="body" style={{ display: 'grid', gap: 16 }}>
            {cards.length > 0 && (
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <h3 className="field-title" style={{ marginTop: 0 }}>
                    New in this text
                  </h3>
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
                <div className="teach-list">
                  {cards.map((c) => {
                    const id = charId(c.c);
                    const got = learned.has(id);
                    return (
                      <button
                        key={c.c}
                        className="teach-row"
                        data-learned={got}
                        onClick={() => toggleLearned(id)}
                        title={got ? 'Marked learned — click to undo' : 'Mark as learned'}
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
                  onPick={(target) =>
                    collect(target, text.teach.map(charId), { newName: `New from “${text.title}”` })
                  }
                />
              </div>
            )}

            <div>
              <h3 className="field-title" style={{ marginTop: 0 }}>
                How much of it you know
              </h3>
              <div className="bar">
                <i className="learned" style={{ width: `${cover.ratio * 100}%` }} />
              </div>
              <p className="tiny muted" style={{ margin: '6px 0 0' }}>
                {cover.known} of {cover.total} distinct characters were already yours; {cover.fresh.length}{' '}
                {cover.fresh.length === 1 ? 'was' : 'were'} new.
              </p>
            </div>

            {text.vocab.length > 0 && (
              <div>
                <h3 className="field-title">Words</h3>
                <div className="vocab">
                  {text.vocab.map((w) => (
                    <div key={w.w} className="vocab-row" data-new={w.isNew || undefined}>
                      <span className="hanzi">{w.w}</span>
                      <span className="tiny" style={{ color: 'var(--accent)' }}>
                        {w.py}
                      </span>
                      <span className="tiny muted">{w.d}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="field-title">Printed look</h3>
              <div className="swatches">
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    className="swatch-option"
                    aria-pressed={settings.readerPalette === p.id}
                    title={p.blurb}
                    onClick={() => setSettings({ readerPalette: p.id as PaletteId })}
                    style={{ background: p.swatch[1], color: p.swatch[2] }}
                  >
                    <span className="dab" style={{ background: p.swatch[0] }} />
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="chips" style={{ marginTop: 8 }}>
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    className="chip"
                    aria-pressed={settings.readerStyle === s.id}
                    onClick={() => setSettings({ readerStyle: s.id as StyleId })}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              {text.teach.length > 0 && (
                <label className="toggle" style={{ marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={settings.readerPractice}
                    onChange={(e) => setSettings({ readerPractice: e.target.checked })}
                  />
                  <span>
                    Practice sheets behind the reading
                    <span className="d">
                      The same block a worksheet uses, for the {text.teach.length} new characters
                    </span>
                  </span>
                </label>
              )}
            </div>
          </div>

          <footer className="card-foot">
            <span className="tiny muted">
              {new Date(text.createdAt).toLocaleDateString()} · {text.model}
            </span>
            <div className="spacer" />
            <button className="btn danger sm" onClick={remove}>
              Delete
            </button>
          </footer>
        </div>
      </div>
    </section>
  );
}

/** Six days: long enough that a second pass is reading rather than remembering. */
const RIPE = 6 * 86_400_000;

/**
 * How many times this has been read, and an invitation to do it again.
 *
 * Re-reading a passage you have already understood is one of the few things
 * that moves reading *speed* rather than vocabulary, and it is the thing a
 * reader never thinks to do unaided — a text that has been read once feels
 * finished. So the count is kept, and once it has had time to go cold the
 * button stops saying "mark read" and starts asking.
 */
function ReadCount({ text }: { text: GeneratedText }) {
  const reads = text.reads ?? (text.read ? 1 : 0);
  const cold = text.lastReadAt ? Date.now() - text.lastReadAt > RIPE : false;
  const days = text.lastReadAt ? Math.round((Date.now() - text.lastReadAt) / 86_400_000) : 0;

  return (
    <button
      className={`btn sm${reads ? ' primary' : ''}`}
      onClick={() => markRead(text.id)}
      title={
        reads
          ? `Read ${reads} time${reads === 1 ? '' : 's'}${text.lastReadAt ? `, last ${days} day${days === 1 ? '' : 's'} ago` : ''}`
          : 'Mark it read'
      }
    >
      {!reads ? 'Mark read' : cold ? `Read it again — ${days}d` : `✓ Read ${reads}×`}
    </button>
  );
}
