import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import type { PaletteId, StyleId } from '../../domain/sheet';
import { suggestBand } from '../../domain/teach';
import { HSK_BANDS, hskLabel, shelve, type GeneratedText, type TextSet } from '../../domain/text';
import { paths, type ReadMode } from '../../navigation/paths';
import { renderReading, renderTextSet } from '../../pdf/render';
import { PALETTES, STYLES } from '../../pdf/theme';
import { deleteText, markRead, setSettings, setTextRead } from '../../store/commands';
import { useStore } from '../../store/store';
import { Menu } from '../../ui/Menu';
import { Modal } from '../../ui/Modal';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { usePdfExport } from '../shared/usePdfExport';
import { Passage, type ReaderView } from './Passage';
import { readerSheet } from './readerSheet';

/**
 * /texts/:id — a session of texts, or one text on its own.
 *
 * The address names the session, and the query says how to read it:
 * `?page=2` for the second passage on its own, `?mode=all` for the whole
 * session on one page. An address naming a single passage — every link from
 * before sessions had pages of their own — lands on its page in its session.
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
    const page = Math.min(list.length, Math.max(1, Number(params.get('page')) || 1));
    return <Reader set={set} list={list} mode={mode} page={page} />;
  }

  const text = texts.find((t) => t.id === id);
  if (!text) return <Missing />;
  const home = text.setId ? sets.find((s) => s.id === text.setId) : undefined;
  if (home) {
    const list = shelf.bySet.get(home.id) ?? [text];
    const page = list.findIndex((t) => t.id === text.id) + 1;
    return <Navigate to={paths.reading(home.id, { page })} replace />;
  }
  return <Reader set={null} list={[text]} mode="single" page={1} />;
}

function Missing() {
  useTitle('Text not found');
  return (
    <div className="empty">
      <span className="big">读</span>
      <p>This text is not on the shelf. It may have been deleted — here, or on another device.</p>
      <Link className="btn" to={paths.texts()}>
        Back to the shelf
      </Link>
    </div>
  );
}

interface ReaderProps {
  set: TextSet | null;
  list: GeneratedText[];
  mode: ReadMode;
  page: number;
}

/**
 * The reading page: one column, the passage in the middle of it, and the
 * controls on a bar at its top rather than in a panel beside it.
 *
 * A sidebar is the right shape for a tool and the wrong one for reading — it
 * pulls the eye sideways every line, and on the iPad held upright it is a
 * third of the screen the passage does not get. Everything it held is still
 * here: the ways of reading are on the bar, and what the passage taught is
 * underneath it.
 */
