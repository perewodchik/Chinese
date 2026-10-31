import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import type { ItemId } from '../../domain/ids';
import { hskLabel, shelfEntries, shelve, type GeneratedText, type ShelfEntry, type TextSet } from '../../domain/text';
import { paths, type ReadMode, type TextVersion } from '../../navigation/paths';
import { renderReading, renderTextSet } from '../../pdf/render';
import { dayKey } from '../../domain/activity';
import { deleteText, markRead, setSettings, setTextRead, studyText } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { Modal } from '../../ui/Modal';
import { PalettePicker } from '../../ui/PalettePicker';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { usePdfExport } from '../shared/usePdfExport';
import { Passage, useStanding, type ReaderView } from './Passage';
import { onReadThrough, prefetchPassage, useReading } from './readAloud';
import {
  PICTURE_LABEL,
  PICTURE_MODES,
  PINYIN_LABEL,
  PINYIN_MODES,
  TRANSLATION_LABEL,
  TRANSLATION_MODES,
  usePictureMode,
  usePinyinMode,
  useTranslationMode,
  type PictureMode,
  type PinyinMode,
  type TranslationMode,
} from './readerView';
import { DockPlayer } from './DockPlayer';
import { readerSheet } from './readerSheet';
import { rememberReading } from './lastRead';
import {
  ListenPart,
  MORE,
  MorePart,
  partFill,
  partsOf,
  QuestionsPart,
  WordsPart,
  WritePart,
  type TabId,
} from './TextParts';
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
  useTitle(mode === 'all' && set ? set.name : text.titleZh || text.title);

  const navigate = useNavigate();
  const settings = useStore((s) => s.settings);
  const study = useMemo(() => new Set<ItemId>(set?.study ?? []), [set?.study]);
  const standing = useStanding(study);
  const [pinyin, setPinyin] = usePinyinMode();
  const [translation, setTranslation] = useTranslationMode();
  const [pictures, setPictures] = usePictureMode();
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState<number | null>(null);
  // The line the bottom bar's narrator is reading, lit in the text, and kept in sight.
  const [narrLine, setNarrLine] = useState<number | null>(null);
  useEffect(() => {
    if (narrLine === null) return;
    const el = document.getElementById(`line-${text.id}-${narrLine}`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Above the bar at the top or under the dock at the bottom: brought back, gently.
    if (r.top < 120 || r.bottom > window.innerHeight - 110) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
    document.querySelector('.rd-study')?.scrollTo({ top: 0 });
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

  const parts = partsOf(text);
  const fill = partFill(text, standing);
  const tabs = [...parts, MORE];
  const [current, holdPart] = useCurrentPart(text.id, tabs.map((p) => p.id));
  const partId = (p: TabId) => `part-${p}`;
  function goPart(p: TabId) {
    holdPart(p);
    if (p === 'read') {
      top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelector('.rd-study')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.getElementById(partId(p))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const shown = mode === 'all' ? entries.map((e) => versionOf(e, null)) : [text];
  const next = page < total ? versionOf(entries[page]!, null) : null;

  return (
    <div className="rd" ref={top} data-mode={mode} style={{ '--reader-scale': settings.readerScale } as CSSProperties}>
      {/* The bar and the parts are stuck to the top as one block: two sticky
          pieces, each with its own offset, left a sliver between them on an
          iPhone where the text showed through. */}
      <div className="rd-pin no-print">
      <header className="rd-top">
        <Link className="rd-back" to={set ? paths.shelf(set.id) : paths.read()} aria-label="Back to the shelf">
          <Icon name="back" size={24} />
        </Link>
        <div className="rd-where">
          <b>{set?.name ?? 'A text on its own'}</b>
          <span>
            {mode === 'all'
              ? `All ${total} texts`
              : both && text === entry.easier
                ? `Text ${page} of ${total}, easier`
                : `Text ${page} of ${total}`}
          </span>
        </div>
        {mode === 'single' && both && (
          <div className="rd-versions" role="group" aria-label="Version">
            <button
              aria-pressed={text === entry.easier}
              title="The easier retelling"
              onClick={() => navigate(address({ page, version: 'easy' }), { replace: true })}
            >
              简
            </button>
            <button
              aria-pressed={text === entry.original}
              title="The book’s own text"
              onClick={() => navigate(address({ page, version: 'book' }), { replace: true })}
            >
              原
            </button>
          </div>
        )}
        <ReaderMenu
          set={set}
          list={list}
          text={text}
          mode={mode}
          onMode={(m) => navigate(address(m === 'all' ? { mode: 'all' } : { page }))}
        />
      </header>

      {mode === 'single' && (
        <nav className="rd-parts" aria-label="Parts of this text">
          {tabs.map((p) => (
            <button
              key={p.id}
              className="rd-part-tab"
              aria-current={current === p.id ? 'true' : undefined}
              data-more={p.id === 'more' || undefined}
              style={p.id === 'more' ? undefined : ({ '--fill': `${Math.round(fill[p.id] * 100)}%` } as CSSProperties)}
              onClick={() => goPart(p.id)}
              title={p.id === 'more' ? 'Translate and dictation: practice that is not counted' : `${p.label}: ${fill[p.id] >= 1 ? 'done' : fill[p.id] > 0 ? 'started' : 'not yet'}`}
            >
              <span className="hanzi">{p.han}</span>
              <small>{p.label}</small>
            </button>
          ))}
        </nav>
      )}
      </div>

      <div className="rd-text">
        {shown.map((t, i) => (
          <Passage
            key={t.id}
            text={t}
            view={view}
            reading={t.id === text.id ? (narrLine ?? reading.at) : null}
            flash={t.id === text.id ? flash : null}
            revealed={t.id === text.id ? revealed : new Set()}
            onReveal={reveal}
            onPoint={point}
            retold={Boolean(entry.original) && t.id === entry.easier?.id}
            study={study}
            heading={mode === 'all' ? <p className="rd-kicker">Text {i + 1} of {total}</p> : null}
          />
        ))}
        {mode === 'single' && (
          <div className="rd-done no-print">
            <button
              className={`btn rd-done-btn ${text.read ? 'tonal' : ''}`}
              aria-pressed={text.read}
              onClick={() =>
                text.read
                  ? setTextRead(text.id, false)
                  : // Ticked again the same day is a slip taken back, not a second reading.
                    text.lastReadAt && dayKey(text.lastReadAt) === dayKey(Date.now())
                    ? setTextRead(text.id, true)
                    : markRead(text.id)
              }
            >
              {text.read ? (
                <>
                  <Icon name="check" /> Read
                </>
              ) : (
                'Mark as read'
              )}
            </button>
            {text.reads && text.reads > 1 ? <span className="small muted">Read {text.reads} times</span> : null}
          </div>
        )}

        {/* The text's own controls, stuck to the bottom of the screen while the
            text is on it, and gone with the text when the parts below come up. */}
        <div className="rd-dock no-print">
          {mode === 'single' ? <DockPlayer text={text} reading={reading} spoken={spoken} onLine={setNarrLine} /> : <span className="spacer" />}
          <AaMenu
            pinyin={pinyin}
            setPinyin={setPinyin}
            translation={translation}
            setTranslation={setTranslation}
            hasTrad={list.some((t) => t.lines.some((l) => l.zht))}
            hasPictures={list.some((t) => t.pictures?.some((p) => p.key))}
            pictures={pictures}
            setPictures={setPictures}
          />
        </div>
      </div>

      {mode === 'single' && (
        <div className="rd-study no-print">
          <WritePart text={text} partId={partId('write')} />
          <WordsPart
            text={text}
            setId={set?.id ?? null}
            study={study}
            standing={standing}
            onShowLine={showLine}
            partId={partId('words')}
          />
          {text.questions.length > 0 && (
            <QuestionsPart key={`q${text.id}`} text={text} partId={partId('questions')} showPinyin={pinyin === 'all'} />
          )}
          <ListenPart text={text} reading={reading} spoken={spoken} partId={partId('listen')} />
          <MorePart text={text} partId={partId('more')} />
          <div className="rd-next">
            {next ? (
              <button className="rd-next-btn" onClick={() => go(page + 1)}>
                <span className="small muted">Next on {set?.name ?? 'this shelf'}</span>
                <span className="hanzi">{next.titleZh || next.title}</span>
                <Icon name="chevron" />
              </button>
            ) : (
              <p className="small muted">
                {total > 1 ? `That is the last of ${total} texts on this shelf.` : 'This shelf has one text so far.'}{' '}
                <Link to={set ? paths.shelf(set.id) : paths.read()}>Back to the shelf</Link>
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * Which part is in view: the last one whose top has passed the bar at the top
 * of the page. On a wide screen the parts scroll in their own column, so both
 * scrollers are listened to.
 */
/**
 * The part being looked at, for the parts bar: the last one whose top has
 * come up to the line under the bars — in two columns, to the top of the
 * study column, with the text itself current while that column is at its
 * top. Scrolled to the very end, the last part is current even when it is
 * too short to reach the line.
 *
 * A part tapped in the bar is current at once and stays so while the page
 * glides to it; the next thing the learner does with a finger, a wheel or a
 * key hands it back to the scrolling.
 */
function useCurrentPart(textId: string, ids: TabId[]): [TabId, (p: TabId) => void] {
  const [current, setCurrent] = useState<TabId>('read');
  const held = useRef<TabId | null>(null);
  const key = ids.join(',');
  useEffect(() => {
    held.current = null;
    const look = () => {
      if (held.current) return;
      const list = key.split(',') as TabId[];
      const study = document.querySelector<HTMLElement>('.rd-study');
      const wide = Boolean(study && getComputedStyle(study).overflowY === 'auto');
      const scroller = wide ? study : document.querySelector<HTMLElement>('.main');
      const line = wide
        ? study!.getBoundingClientRect().top + 24
        : (document.querySelector('.rd-parts')?.getBoundingClientRect().bottom ?? 120) + 48;
      let at: TabId = 'read';
      if (!wide || study!.scrollTop > 0) {
        for (const id of list) {
          if (id === 'read') continue;
          const el = document.getElementById(`part-${id}`);
          if (el && el.getBoundingClientRect().top <= line) at = id;
        }
        if (scroller && scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) {
          at = list[list.length - 1]!;
        }
      }
      setCurrent(at);
    };
    const release = () => {
      if (!held.current) return;
      held.current = null;
      look();
    };
    look();
    document.addEventListener('scroll', look, true);
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchstart', release, { passive: true });
    window.addEventListener('keydown', release);
    return () => {
      document.removeEventListener('scroll', look, true);
      window.removeEventListener('wheel', release);
      window.removeEventListener('touchstart', release);
      window.removeEventListener('keydown', release);
    };
  }, [key, textId]);
  const hold = useCallback((p: TabId) => {
    held.current = p;
    setCurrent(p);
  }, []);
  return [current, hold];
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
}: {
  pinyin: PinyinMode;
  setPinyin: (m: PinyinMode) => void;
  translation: TranslationMode;
  setTranslation: (m: TranslationMode) => void;
  hasTrad: boolean;
  hasPictures: boolean;
  pictures: PictureMode;
  setPictures: (m: PictureMode) => void;
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
      <button className="rd-dock-btn rd-aa-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
        Aa
      </button>
      {open && (
        <div className="rd-aa-panel" role="dialog" aria-label="How the text looks">
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
            <span>Translation</span>
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
              Underline words to learn
              <small>Red: new to you. Blue: words you are learning.</small>
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
