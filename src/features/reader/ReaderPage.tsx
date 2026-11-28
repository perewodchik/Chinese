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
import { bookOf, bookTitle, chapterHead, chineseNumber, isFrontMatter, kindOf } from '../../domain/bookshelf';
import {
  allPartsRead,
  lineHanziCount,
  partParas,
  partProgressKey,
  sliceChapterPart,
  splitChapter,
} from '../../domain/chapterParts';
import { ChapterFinish, ChapterSheetView, sheetOfHash, type ChapterSheet, type PartFinishInfo } from './ChapterFinish';
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
  const rawPart = Number(params.get('part'));
  const part = Number.isInteger(rawPart) && rawPart >= 1 ? rawPart : null;
  if (set) {
    const list = shelf.bySet.get(set.id) ?? [];
    if (!list.length) return <Missing />;
    const mode: ReadMode = params.get('mode') === 'all' ? 'all' : 'single';
    const v = params.get('v');
    const version: TextVersion | null = v === 'easy' || v === 'book' ? v : null;
    return <Reader set={set} list={list} mode={mode} page={Number(params.get('page')) || 1} part={mode === 'single' ? part : null} version={version} />;
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
    return <Navigate to={paths.reading(home.id, { page: at + 1, part: part ?? undefined, version })} replace />;
  }
  return <Reader set={null} list={[text]} mode="single" page={1} part={part} version={null} />;
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
  part: number | null;
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
function Reader({ set, list, mode, page: asked, part: askedPart, version }: ReaderProps) {
  const entries = useMemo(() => shelfEntries(list), [list]);
  const total = entries.length;
  const page = Math.min(total, Math.max(1, asked));
  const entry = entries[page - 1]!;
  const fullText = versionOf(entry, version);
  const parts = useMemo(() => (isFrontMatter(fullText) ? [] : splitChapter(fullText)), [fullText]);
  const activePart = useMemo(
    () => (mode === 'single' && askedPart && parts.length ? (parts.find((p) => p.index === askedPart) ?? null) : null),
    [mode, askedPart, parts],
  );
  const text = useMemo(() => (activePart ? sliceChapterPart(fullText, activePart) : fullText), [fullText, activePart]);
  const lineOffset = activePart ? activePart.lineFrom : 0;
  const hanziBefore = useMemo(
    () => (activePart ? fullText.lines.slice(0, activePart.lineFrom).reduce((n, l) => n + lineHanziCount(l), 0) : 0),
    [fullText.lines, activePart],
  );
  const progressKey = activePart ? partProgressKey(fullText.id, activePart.index) : fullText.id;
  const viewKey = activePart ? `${fullText.id}#p${activePart.index}` : fullText.id;
  const both = Boolean(entry.easier && entry.original);
  // A story read as a book counts its chapters, the page of who is who before them not one of them.
  const story = Boolean(set) && kindOf(list) === 'story';
  const chapterAt = (at: number) =>
    story && !isFrontMatter(entries[at]!.main) ? entries.slice(0, at + 1).filter((e) => !isFrontMatter(e.main)).length : null;
  const chapters = story ? entries.filter((e) => !isFrontMatter(e.main)).length : 0;
  const chNum = chapterAt(page - 1);
  const partLabel = activePart ? `${chNum ?? page}.${activePart.index}` : null;
  const easier = both && fullText === entry.easier;
  const where =
    mode === 'all'
      ? story
        ? `All ${chapters} chapters`
        : `All ${total} texts`
      : !set
        ? activePart
          ? `Part ${activePart.index} of ${activePart.total}`
          : 'A text on its own'
        : story
          ? chNum === null
            ? 'Before the chapters'
            : activePart
              ? `Chapter ${chNum}.${activePart.index} (${activePart.index} of ${activePart.total})${easier ? ', easier' : ''}`
              : `Chapter ${chNum} of ${chapters}${easier ? ', easier' : ''}`
          : activePart
            ? `Text ${page}.${activePart.index} (${activePart.index} of ${activePart.total})${easier ? ', easier' : ''}`
            : `Text ${page} of ${total}${easier ? ', easier' : ''}`;
  const barName = set ? bookTitle(set.name) : fullText.titleZh || fullText.title;
  useTitle(mode === 'all' && set ? set.name : `${fullText.titleZh || fullText.title}${partLabel ? ` (${partLabel})` : ''}`);

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
  }, [viewKey]);
  const closeContents = useCallback(() => setContents(false), []);
  // Sepia and Night are this page's: on while it is open, the app's own colours back when it closes.
  // Before the first paint, so a sepia page never shows white for a moment.
  useLayoutEffect(() => {
    setPageColour(paper);
  }, [paper]);
  useLayoutEffect(() => () => setPageColour(null), []);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState<number | null>(null);
  // The line the narrator is reading, lit in the text, and kept in sight.
  const [narrLine, setNarrLine] = useState<number | null>(null);
  // The narrator's row shows only while it is wanted: the listen button opens and starts it, ✕ or the button closes it.
  const [listening, setListening] = useState(false);
  const player = useRef<PlayerControl | null>(null);
  useEffect(() => setListening(false), [viewKey]);
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
  useEffect(() => setRevealed(new Set()), [viewKey]);

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
  // Look up narrator recordings against the full main chapter so a split part plays its slice of the same narration.
  const voice = useListenVoice(fullText, reading);
  const [playing, setPlaying] = useState(false);
  useEffect(() => prefetchPassage(spoken, reading.voice), [spoken, reading.voice]);
  // Heard to the end is the Listen part done, once more; read through a ref so a listening ending counts the latest number.
  const listensRef = useRef(fullText.study?.listens ?? (fullText.study?.heard ? 1 : 0));
  listensRef.current = fullText.study?.listens ?? (fullText.study?.heard ? 1 : 0);
  useEffect(
    () =>
      onReadThrough((lines) => {
        if (lines.length === spoken.length && lines.every((l, i) => l === spoken[i])) {
          if (activePart) {
            studyText(fullText.id, { listened: activePart.lineTo + 1 });
          } else {
            studyText(fullText.id, { heard: Date.now(), listened: spoken.length, listens: (listensRef.current ?? 0) + 1 });
          }
        }
      }),
    [spoken, fullText.id, activePart],
  );

  /* -------------------------------------------------------- moving about */
  const activeVersion: TextVersion | undefined = both ? (fullText === entry.easier ? 'easy' : 'book') : undefined;
  const address = useCallback(
    (to: { page?: number; part?: number; mode?: ReadMode; version?: TextVersion }) =>
      set ? paths.reading(set.id, to) : paths.text(fullText.id, to.part),
    [set, fullText.id],
  );
  const stepTarget = (dir: -1 | 1): { page: number; part?: number } | null => {
    if (activePart) {
      if (dir === 1) {
        if (activePart.index < activePart.total) return { page, part: activePart.index + 1 };
        if (page < total) {
          const nextEntry = entries[page]!;
          const nextMain = versionOf(nextEntry, version);
          const nextParts = isFrontMatter(nextMain) ? [] : splitChapter(nextMain);
          return nextParts.length ? { page: page + 1, part: 1 } : { page: page + 1 };
        }
        return null;
      }
      if (activePart.index > 1) return { page, part: activePart.index - 1 };
      if (page > 1) {
        const prevEntry = entries[page - 2]!;
        const prevMain = versionOf(prevEntry, version);
        const prevParts = isFrontMatter(prevMain) ? [] : splitChapter(prevMain);
        return prevParts.length ? { page: page - 1, part: prevParts.length } : { page: page - 1 };
      }
      return null;
    }
    if (dir === 1) return page < total ? { page: page + 1 } : null;
    return page > 1 ? { page: page - 1 } : null;
  };
  const prevTarget = stepTarget(-1);
  const nextTarget = stepTarget(1);
  const goTo = (target: { page: number; part?: number }) => navigate(address({ ...target, version: activeVersion }));

  // Where Read and Today offer to come back to.
  useEffect(() => {
    if (mode !== 'single') return;
    rememberReading({ textId: fullText.id, setId: set?.id ?? null, page, part: activePart?.index ?? null, version: activeVersion ?? null, at: Date.now() });
  }, [fullText.id, set?.id, page, activePart?.index, mode, activeVersion]);

  // A new text or part starts at its top, not wherever the last one was scrolled to.
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [viewKey, mode]);

  // The arrow keys turn pages, as they do in every reader — but not while typing an answer.
  useEffect(() => {
    if (mode !== 'single' || (!prevTarget && !nextTarget)) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      // Something open over the text — copying it out, a drawer, a panel — has the keys to itself.
      if (e.defaultPrevented || document.querySelector('[role="dialog"], .drawer, .rd-aa-panel')) return;
      if (paged && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && turnPage(e.key === 'ArrowRight' ? 1 : -1)) {
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowRight' && nextTarget) goTo(nextTarget);
      if (e.key === 'ArrowLeft' && prevTarget) goTo(prevTarget);
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
  }, [viewKey]);
  const openSheet = (s: ChapterSheet | null) => {
    setSheet(s);
    writeHash(s);
  };

  const shown = mode === 'all' ? entries.map((e) => versionOf(e, null)) : [text];

  // Pages: each column is the text's own width. A swipe moves the page with
  // the finger and lets go onto a whole page: on to the next once it has
  // gone a sixth of the way, else back. Nothing scrolls by itself, so the
  // text never rests between two pages.
  useEffect(() => {
    const el = textBox.current;
    if (!paged || !el) return;
    const size = () => {
      el.style.setProperty('--rd-page', `${el.clientWidth}px`);
      el.scrollLeft = Math.round(el.scrollLeft / el.clientWidth) * el.clientWidth;
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    let start: { x: number; y: number; left: number } | null = null;
    let sideways = false;
    const down = (e: TouchEvent) => {
      const t = e.touches[0]!;
      start = { x: t.clientX, y: t.clientY, left: el.scrollLeft };
      sideways = false;
    };
    const move = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0]!;
      const dx = t.clientX - start.x;
      if (!sideways && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(t.clientY - start.y)) sideways = true;
      if (sideways) el.scrollLeft = start.left - dx;
    };
    const up = (e: TouchEvent) => {
      if (!start) return;
      const w = el.clientWidth;
      const dx = (e.changedTouches[0]?.clientX ?? start.x) - start.x;
      const from = Math.round(start.left / w);
      const of = Math.round(el.scrollWidth / w);
      const to = sideways && Math.abs(dx) > w / 6 ? Math.min(of - 1, Math.max(0, from + (dx < 0 ? 1 : -1))) : from;
      el.scrollTo({ left: to * w, behavior: 'smooth' });
      start = null;
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    el.scrollLeft = 0;
    return () => {
      ro.disconnect();
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
    };
  }, [paged, viewKey]);

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
              aria-pressed={fullText === entry.easier}
              title="The easier retelling"
              aria-label="The easier retelling"
              onClick={() => navigate(address({ page, part: activePart?.index, version: 'easy' }), { replace: true })}
            >
              简
            </button>
            <button
              aria-pressed={fullText === entry.original}
              title="The book’s own text"
              aria-label="The book’s own text"
              onClick={() => navigate(address({ page, part: activePart?.index, version: 'book' }), { replace: true })}
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
            key={`${voice.current ? voice.current.n.key : String(voice.current)}:${activePart?.index ?? 'full'}`}
            text={fullText}
            reading={reading}
            spoken={spoken}
            narrated={voice.current}
            lineRange={activePart ? [activePart.lineFrom, activePart.lineTo] : undefined}
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
        {shown.map((t, i) => {
          const baseHead = chapterHead(t, chapterAt(mode === 'all' ? i : page - 1));
          const head =
            mode === 'single' && activePart
              ? {
                  ...baseHead,
                  kicker: baseHead.kicker
                    ? `${baseHead.kicker} · ${partLabel}`
                    : story && chNum !== null
                      ? `第${chineseNumber(chNum)}章 · ${partLabel}`
                      : `Part ${partLabel}`,
                }
              : baseHead;
          return (
            <Passage
              key={mode === 'single' ? viewKey : t.id}
              text={t}
              view={view}
              reading={t.id === text.id && listening ? (narrLine ?? reading.at) : null}
              flash={t.id === text.id ? flash : null}
              revealed={t.id === text.id ? revealed : new Set()}
              onReveal={reveal}
              onPoint={point}
              retold={Boolean(entry.original) && fullText.id === entry.easier?.id}
              study={study}
              heading={mode === 'all' && !story ? <p className="rd-kicker">Text {i + 1} of {total}</p> : null}
              head={head}
              partNote={
                mode === 'single' && activePart ? (
                  <p className="rd-part-note">
                    <span>
                      Part {activePart.index} of {activePart.total}, {activePart.hanzi.toLocaleString('en')} characters
                    </span>
                    <Link to={address({ page, version: activeVersion })}>Full chapter</Link>
                  </p>
                ) : null
              }
              titleAction={
                mode === 'single' ? (
                  <ListenControl
                    text={fullText}
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
                      if (!fullText.study?.translated) studyText(fullText.id, { translated: Date.now() });
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
          );
        })}
        {/* In pages the end of the chapter is its last page. */}
        {paged && (
          <ChapterFinish
            text={text}
            onOpen={openSheet}
            part={
              activePart
                ? ({
                    index: activePart.index,
                    total: activePart.total,
                    nextLabel: activePart.index < activePart.total ? `${chNum ?? page}.${activePart.index + 1}` : null,
                    nextTo: activePart.index < activePart.total ? address({ page, part: activePart.index + 1, version: activeVersion }) : null,
                    fullTo: address({ page, version: activeVersion }),
                  } satisfies PartFinishInfo)
                : null
            }
          />
        )}
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
          onMark={(m) => studyText(fullText.id, { marks: { [lineOffset + held.i]: m } })}
        />
      )}

      {contents && set && (
        <BookContents
          set={set}
          book={bookOf(set, list)}
          entries={entries}
          page={mode === 'single' ? page : 0}
          part={activePart?.index ?? null}
          onClose={closeContents}
        />
      )}

      {mode === 'single' && (
        <div className="rd-study no-print">
          {!paged && (
            <ChapterFinish
              text={text}
              onOpen={openSheet}
              part={
                activePart
                  ? {
                      index: activePart.index,
                      total: activePart.total,
                      nextLabel: activePart.index < activePart.total ? `${chNum ?? page}.${activePart.index + 1}` : null,
                      nextTo: activePart.index < activePart.total ? address({ page, part: activePart.index + 1, version: activeVersion }) : null,
                      fullTo: address({ page, version: activeVersion }),
                    }
                  : null
              }
            />
          )}
        </div>
      )}

      {mode === 'single' && sheet && (
        <ChapterSheetView which={sheet} chapter={`${fullText.titleZh || fullText.title}${partLabel ? ` (${partLabel})` : ''}`} onClose={() => openSheet(null)}>
          {sheet === 'write' && (
            <>
              <WritePart text={text} copyOffset={hanziBefore} fullCopied={fullText.study?.copied ?? 0} partId="part-write" />
              <MorePart text={text} partId="part-more" />
            </>
          )}
          {isSpeakSectionEnabled && sheet === 'speak' && <SpeakPart text={text} bests={bests} lineOffset={lineOffset} />}
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
            <QuestionsPart key={`q${viewKey}`} text={text} partId="part-questions" showPinyin={pinyin === 'all'} />
          )}
        </ChapterSheetView>
      )}

      {mode === 'single' && (
        <ReaderFoot
          textId={progressKey}
          pages={paged}
          onContents={set && (total > 1 || parts.length > 0) ? () => setContents(true) : null}
          onPrev={prevTarget ? () => goTo(prevTarget) : null}
          onNext={nextTarget ? () => goTo(nextTarget) : null}
          prevLabel={activePart ? 'The part before' : story ? 'The chapter before' : 'The text before'}
          nextLabel={activePart ? 'The next part' : story ? 'The next chapter' : 'The next text'}
          onEnd={() => {
            if (activePart) {
              const doneParas = partParas(activePart);
              studyText(fullText.id, { parasRead: doneParas });
              if (!fullText.read && allPartsRead(fullText, parts, doneParas)) markRead(fullText.id);
            } else {
              // Scrolled to the end is read: counted once a day, as the old tick did.
              if (!fullText.read) markRead(fullText.id);
            }
          }}
        />
      )}
    </div>
  );
}

