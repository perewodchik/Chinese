import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import type { ItemId } from '../../domain/ids';
import { shelfEntries, shelve, type GeneratedText, type ShelfEntry, type TextSet } from '../../domain/text';
import { isSpeakSectionEnabled } from '../../navigation/features';
import { paths, type ReadMode, type TextVersion } from '../../navigation/paths';
import { readHash, writeHash } from '../../navigation/hash';
import { markRead, studyText } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { setPageColour } from '../../ui/colorScheme';
import { bookOf, bookTitle, chapterHead, isFrontMatter, kindOf } from '../../domain/bookshelf';
import { ChapterFinish, ChapterSheetView, sheetOfHash, type ChapterSheet } from './ChapterFinish';
import { ReaderFoot } from './ReaderFoot';
import { BookContents } from './BookContents';
import { ListenControl, useListenVoice } from './ListenBar';
import { SentencePeek, type HeldSentence } from './SentencePeek';
import { pinnedBottom, WordPeek, type Peeked } from './WordPeek';
import { SpeakPart, useLineBests } from './ChapterTabs';
import { useOpenItem } from '../../navigation/itemDrawer';
import { Passage, type ReaderView } from './Passage';
import { onReadThrough, prefetchPassage, useReading } from './readAloud';
import {
  HAN_FONT_STACK,
  LINE_HEIGHT,
  TEXT_MEASURE,
  useHanFont,
  useLineSpacing,
  useTextWidth,
  useTurnMode,
  usePaperMode,
  usePictureMode,
  usePinyinMode,
  useTranslationMode,
} from './readerView';
import { DockPlayer, type PlayerControl } from './DockPlayer';
import { AaMenu } from './AaMenu';
import { ReaderMenu } from './ReaderMenu';
import { rememberReading } from '../shared/lastRead';
import { MorePart } from './MorePart';
import { QuestionsPart } from './QuestionsPart';
import { WordsPart } from './WordsPart';
import { WritePart } from './WritePart';
import './reader.css';

