import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import type { ItemId } from '../../domain/ids';
import { hskLabel, shelfEntries, shelve, type GeneratedText, type ShelfEntry, type TextSet } from '../../domain/text';
import { paths, type ReadMode, type TextVersion } from '../../navigation/paths';
import { readHash, writeHash } from '../../navigation/hash';
import { renderReading, renderTextSet } from '../../pdf/render';
import { dayKey } from '../../domain/activity';
import { deleteText, markRead, setSettings, setTextRead, studyText } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { Modal } from '../../ui/Modal';
import { PalettePicker } from '../../ui/PalettePicker';
import { useTitle } from '../../ui/useTitle';
import { setPageColour } from '../../ui/colorScheme';
import { bookOf, bookTitle, chapterHead, isFrontMatter, kindOf } from '../../domain/bookshelf';
import { ChapterEnd } from './ChapterEnd';
import { BookContents } from './BookContents';
import { WordPeek, type Peeked } from './WordPeek';
import { ChapterTabs, SpeakPart, tabOfHash, useLineBests, type ChapterTab, type TabInfo } from './ChapterTabs';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useLibrary } from '../shared/library';
import { usePdfExport } from '../shared/usePdfExport';
import { Passage, useWordDone, type ReaderView } from './Passage';
import { onReadThrough, prefetchPassage, useReading } from './readAloud';
import {
  PAPER_HAN,
  PAPER_LABEL,
  PAPER_MODES,
  PICTURE_LABEL,
  PICTURE_MODES,
  PINYIN_LABEL,
  PINYIN_MODES,
  TRANSLATION_LABEL,
  TRANSLATION_MODES,
  useGlossMode,
  usePaperMode,
  usePictureMode,
  usePinyinMode,
  useTranslationMode,
  type GlossMode,
  type PaperMode,
  type PictureMode,
  type PinyinMode,
  type TranslationMode,
} from './readerView';
import { DockPlayer, type PlayerControl } from './DockPlayer';
import { readerSheet } from './readerSheet';
import { rememberReading } from './lastRead';
import { ListenPart, MorePart, partFill, QuestionsPart, WordsPart, WritePart } from './TextParts';
import './reader.css';

/**
 * /texts/:id — a shelf of texts read one at a time, or one text on its own.
 *
 * The address names the shelf, and the query says where in it: `?page=2`
 * for its second text, `?v=easy` for the easier retelling of a text that has
 * one, `?mode=all` for every text on one page. An address naming a single
 * passage — every link from before shelves had pages of their own — lands
 * on its page there.
 */
export function ReaderPage() {
  const { textId: id = '' } = useParams();
  const [params] = useSearchParams();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const shelf = useMemo(() => shelve(texts, sets), [texts, sets]);

  const set = sets.find((s) => s.id === id) ?? null;
  if (set) {
    const list = shelf.bySet.get(set.id) ?? [];
    if (!list.length) return <Missing />;
    const mode: ReadMode = params.get('mode') === 'all' ? 'all' : 'single';
    const v = params.get('v');
    const version: TextVersion | null = v === 'easy' || v === 'book' ? v : null;
    return <Reader set={set} list={list} mode={mode} page={Number(params.get('page')) || 1} version={version} />;
  }

  const text = texts.find((t) => t.id === id);
  if (!text) return <Missing />;
  const home = text.setId ? sets.find((s) => s.id === text.setId) : undefined;
  if (home) {
    const entries = shelfEntries(shelf.bySet.get(home.id) ?? [text]);
    const at = entries.findIndex((e) => e.easier?.id === text.id || e.original?.id === text.id);
    const entry = entries[at];
    const version: TextVersion | undefined =
      entry?.easier && entry.original ? (entry.easier.id === text.id ? 'easy' : 'book') : undefined;
    return <Navigate to={paths.reading(home.id, { page: at + 1, version })} replace />;
  }
  return <Reader set={null} list={[text]} mode="single" page={1} version={null} />;
}