function Reader({ set, list, mode, page }: ReaderProps) {
  const text = list[page - 1];
  useTitle(mode === 'all' && set ? set.name : text.titleZh || text.title);
  const lib = useLibrary();
  const navigate = useNavigate();
  const settings = useStore((s) => s.settings);
  const learned = useStore((s) => s.learned);
  const [pinyin, setPinyin] = useState(true);
  const [english, setEnglish] = useState(true);
  const top = useRef<HTMLDivElement>(null);

  const auto = useMemo(() => suggestBand(lib, learned), [lib, learned]);
  const target = settings.targetHsk || auto;
  const hasTrad = list.some((t) => t.lines.some((l) => l.zht));

  const view: ReaderView = {
    layout: settings.readerLayout,
    pinyin,
    english,
    traditional: settings.readerTraditional,
    markNew: settings.markNew,
    markAbove: settings.markAbove,
    target,
  };

  // A new page starts at its top, not wherever the last one was scrolled to.
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [page, mode]);

  const total = list.length;
  const address = (to: { page?: number; mode?: ReadMode }) =>
    set ? paths.reading(set.id, to) : paths.text(text.id);

  /**
   * Moving on marks the one behind you as read. Nobody clicks "mark read" on
   * the way out of a passage they have just finished; they click "next".
   */
  function go(to: number) {
    if (mode === 'single' && !text.read) setTextRead(text.id, true);
    navigate(address({ page: to }));
  }

  // The arrow keys turn pages, as they do in every reader — but not while
  // typing an answer.
  useEffect(() => {
    if (mode !== 'single' || total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowRight' && page < total) go(page + 1);
      if (e.key === 'ArrowLeft' && page > 1) go(page - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const shown = mode === 'all' ? list : [text];

  return (
    <div className="reader" ref={top}>
      <div className="reader-bar no-print">
        <div className="reader-row">
          <Link className="btn ghost sm" to={paths.texts()} title="Back to the shelf">
            ←
          </Link>
          <div style={{ minWidth: 0 }}>
            <b className="reader-set">{set?.name ?? 'A text on its own'}</b>
            {set && (
              <span className="tiny muted">
                {' '}
                · {total} text{total === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <div className="spacer" />
          {mode === 'single' && <ReadCount text={text} />}
          <PrintMenu set={set} list={list} text={text} mode={mode} pinyin={pinyin} english={english} />
        </div>

        {total > 1 && (
          <Pager
            mode={mode}
            page={page}
            total={total}
            onPage={go}
            onMode={(m) => navigate(address(m === 'all' ? { mode: 'all' } : { page }))}
          />
        )}

        <div className="reader-row reader-view">
          <Seg
            size="sm"
            label="Layout"
            value={settings.readerLayout}
            onChange={(readerLayout) => setSettings({ readerLayout })}
            options={[
              { id: 'paragraph', label: 'Paragraphs', title: 'The Chinese as prose, the translation beneath it' },
              { id: 'sentences', label: 'Sentences', title: 'Each sentence with its own translation' },
            ]}
          />
          <div className="chips">
            <button className="chip" aria-pressed={pinyin} onClick={() => setPinyin(!pinyin)}>
              Pinyin
            </button>
            <button className="chip" aria-pressed={english} onClick={() => setEnglish(!english)}>
              Translation
            </button>
            {hasTrad && (
              <button
                className="chip"
                aria-pressed={settings.readerTraditional}
                onClick={() => setSettings({ readerTraditional: !settings.readerTraditional })}
                title="Show the traditional characters the writer supplied"
              >
                繁體
              </button>
            )}
            <button
              className="chip mark-chip"
              data-mark="new"
              aria-pressed={settings.markNew}
              onClick={() => setSettings({ markNew: !settings.markNew })}
              title="Colour the words built from characters this text taught"
            >
              New words
            </button>
            <span className="chip-group">
              <button
                className="chip mark-chip"
                data-mark="above"
                aria-pressed={settings.markAbove}
                onClick={() => setSettings({ markAbove: !settings.markAbove })}
                title="Underline words from a band above the one you are reading at"
              >
                Above
              </button>
              <select
                className="band-select"
                aria-label="Your target band"
                value={settings.targetHsk}
                onChange={(e) => setSettings({ targetHsk: Number(e.target.value) })}
              >
                <option value={0}>{hskLabel(auto)} (yours)</option>
                {HSK_BANDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </span>
          </div>
        </div>
      </div>

      <div className="reader-doc">
        {shown.map((t, i) => (
          <Passage
            key={t.id}
            text={t}
            view={view}
            heading={
              mode === 'all' || total > 1 ? (
                <p className="tiny muted passage-kicker">
                  {set?.name} · text {mode === 'all' ? i + 1 : page} of {total}
                </p>
              ) : null
            }
          />
        ))}

        {mode === 'single' && total > 1 && (
          <div className="read-on no-print">
            {page < total ? (
              <>
                <span className="tiny muted">Next in {set?.name ?? 'this session'}</span>
                <button className="btn primary" onClick={() => go(page + 1)}>
                  <span className="hanzi">{list[page].titleZh || list[page].title}</span> →
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

      {total > 1 && mode === 'single' && (
        <div className="no-print" style={{ marginTop: 18 }}>
          <Pager mode={mode} page={page} total={total} onPage={go} onMode={() => navigate(address({ mode: 'all' }))} />
        </div>
      )}
      {settings.footerNote && <p className="print-only print-foot tiny">{settings.footerNote}</p>}
    </div>
  );
}

/** `[ ‹ ] Text 2 of 4 [ › ]`, and the switch to the whole session on one page. */
function Pager({
  mode,
  page,
  total,
  onPage,
  onMode,
}: {
  mode: ReadMode;
  page: number;
  total: number;
  onPage: (n: number) => void;
  onMode: (m: ReadMode) => void;
}) {
  return (
    <nav className="pager" aria-label="Texts in this session">
      {mode === 'single' ? (
        <>
          <button className="btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous text">
            ‹
          </button>
          <span className="pager-where">
            Text <b>{page}</b> of {total}
          </span>
          <button className="btn sm" disabled={page >= total} onClick={() => onPage(page + 1)} aria-label="Next text">
            ›
          </button>
          <div className="pager-dots" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <button key={i} tabIndex={-1} data-here={i + 1 === page || undefined} onClick={() => onPage(i + 1)} />
            ))}
          </div>
          <div className="spacer" />
          <button className="btn ghost sm" onClick={() => onMode('all')}>
            Show all {total} texts
          </button>
        </>
      ) : (
        <>
          <span className="pager-where">All {total} texts in this session</span>
          <div className="spacer" />
          <button className="btn ghost sm" onClick={() => onMode('single')}>
            One at a time
          </button>
        </>
      )}
    </nav>
  );
}

/**
 * Printing, in its three forms.
 *
 * The browser's own print is the page as it is on screen — the layout,
 * the marks and the toggles you chose — with the controls taken off. The
 * PDFs are the designed sheets the worksheets use, with practice squares.
 */
function PrintMenu({
  set,
  list,
  text,
  mode,
  pinyin,
  english,
}: {
  set: TextSet | null;
  list: GeneratedText[];
  text: GeneratedText;
  mode: ReadMode;
  pinyin: boolean;
  english: boolean;
}) {
  const lib = useLibrary();
  const navigate = useNavigate();
  const pdf = usePdfExport();
  const settings = useStore((s) => s.settings);
  const [look, setLook] = useState(false);

  const sheet = readerSheet(settings);
  const printOptions = { footerNote: settings.footerNote, practice: settings.readerPractice, perPage: settings.practicePerPage };

  function remove() {
    if (!confirm(`Delete “${text.title}”?`)) return;
    navigate(set && list.length > 1 ? paths.reading(set.id) : paths.texts(), { replace: true, flushSync: true });
    deleteText(text.id);
  }

  const busy = pdf.busy !== null;
  const then = (close: () => void, fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <>
      <Menu label={busy ? 'Building…' : 'Print ▾'}>
        {(close) => (
          <>
            <button role="menuitem" className="btn ghost sm" onClick={then(close, () => window.print())}>
              Print {mode === 'all' ? 'the whole session' : 'this page'}
              <span className="tiny muted">as it looks here</span>
            </button>
            <button
              role="menuitem"
              className="btn ghost sm"
              disabled={busy}
              onClick={then(close, () =>
                void pdf.run('passage', {
                  title: text.title,
                  render: () => renderReading(lib, text, sheet, { ...printOptions, pinyin, english }),
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
                The session as a PDF
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
      <div className="chips" style={{ marginTop: 10 }}>
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
      <label className="toggle" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          checked={settings.readerPractice}
          onChange={(e) => setSettings({ readerPractice: e.target.checked })}
        />
        <span>
          Practice sheets behind the reading
          <span className="d">
            {teaches ? `The same block a worksheet uses, for the ${teaches} new characters` : 'For each text’s new characters'}
          </span>
        </span>
      </label>
    </Modal>
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