/**
 * /read/text/:id — a shelf of texts read one at a time, or one text on its own.
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
  const [pinyin, setPinyin] = usePinyinMode();
  const [translation, setTranslation] = useTranslationMode();
  const [pictures, setPictures] = usePictureMode();
  const [paper, setPaper] = usePaperMode();
  const [font, setFont] = useHanFont();
  const [spacing, setSpacing] = useLineSpacing();
  const [width, setWidth] = useTextWidth();
  const [turn, setTurn] = useTurnMode();
  // Turned a page at a time: only one text on the page, and never inside a sheet.
  const paged = turn === 'pages' && mode === 'single';
  // Only the text on the screen: a tap on the text where there is no word hides the bar and the foot, another brings them back.
  const [calm, setCalm] = useState(false);
  const textBox = useRef<HTMLDivElement>(null);
  const [contents, setContents] = useState(false);
  // A tapped word's card; the whole drawer is a tap on it away.
  const [peek, setPeek] = useState<(Peeked & { key: string }) | null>(null);
  const closePeek = useCallback(() => setPeek(null), []);
  const openItem = useOpenItem();
  // A held sentence's card: its English and Copy.
  const [held, setHeld] = useState<HeldSentence | null>(null);
  const closeHeld = useCallback(() => setHeld(null), []);
  useEffect(() => {
    setPeek(null);
    setHeld(null);
  }, [text.id]);
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
    const pinned = pinnedBottom(120);
    if (r.top < pinned + 8 || r.bottom > window.innerHeight - 24) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [narrLine, text.id]);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => setRevealed(new Set()), [text.id]);

  const view: ReaderView = {
    // One way of setting the text now: paragraphs, as a book sets them (Lines went with the redesign).
    layout: 'paragraph',
    pinyin,
    translation,
    traditional: false,
    markUnknown: settings.markUnknown,
    markAbove: false,
    target: settings.targetHsk,
    // Dialogue as a comic is no longer offered: a dialogue reads as any text.
    comic: false,
    pictures,
    glosses: false,
  };

  /* -------------------------------------------------------- the voice */
  const spoken = useMemo(() => text.lines.map((l) => l.zh), [text.lines]);
  const reading = useReading(spoken);
  const voice = useListenVoice(text, reading);
  const [playing, setPlaying] = useState(false);
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
      if (paged && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && turnPage(e.key === 'ArrowRight' ? 1 : -1)) {
        e.preventDefault();
        return;
      }
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

  const bests = useLineBests(text.id);
  // A part of the chapter, open in a sheet over the text. Kept in the address
  // (#words), so a reload or the book page's 写 opens on it; copying out and
  // dictation (#copy, #dictation) open in Write, which they belong to.
  const [sheet, setSheet] = useState<ChapterSheet | null>(() => sheetOfHash(readHash()));
  useEffect(() => {
    setSheet((s) => (s === null ? s : sheetOfHash(readHash())));
  }, [text.id]);
  const openSheet = (s: ChapterSheet | null) => {
    setSheet(s);
    writeHash(s);
  };

  const shown = mode === 'all' ? entries.map((e) => versionOf(e, null)) : [text];

  // Pages: each column is the text's own width, and a swipe that stops between two pages settles on the nearer one.
  useEffect(() => {
    const el = textBox.current;
    if (!paged || !el) return;
    const size = () => el.style.setProperty('--rd-page', `${el.clientWidth}px`);
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    let t = 0;
    const settle = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const w = el.clientWidth;
        const want = Math.round(el.scrollLeft / w) * w;
        if (Math.abs(want - el.scrollLeft) > 1) el.scrollTo({ left: want, behavior: 'smooth' });
      }, 140);
    };
    el.addEventListener('scroll', settle, { passive: true });
    el.scrollLeft = 0;
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
      el.removeEventListener('scroll', settle);
    };
  }, [paged, text.id]);

  /** A page on or back, in pages mode; false at either end, so the arrow keys go on to the next chapter there. */
  function turnPage(by: 1 | -1): boolean {
    const el = textBox.current;
    if (!el) return false;
    const w = el.clientWidth;
    const at = Math.round(el.scrollLeft / w);
    const of = Math.round(el.scrollWidth / w);
    if (at + by < 0 || at + by >= of) return false;
    el.scrollTo({ left: (at + by) * w, behavior: 'smooth' });
    return true;
  }

  /**
   * In pages, a tap on a page's edge turns it, before any word there gets it:
   * the outer fifth on each side is for turning, as in a book reader.
   */
  function tapEdge(e: React.MouseEvent<HTMLDivElement>) {
    if (!paged || peek || held) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x >= 0.2 && x <= 0.8) return;
    e.preventDefault();
    e.stopPropagation();
    turnPage(x < 0.2 ? -1 : 1);
  }

  /** A tap on the text that is not a word: the bars go, or come back. */
  function tapText(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('.w, button, a, input, select, textarea, [role="button"], .rd-pic')) return;
    if (peek || held) return;
    setCalm((c) => !c);
  }

  return (
    <div className="rd" ref={top} data-mode={mode} data-turn={paged ? 'pages' : undefined} data-calm={calm || undefined} style={{ '--reader-scale': settings.readerScale, '--rd-han': HAN_FONT_STACK[font], '--rd-lh': LINE_HEIGHT[spacing], '--rd-measure': TEXT_MEASURE[width] } as CSSProperties}>
      {/* The bar, stuck to the top and opaque from the screen's edge down. */}
      <div className="rd-pin no-print">
      <header className="rd-top">
        <Link className="rd-back" to={set ? paths.shelf(set.id) : paths.read()} aria-label={set ? `Back to ${bookTitle(set.name)}` : 'Back to Read'} title={set ? `Back to ${bookTitle(set.name)}` : 'Back to Read'}>
          <Icon name="back" size={24} />
        </Link>
        <div className="rd-where">
          {/* 楷体 for a Chinese name; a shelf named in English keeps the app's own type. */}
          <b className={/\p{Script=Han}/u.test(barName) ? 'hanzi' : undefined}>{barName}</b>
          <span>{where}</span>
        </div>
        <span className="spacer" />
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
          hasPictures={list.some((t) => t.pictures?.some((p) => p.key))}
          pictures={pictures}
          setPictures={setPictures}
          paper={paper}
          setPaper={setPaper}
          font={font}
          setFont={setFont}
          spacing={spacing}
          setSpacing={setSpacing}
          width={width}
          setWidth={setWidth}
          turn={turn}
          setTurn={setTurn}
        />
        {/* A book's own ⋯ is on its page; a text on its own keeps one here. */}
        {!set && (
          <ReaderMenu
            set={set}
            list={list}
            text={text}
            mode={mode}
            onMode={(m) => navigate(address(m === 'all' ? { mode: 'all' } : { page }))}
          />
        )}
      </header>
      {/* The narrator, under the bar and pinned with it: the bottom edge is
          left to the text and to a tapped word's card. */}
      {mode === 'single' && (
        <div className="rd-dock" hidden={!listening}>
          <DockPlayer
            key={voice.current ? voice.current.n.key : String(voice.current)}
            text={text}
            reading={reading}
            spoken={spoken}
            narrated={voice.current}
            onLine={setNarrLine}
            onPlaying={setPlaying}
            control={player}
            onClose={() => {
              player.current?.stop();
              setListening(false);
            }}
          />
        </div>
      )}
      </div>

      <div className="rd-text" data-layout="paragraph" ref={textBox} onClickCapture={tapEdge} onClick={tapText}>
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
                <ListenControl
                  text={text}
                  voice={voice}
                  reading={reading}
                  playing={listening && playing}
                  onPlay={() => {
                    if (!listening) listen();
                    else if (playing) player.current?.stop();
                    else player.current?.start();
                  }}
                />
              ) : null
            }
            onHold={
              t.id === text.id
                ? (line, el) => {
                    setPeek(null);
                    setHeld({ i: line, el });
                    if (!text.study?.translated) studyText(text.id, { translated: Date.now() });
                  }
                : undefined
            }
            held={t.id === text.id ? (held?.i ?? null) : null}
            onWord={(p) => {
              setHeld(null);
              setPeek((was) => (was?.key === p.key && was.el === p.el ? null : p));
            }}
            peekKey={peek?.key ?? null}
          />
        ))}
        {/* In pages the end of the chapter is its last page. */}
        {paged && <ChapterFinish text={text} onOpen={openSheet} />}
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

      {held && text.lines[held.i] && (
        <SentencePeek
          held={held}
          line={text.lines[held.i]!}
          onClose={closeHeld}
          mark={text.study?.marks?.[held.i]}
          onMark={(m) => studyText(text.id, { marks: { [held.i]: m } })}
        />
      )}

      {contents && set && (
        <BookContents set={set} book={bookOf(set, list)} entries={entries} page={mode === 'single' ? page : 0} onClose={closeContents} />
      )}

      {mode === 'single' && (
        <div className="rd-study no-print">
          {!paged && <ChapterFinish text={text} onOpen={openSheet} />}
        </div>
      )}

      {mode === 'single' && sheet && (
        <ChapterSheetView which={sheet} chapter={text.titleZh || text.title} onClose={() => openSheet(null)}>
          {sheet === 'write' && (
            <>
              <WritePart text={text} partId="part-write" />
              <MorePart text={text} partId="part-more" />
            </>
          )}
          {isSpeakSectionEnabled && sheet === 'speak' && <SpeakPart text={text} bests={bests} />}
          {(sheet === 'words' || sheet === 'grammar') && (
            <WordsPart
              text={text}
              setId={set?.id ?? null}
              study={study}
              show={sheet}
              onShowLine={(i) => (openSheet(null), window.setTimeout(() => showLine(i), 60))}
              partId={`part-${sheet}`}
            />
          )}
          {sheet === 'questions' && text.questions.length > 0 && (
            <QuestionsPart key={`q${text.id}`} text={text} partId="part-questions" showPinyin={pinyin === 'all'} />
          )}
        </ChapterSheetView>
      )}

      {mode === 'single' && (
        <ReaderFoot
          textId={text.id}
          pages={paged}
          onContents={set && total > 1 ? () => setContents(true) : null}
          onPrev={page > 1 ? () => go(page - 1) : null}
          onNext={page < total ? () => go(page + 1) : null}
          prevLabel={story ? 'The chapter before' : 'The text before'}
          nextLabel={story ? 'The next chapter' : 'The next text'}
          onEnd={() => {
            // Scrolled to the end is read: counted once a day, as the old tick did.
            if (!text.read) markRead(text.id);
          }}
        />
      )}
    </div>
  );
}