function Missing() {
  useTitle('Text not found');
  return (
    <div className="empty">
      <span className="big">读</span>
      <p>This text is not on the shelf. It may have been deleted, here or on another device.</p>
      <Link className="btn" to={paths.read()}>
        Back to Read
      </Link>
    </div>
  );
}

/** Which version an entry opens on: the one asked for, else the retelling until it has been read, else the book's. */
function versionOf(entry: ShelfEntry, asked: TextVersion | null): GeneratedText {
  if (asked === 'easy' && entry.easier) return entry.easier;
  if (asked === 'book' && entry.original) return entry.original;
  if (entry.easier && entry.original && !entry.easier.read && !entry.original.read) return entry.easier;
  return entry.main;
}

interface ReaderProps {
  set: TextSet | null;
  list: GeneratedText[];
  mode: ReadMode;
  page: number;
  version: TextVersion | null;
}

/**
 * The text page: the text, and the parts of it underneath — or beside it, on
 * a screen wide enough to have both.
 *
 * Everything that changes how it reads is in four buttons at the bottom
 * edge, under the thumb: the narrator's reading to listen to, and Aa for
 * pinyin, translation and the rest.
 * Printing, which used to be the loudest button on the page, is in ⋯.
 */
function Reader({ set, list, mode, page: asked, version }: ReaderProps) {
  const entries = useMemo(() => shelfEntries(list), [list]);
  const total = entries.length;
  const page = Math.min(total, Math.max(1, asked));
  const entry = entries[page - 1]!;
  const text = versionOf(entry, version);
  const both = Boolean(entry.easier && entry.original);
  // A story read as a book counts its chapters, the page of who is who before them not one of them.
  const story = Boolean(set) && kindOf(list) === 'story';
  const chapterAt = (at: number) =>
    story && !isFrontMatter(entries[at]!.main) ? entries.slice(0, at + 1).filter((e) => !isFrontMatter(e.main)).length : null;
  const chapters = story ? entries.filter((e) => !isFrontMatter(e.main)).length : 0;
  const easier = both && text === entry.easier;
  const where =
    mode === 'all'
      ? story
        ? `All ${chapters} chapters`
        : `All ${total} texts`
      : !set
        ? 'A text on its own'
        : story
          ? chapterAt(page - 1) === null
            ? 'Before the chapters'
            : `Chapter ${chapterAt(page - 1)} of ${chapters}${easier ? ', easier' : ''}`
          : `Text ${page} of ${total}${easier ? ', easier' : ''}`;
  const barName = set ? bookTitle(set.name) : text.titleZh || text.title;
  useTitle(mode === 'all' && set ? set.name : text.titleZh || text.title);

  const navigate = useNavigate();
  const settings = useStore((s) => s.settings);
  const study = useMemo(() => new Set<ItemId>(set?.study ?? []), [set?.study]);
  const wordDone = useWordDone(study);
  const [pinyin, setPinyin] = usePinyinMode();
  const [translation, setTranslation] = useTranslationMode();
  const [pictures, setPictures] = usePictureMode();
  const [paper, setPaper] = usePaperMode();
  const [glosses, setGlosses] = useGlossMode();
  const [contents, setContents] = useState(false);
  // A tapped word's card; the whole drawer is a tap on it away.
  const [peek, setPeek] = useState<(Peeked & { key: string }) | null>(null);
  const closePeek = useCallback(() => setPeek(null), []);
  const openItem = useOpenItem();
  useEffect(() => setPeek(null), [text.id]);
  const closeContents = useCallback(() => setContents(false), []);
  // Sepia and Night are this page's: on while it is open, the app's own colours back when it closes.
  // Before the first paint, so a sepia page never shows white for a moment.
  useLayoutEffect(() => {
    setPageColour(paper === 'paper' ? null : paper);
  }, [paper]);
  useLayoutEffect(() => () => setPageColour(null), []);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState<number | null>(null);
  // The line the narrator is reading, lit in the text, and kept in sight.
  const [narrLine, setNarrLine] = useState<number | null>(null);
  // The narrator's row shows only while it is wanted: the listen button opens and starts it, ✕ or the button closes it.
  const [listening, setListening] = useState(false);
  const player = useRef<PlayerControl | null>(null);
  useEffect(() => setListening(false), [text.id]);
  function listen() {
    if (listening) {
      player.current?.stop();
      setListening(false);
    } else {
      setListening(true);
      player.current?.start();
    }
  }
  useEffect(() => {
    if (narrLine === null) return;
    const el = document.getElementById(`line-${text.id}-${narrLine}`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Under the bar and the player at the top, or off the bottom: brought back, gently.
    const pinned = document.querySelector('.rd-pin')?.getBoundingClientRect().bottom ?? 120;
    if (r.top < pinned + 8 || r.bottom > window.innerHeight - 24) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [narrLine, text.id]);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => setRevealed(new Set()), [text.id]);

  const view: ReaderView = {
    layout: settings.readerLayout,
    pinyin,
    translation,
    traditional: settings.readerTraditional,
    markUnknown: settings.markUnknown,
    markAbove: settings.markAbove,
    target: settings.targetHsk,
    // Dialogue as a comic is no longer offered: a dialogue reads as any text.
    comic: false,
    pictures,
    glosses: glosses === 'on',
  };

  /* -------------------------------------------------------- the voice */
  const spoken = useMemo(() => text.lines.map((l) => l.zh), [text.lines]);
  const reading = useReading(spoken);
  useEffect(() => prefetchPassage(spoken, reading.voice), [spoken, reading.voice]);
  // Heard to the end is the Listen part done, once more; read through a ref so a listening ending counts the latest number.
  const listensRef = useRef(text.study?.listens ?? (text.study?.heard ? 1 : 0));
  listensRef.current = text.study?.listens ?? (text.study?.heard ? 1 : 0);
  useEffect(
    () =>
      onReadThrough((lines) => {
        if (lines.length === spoken.length && lines.every((l, i) => l === spoken[i])) {
          studyText(text.id, { heard: Date.now(), listened: spoken.length, listens: (listensRef.current ?? 0) + 1 });
        }
      }),
    [spoken, text.id],
  );

  /* -------------------------------------------------------- moving about */
  const address = useCallback(
    (to: { page?: number; mode?: ReadMode; version?: TextVersion }) =>
      set ? paths.reading(set.id, to) : paths.text(text.id),
    [set, text.id],
  );
  const go = (to: number) => navigate(address({ page: to }));

  // Where Read and Today offer to come back to.
  useEffect(() => {
    if (mode !== 'single') return;
    rememberReading({ textId: text.id, setId: set?.id ?? null, page, version: both ? (text === entry.easier ? 'easy' : 'book') : null, at: Date.now() });
  }, [text, set?.id, page, mode, both, entry.easier]);

  // A new text starts at its top, not wherever the last one was scrolled to.
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [text.id, mode]);

  // The arrow keys turn pages, as they do in every reader — but not while typing an answer.
  useEffect(() => {
    if (mode !== 'single' || total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      // Something open over the text — copying it out, a drawer, a panel — has the keys to itself.
      if (e.defaultPrevented || document.querySelector('[role="dialog"], .drawer, .rd-aa-panel')) return;
      if (e.key === 'ArrowRight' && page < total) go(page + 1);
      if (e.key === 'ArrowLeft' && page > 1) go(page - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** A line pointed at from a grammar note: brought into view and lit for a moment. */
  function showLine(i: number) {
    document.getElementById(`line-${text.id}-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(i);
    window.setTimeout(() => setFlash((f) => (f === i ? null : f)), 1600);
  }

  function reveal(i: number) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
    if (!text.study?.translated) studyText(text.id, { translated: Date.now() });
  }

  /** A line tapped on its comic page's photo: brought into view, lit, and its English opened. */
  function point(i: number) {
    if (!revealed.has(i)) reveal(i);
    document.getElementById(`line-${text.id}-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setFlash(i);
    window.setTimeout(() => setFlash((f) => (f === i ? null : f)), 1600);
  }

  // Shown whole is the translation looked at.
  useEffect(() => {
    if (translation === 'shown' && !text.study?.translated) studyText(text.id, { translated: Date.now() });
  }, [translation, text.id, text.study?.translated]);

  const fill = partFill(text, wordDone);
  const bests = useLineBests(text.id);
  const saidLines = text.lines.filter((l) => bests[l.zh] !== undefined).length;
  // The chapter's tabs: the text, then what there is to do with it, named as the end of the text names them (V6). No questions, no Questions.
  const tabs: TabInfo[] = [
    { id: 'read', han: '读', label: 'Read', fill: fill.read },
    { id: 'write', han: '写', label: 'Write', fill: fill.write },
    { id: 'speak', han: '说', label: 'Say', fill: text.lines.length ? saidLines / text.lines.length : 0 },
    { id: 'words', han: '词', label: 'Words', fill: text.vocab.length ? fill.words : 0 },
    ...(text.questions.length ? [{ id: 'questions' as const, han: '问', label: 'Questions', fill: fill.questions }] : []),
  ];
  // The tab is kept in the address (#words), so a reload, or the same link on
  // the iPad, opens on it again. Copying out or dictation open over the text
  // (#copy, #dictation) open on Write, which they belong to.
  const [tab, setTab] = useState<ChapterTab>(() => tabOfHash(readHash()));
  useEffect(() => {
    setTab((t) => (t === 'read' ? t : tabOfHash(readHash())));
  }, [text.id]);
  const shownTab: ChapterTab = mode === 'single' && tabs.some((t) => t.id === tab) ? tab : 'read';
  function pick(t: ChapterTab) {
    setTab(t);
    writeHash(t === 'read' ? null : t);
    top.current?.scrollIntoView({ block: 'start' });
  }

  /** Read, or not read after all: ticked again the same day is a slip taken back, not a second reading. */
  function toggleRead() {
    if (text.read) setTextRead(text.id, false);
    else if (text.lastReadAt && dayKey(text.lastReadAt) === dayKey(Date.now())) setTextRead(text.id, true);
    else markRead(text.id);
  }

  const shown = mode === 'all' ? entries.map((e) => versionOf(e, null)) : [text];
  const next = page < total ? versionOf(entries[page]!, null) : null;

  return (
    <div className="rd" ref={top} data-mode={mode} style={{ '--reader-scale': settings.readerScale } as CSSProperties}>
      {/* The bar, stuck to the top and opaque from the screen's edge down. */}
      <div className="rd-pin no-print">
      <header className="rd-top">
        <Link className="rd-back" to={set ? paths.shelf(set.id) : paths.read()} aria-label={set ? `Back to ${bookTitle(set.name)}` : 'Back to Read'} title={set ? `Back to ${bookTitle(set.name)}` : 'Back to Read'}>
          <Icon name="back" size={24} />
        </Link>
        {set && total > 1 && (
          <button className="rd-toc-btn" aria-label={story ? 'Chapters' : 'Texts on this shelf'} title={story ? 'Chapters' : 'Texts on this shelf'} aria-expanded={contents} onClick={() => setContents(true)}>
            <Icon name="contents" size={22} />
          </button>
        )}
        <div className="rd-where">
          {/* 楷体 for a Chinese name; a shelf named in English keeps the app's own type. */}
          <b className={/\p{Script=Han}/u.test(barName) ? 'hanzi' : undefined}>{barName}</b>
          <span>{where}</span>
        </div>
        <span className="spacer" />
        {mode === 'single' && <ChapterTabs tabs={tabs} current={shownTab} onPick={pick} place="bar" />}
        {mode === 'single' && <span className="spacer rd-tabs-gap" />}
        {mode === 'single' && both && (
          <div className="rd-versions" role="group" aria-label="Version">
            <button
              aria-pressed={text === entry.easier}
              title="The easier retelling"
              aria-label="The easier retelling"
              onClick={() => navigate(address({ page, version: 'easy' }), { replace: true })}
            >
              简
            </button>
            <button
              aria-pressed={text === entry.original}
              title="The book’s own text"
              aria-label="The book’s own text"
              onClick={() => navigate(address({ page, version: 'book' }), { replace: true })}
            >
              原
            </button>
          </div>
        )}
        <AaMenu
          pinyin={pinyin}
          setPinyin={setPinyin}
          translation={translation}
          setTranslation={setTranslation}
          hasTrad={list.some((t) => t.lines.some((l) => l.zht))}
          hasPictures={list.some((t) => t.pictures?.some((p) => p.key))}
          pictures={pictures}
          setPictures={setPictures}
          paper={paper}
          setPaper={setPaper}
          glosses={glosses}
          setGlosses={setGlosses}
        />
        <ReaderMenu
          set={set}
          list={list}
          text={text}
          mode={mode}
          onMode={(m) => navigate(address(m === 'all' ? { mode: 'all' } : { page }))}
        />
      </header>
      {/* The narrator, under the bar and pinned with it: the bottom edge is
          left to the text and to a tapped word's card. */}
      {mode === 'single' && (
        <div className="rd-dock" hidden={!listening}>
          <DockPlayer
            text={text}
            reading={reading}
            spoken={spoken}
            onLine={setNarrLine}
            control={player}
            onClose={() => {
              player.current?.stop();
              setListening(false);
            }}
          />
        </div>
      )}
      <ReadingProgress textId={text.id} />
      </div>

      <div className="rd-text" data-layout={settings.readerLayout} hidden={shownTab !== 'read'}>
        {shown.map((t, i) => (
          <Passage
            key={t.id}
            text={t}
            view={view}
            reading={t.id === text.id && listening ? (narrLine ?? reading.at) : null}
            flash={t.id === text.id ? flash : null}
            revealed={t.id === text.id ? revealed : new Set()}
            onReveal={reveal}
            onPoint={point}
            retold={Boolean(entry.original) && t.id === entry.easier?.id}
            study={study}
            heading={mode === 'all' && !story ? <p className="rd-kicker">Text {i + 1} of {total}</p> : null}
            head={chapterHead(t, chapterAt(mode === 'all' ? i : page - 1))}
            titleAction={
              mode === 'single' ? (
                <button
                  className="rd-listen-btn"
                  aria-pressed={listening}
                  aria-label={listening ? 'Close the narrator' : 'Listen: the narrator reads it to you'}
                  title={listening ? 'Close the narrator' : 'Listen: the narrator reads it to you'}
                  onClick={listen}
                >
                  <Icon name="listen" size={22} />
                </button>
              ) : null
            }
            onWord={(p) => setPeek((was) => (was?.key === p.key && was.el === p.el ? null : p))}
            peekKey={peek?.key ?? null}
          />
        ))}
      </div>

      {peek && (
        <WordPeek
          peek={peek}
          setId={set?.id ?? null}
          onShelf={study.has(peek.id)}
          onMore={() => {
            setPeek(null);
            openItem(peek.id);
          }}
          onClose={closePeek}
        />
      )}

      {contents && set && (
        <BookContents set={set} book={bookOf(set, list)} entries={entries} page={mode === 'single' ? page : 0} onClose={closeContents} />
      )}

      {mode === 'single' && (
        <div className="rd-study no-print" data-tab={shownTab}>
          {shownTab === 'read' && (
            <>
              <ChapterEnd
                text={text}
                kicker={chapterHead(text, chapterAt(page - 1)).kicker}
                chapter={story}
                parts={['write', 'speak', 'words', ...(text.questions.length ? (['questions'] as const) : []), 'listen']}
                fill={fill}
                speak={{ said: saidLines, of: text.lines.length }}
                onPart={(p) => (p === 'listen' ? !listening && listen() : pick(p === 'more' ? 'write' : (p as ChapterTab)))}
                next={
                  next
                    ? {
                        ...chapterHead(next, chapterAt(page)),
                        where: story ? `Chapter ${chapterAt(page)} of ${chapters}` : `Text ${page + 1} of ${total}`,
                        action: story ? `Read chapter ${chapterAt(page)}` : 'Read the next text',
                      }
                    : null
                }
                book={set && story ? bookOf(set, list) : null}
                onNext={() => {
                  // Going on from the end is having read it: counted once, as the tick did.
                  if (!text.read) toggleRead();
                  go(page + 1);
                }}
                onToggleRead={toggleRead}
                onAgain={() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              />
              <ListenPart text={text} reading={reading} spoken={spoken} partId="part-listen" />
            </>
          )}
          {shownTab === 'write' && (
            <>
              <WritePart text={text} partId="part-write" />
              <MorePart text={text} partId="part-more" />
            </>
          )}
          {shownTab === 'speak' && <SpeakPart text={text} bests={bests} />}
          {shownTab === 'words' && <WordsPart text={text} setId={set?.id ?? null} study={study} onShowLine={(i) => (pick('read'), window.setTimeout(() => showLine(i), 60))} partId="part-words" />}
          {shownTab === 'questions' && text.questions.length > 0 && (
            <QuestionsPart key={`q${text.id}`} text={text} partId="part-questions" showPinyin={pinyin === 'all'} />
          )}
        </div>
      )}

      {mode === 'single' && <ChapterTabs tabs={tabs} current={shownTab} onPick={pick} place="bottom" />}
    </div>
  );
}

/**
 * How far down the text you are, as a hairline under the bar: nothing at its
 * top, all of it once its last line is on the screen. The text scrolls with
 * the page on a phone and in its own column on a wide screen; either is read.
 * The width is set on the line itself, so scrolling renders nothing.
 */
function ReadingProgress({ textId }: { textId: string }) {
  const line = useRef<HTMLElement>(null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = document.querySelector<HTMLElement>('.rd-text');
      if (!el || !line.current) return;
      let done: number;
      if (getComputedStyle(el).overflowY === 'auto') {
        const room = el.scrollHeight - el.clientHeight;
        done = room > 0 ? el.scrollTop / room : 1;
      } else {
        const bar = document.querySelector('.rd-pin')?.getBoundingClientRect().bottom ?? 0;
        const r = el.getBoundingClientRect();
        const room = r.height - (window.innerHeight - bar);
        done = room > 0 ? (bar - r.top) / room : 1;
      }
      line.current.style.width = `${Math.round(Math.min(1, Math.max(0, done)) * 1000) / 10}%`;
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    document.addEventListener('scroll', soon, true);
    window.addEventListener('resize', soon);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', soon, true);
      window.removeEventListener('resize', soon);
    };
  }, [textId]);
  return (
    <span className="rd-progress" aria-hidden>
      <i ref={line} />
    </span>
  );
}

const SCALE_MIN = 0.8;
const SCALE_MAX = 1.6;

/** A tenth larger or smaller, kept to one decimal so steps land where they started. */
const stepScale = (at: number, by: number) =>
  Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, at + by * 0.1)) * 10) / 10;

/** Aa: the size, the layout, and the marks — everything about the look that is not pinyin or translation. */
function AaMenu({
  pinyin,
  setPinyin,
  translation,
  setTranslation,
  hasTrad,
  hasPictures,
  pictures,
  setPictures,
  paper,
  setPaper,
  glosses,
  setGlosses,
}: {
  pinyin: PinyinMode;
  setPinyin: (m: PinyinMode) => void;
  translation: TranslationMode;
  setTranslation: (m: TranslationMode) => void;
  hasTrad: boolean;
  hasPictures: boolean;
  pictures: PictureMode;
  setPictures: (m: PictureMode) => void;
  paper: PaperMode;
  setPaper: (m: PaperMode) => void;
  glosses: GlossMode;
  setGlosses: (m: GlossMode) => void;
}) {
  const settings = useStore((s) => s.settings);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="rd-aa" ref={root}>
      <button className="rd-aa-btn" aria-expanded={open} aria-haspopup="dialog" title="How the text looks" aria-label="How the text looks" onClick={() => setOpen((o) => !o)}>
        Aa
      </button>
      {open && (
        <div className="rd-aa-panel" role="dialog" aria-label="How the text looks">
          <div className="rd-aa-papers" role="group" aria-label="Page">
            {PAPER_MODES.map((m) => (
              <button key={m} data-paper={m} aria-pressed={paper === m} onClick={() => setPaper(m)}>
                <span className="hanzi">{PAPER_HAN[m]}</span>
                <small>{PAPER_LABEL[m]}</small>
              </button>
            ))}
          </div>
          <div className="rd-aa-row">
            <span>Pinyin</span>
            <span className="spacer" />
            <div className="seg sm" role="group" aria-label="Pinyin">
              {PINYIN_MODES.map((m) => (
                <button key={m} aria-pressed={pinyin === m} onClick={() => setPinyin(m)}>
                  {PINYIN_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="rd-aa-row">
            <span>
              Translation
              <small>When it is off, hold a sentence for its English.</small>
            </span>
            <span className="spacer" />
            <div className="seg sm" role="group" aria-label="Translation">
              {TRANSLATION_MODES.map((m) => (
                <button key={m} aria-pressed={translation === m} onClick={() => setTranslation(m)}>
                  {TRANSLATION_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="rd-aa-row">
            <span>Text size</span>
            <span className="spacer" />
            <div className="seg sm" role="group" aria-label="Text size">
              <button
                onClick={() => setSettings({ readerScale: stepScale(settings.readerScale, -1) })}
                disabled={settings.readerScale <= SCALE_MIN}
                aria-label="Smaller"
              >
                A−
              </button>
              <button
                onClick={() => setSettings({ readerScale: stepScale(settings.readerScale, 1) })}
                disabled={settings.readerScale >= SCALE_MAX}
                aria-label="Larger"
              >
                A+
              </button>
            </div>
          </div>
          <div className="rd-aa-row">
            <span>Layout</span>
            <span className="spacer" />
            <div className="seg sm" role="group" aria-label="Layout">
              <button aria-pressed={settings.readerLayout === 'paragraph'} onClick={() => setSettings({ readerLayout: 'paragraph' })}>
                Paragraphs
              </button>
              <button aria-pressed={settings.readerLayout === 'sentences'} onClick={() => setSettings({ readerLayout: 'sentences' })}>
                Lines
              </button>
            </div>
          </div>
          {hasPictures && (
            <div className="rd-aa-row">
              <span>Pictures</span>
              <span className="spacer" />
              <div className="seg sm" role="group" aria-label="Pictures">
                {PICTURE_MODES.map((m) => (
                  <button key={m} aria-pressed={pictures === m} onClick={() => setPictures(m)}>
                    {PICTURE_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="rd-aa-row">
            <span>
              New words beside the text
              <small>Each with its pinyin and meaning, by its paragraph.</small>
            </span>
            <span className="spacer" />
            <input type="checkbox" checked={glosses === 'on'} onChange={(e) => setGlosses(e.target.checked ? 'on' : 'off')} />
          </label>
          <label className="rd-aa-row">
            <span>
              Underline what is not known yet
              <small>Red: what your answers say you do not know yet.</small>
            </span>
            <span className="spacer" />
            <input type="checkbox" checked={settings.markUnknown} onChange={(e) => setSettings({ markUnknown: e.target.checked })} />
          </label>
          <label className="rd-aa-row">
            <span>
              Mark words above {hskLabel(settings.targetHsk)}
              <small>Your level is set in Settings.</small>
            </span>
            <span className="spacer" />
            <input type="checkbox" checked={settings.markAbove} onChange={(e) => setSettings({ markAbove: e.target.checked })} />
          </label>
          {hasTrad && (
            <label className="rd-aa-row">
              <span>Traditional characters</span>
              <span className="spacer" />
              <input
                type="checkbox"
                checked={settings.readerTraditional}
                onChange={(e) => setSettings({ readerTraditional: e.target.checked })}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ⋯: whether it is read, printing in its three forms, and deleting.
 *
 * The browser's own print is the page as it is on screen with the controls
 * taken off. The PDFs are the designed sheets the worksheets use, with
 * practice squares.
 */
function ReaderMenu({
  set,
  list,
  text,
  mode,
  onMode,
}: {
  set: TextSet | null;
  list: GeneratedText[];
  text: GeneratedText;
  mode: ReadMode;
  onMode: (m: ReadMode) => void;
}) {
  const lib = useLibrary();
  const navigate = useNavigate();
  const pdf = usePdfExport();
  const settings = useStore((s) => s.settings);
  const [look, setLook] = useState(false);
  const sheet = readerSheet(settings);
  const printOptions = { footerNote: settings.footerNote, practice: settings.readerPractice };
  const busy = pdf.busy !== null;
  const then = (close: () => void, fn: () => void) => () => {
    close();
    fn();
  };

  function remove() {
    if (!confirm(`Delete “${text.titleZh || text.title}”?`)) return;
    navigate(set && list.length > 1 ? paths.reading(set.id) : paths.read(), { replace: true, flushSync: true });
    deleteText(text.id);
  }

  return (
    <>
      <Menu label={<Icon name="more" size={22} />} title={busy ? 'Building the PDF…' : 'More'} className={`rd-menu-btn${busy ? ' busy' : ''}`}>
        {(close) => (
          <>
            {list.length > 1 && (
              <button role="menuitem" className="btn ghost sm" onClick={then(close, () => onMode(mode === 'all' ? 'single' : 'all'))}>
                {mode === 'all' ? 'One text at a time' : 'Every text on one page'}
              </button>
            )}
            <button role="menuitem" className="btn ghost sm" onClick={then(close, () => window.print())}>
              Print {mode === 'all' ? 'the whole shelf' : 'this page'}
              <span className="tiny muted">as it looks here</span>
            </button>
            <button
              role="menuitem"
              className="btn ghost sm"
              disabled={busy}
              onClick={then(close, () =>
                void pdf.run('passage', {
                  title: text.title,
                  render: () => renderReading(lib, text, sheet, { ...printOptions, pinyin: true, english: true }),
                }),
              )}
            >
              This text as a PDF
            </button>
            {set && (
              <button
                role="menuitem"
                className="btn ghost sm"
                disabled={busy}
                onClick={then(close, () =>
                  void pdf.run(set.id, { title: set.name, render: () => renderTextSet(lib, set.name, list, sheet, printOptions) }),
                )}
              >
                The shelf as a PDF
              </button>
            )}
            <button role="menuitem" className="btn ghost sm" onClick={then(close, () => setLook(true))}>
              How the PDF looks…
            </button>
            {mode === 'single' && (
              <button role="menuitem" className="btn ghost sm danger" onClick={then(close, remove)}>
                Delete this text
              </button>
            )}
          </>
        )}
      </Menu>
      {look && <PdfLook onClose={() => setLook(false)} teaches={text.teach.length} />}
    </>
  );
}

function PdfLook({ onClose, teaches }: { onClose: () => void; teaches: number }) {
  const settings = useStore((s) => s.settings);
  return (
    <Modal title="How the PDF looks" subtitle="For the designed sheets. Printing the page keeps the page’s own look." onClose={onClose}>
      <PalettePicker value={settings.printPalette} onChange={(p) => p && setSettings({ printPalette: p })} />
      <p className="tiny muted" style={{ margin: '6px 0 0' }}>
        This is the print colour for every sheet: worksheets, tests and texts. A collection can still pick its own.
      </p>
      <label className="toggle" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={settings.readerPractice} onChange={(e) => setSettings({ readerPractice: e.target.checked })} />
        <span>
          Practice pages behind the reading
          <span className="d">
            {teaches
              ? `Drill pages for its new words and ${teaches} new character${teaches === 1 ? '' : 's'}`
              : 'Drill pages for each text’s new words and characters'}
          </span>
        </span>
      </label>
    </Modal>
  );
}
