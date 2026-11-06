import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { DEFAULT_SCOPE, type Collection } from '../../domain/collection';
import { charId, isCharId, isWordId, idValue, type ItemId } from '../../domain/ids';
import { firstSense } from '../../domain/library';
import { defaultSheet } from '../../domain/sheet';
import { fromBook, hanziIn, isHanzi, shelfEntries, shelve, taughtTexts, type GeneratedText, type TextSet } from '../../domain/text';
import { paths, type ShelfTab } from '../../navigation/paths';
import { useIsAdmin } from '../../api/admin';
import { oneOf, useQuery } from '../../navigation/query';
import { renderCollection, renderTextSet } from '../../pdf/render';
import { downloadText, safeFileName } from '../../platform/files';
import { addTexts, deleteSet, discardPlan, renameSet } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { usePdfExport } from '../shared/usePdfExport';
import { lastReading } from './lastRead';
import { useWordDone, useWordLevel } from './Passage';
import { readerSheet } from './readerSheet';
import { partFill, partsOf } from './TextParts';
import { useStartSession } from './startSession';
import { bookcase, bookOf, chapterHead, chineseNumber, isFrontMatter, type Book } from '../../domain/bookshelf';
import { BookChars, BookWords, type BookWord, type Chapter } from './BookStudy';
import { shelveBook } from '../../store/commands';
import { BookCover } from './BookCover';
import './shelves.css';

const hasHan = (s: string) => [...s].some(isHanzi);

/** Where to go to carry on: the text last open here, if it is still on the shelf; else the next unread one. */
function useContinue(): { text: GeneratedText; set: TextSet | null; to: string } | null {
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  return useMemo(() => {
    const last = lastReading();
    const text = last ? texts.find((t) => t.id === last.textId) : undefined;
    if (text && last) {
      const set = sets.find((s) => s.id === text.setId) ?? null;
      return { text, set, to: set ? paths.reading(set.id, { page: last.page, version: last.version ?? undefined }) : paths.text(text.id) };
    }
    const shelf = shelve(texts, sets);
    for (const set of sets) {
      const entries = shelfEntries(shelf.bySet.get(set.id) ?? []);
      const at = entries.findIndex((e) => !e.main.read && !(e.easier?.read ?? false));
      if (at >= 0) return { text: entries[at]!.main, set, to: paths.reading(set.id, { page: at + 1 }) };
    }
    return null;
  }, [texts, sets]);
}

export { useContinue };

/**
 * Read: where you stopped, and every shelf.
 *
 * A shelf is a book being worked through, or a batch of texts Claude wrote
 * for you — each with its own words and characters, so nothing has to be
 * gathered into a collection to be learned. Texts come first in this app,
 * and this is the tab that finds them.
 */
/** Pinyin as typed on a phone: no tone marks, no ü's dots, no spaces. */
const bare = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s'’]/g, '')
    .toLowerCase();

export function ReadPage() {
  const admin = useIsAdmin();
  useTitle('Read');
  const navigate = useNavigate();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const plan = useStore((s) => s.plan);
  const startSession = useStartSession();
  const shelf = useMemo(() => shelve(texts, sets), [texts, sets]);
  const go = useContinue();
  // Kept in the address (?q=) as it is typed, so a reload finds the same search.
  const [query, setQuery] = useQuery();
  const [q, setQ] = useState(() => query.get('q') ?? '');

  const found = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    // Pinyin matches with or without its tone marks and spaces: "lan" finds lán, which is hard to type on a phone.
    const sound = bare(needle);
    const sounds = (py: string) => Boolean(sound) && bare(py).includes(sound);
    const seen = new Set<string>();
    return [...texts]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter(
        (t) =>
          t.titleZh.includes(needle) ||
          t.title.toLowerCase().includes(needle) ||
          t.lines.some((l) => l.zh.includes(needle) || l.en.toLowerCase().includes(needle) || sounds(l.py)) ||
          t.vocab.some((w) => w.w.includes(needle) || w.d.toLowerCase().includes(needle) || sounds(w.py)),
      )
      // A text with an easier version is one result, as it is one text on its shelf.
      .filter((t) => {
        const key = `${t.setId ?? ''}|${t.titleZh}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 30);
  }, [q, texts]);

  function newBook() {
    const name = prompt('What is the new book called? A real book’s title, or a subject for texts.');
    if (!name?.trim()) return;
    const { set } = addTexts([], { setId: null, name: name.trim() });
    navigate(paths.shelf(set.id));
  }

  // Each shelf with its books, and what each book shows on its cover.
  const shelves = useMemo(() => bookcase(sets, shelf.bySet), [sets, shelf]);

  return (
    <div className="read-page">
      <header className="page-head">
        <h1>Read</h1>
        <span className="spacer" />
        <Menu label={<Icon name="plus" size={22} />} title="Add" className="icon-btn accent">
          {(close) => (
            <>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), startSession(null))}>
                Write texts with Claude
                <span className="tiny muted">out of the characters you know</span>
              </button>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), newBook())}>
                New book
                <span className="tiny muted">for a real book’s pages, or texts on a subject</span>
              </button>
            </>
          )}
        </Menu>
      </header>

      <label className="search">
        <Icon name="search" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setQuery('q', e.target.value);
          }}
          placeholder="Search texts and words"
          aria-label="Search texts and words"
        />
      </label>

      {found ? (
        <section className="block">
          <h2 className="block-title">
            {found.length ? `${found.length} text${found.length === 1 ? '' : 's'}` : 'Nothing found'}
          </h2>
          <div className="list">
            {found.map((t) => (
              <TextRow key={t.id} text={t} to={paths.text(t.id)} sub={sets.find((s) => s.id === t.setId)?.name} />
            ))}
          </div>
        </section>
      ) : (
        <>
          {plan && (
            <div className="resume-row">
              <span className="hanzi" aria-hidden>
                写
              </span>
              <div className="grow">
                <b>{plan.name}</b>
                <span className="small muted">
                  {plan.specs.length} texts being written,{' '}
                  {plan.step === 'plan' ? 'still being planned' : plan.step === 'prompt' ? 'the prompt is ready' : 'waiting for Claude’s answer'}
                </span>
              </div>
              <button className="btn quiet sm" onClick={() => confirm('Throw this session away?') && discardPlan()}>
                Discard
              </button>
              <Link className="btn tonal sm" to={paths.session(plan.step)}>
                Continue
              </Link>
            </div>
          )}

          {go && <ContinueBook go={go} />}

          {sets.length ? (
            <div className="bookcase">
              {shelves.map((sh) => (
                <section key={sh.name} className="bookshelf" data-small={sh.books.length <= 2 || undefined}>
                  <div className="bookshelf-head">
                    <h2>{sh.name}</h2>
                    <span className="small muted">
                      {sh.books.length} book{sh.books.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="bookshelf-row">
                    {sh.books.map((b) => (
                      <BookOnShelf key={b.set.id} book={b} texts={shelf.bySet.get(b.set.id) ?? []} reading={go?.set?.id === b.set.id} />
                    ))}
                  </div>
                  <span className="bookshelf-ledge" aria-hidden />
                </section>
              ))}
            </div>
          ) : (
            <div className="empty compact">
              <span className="big">读</span>
              <p>
                Nothing to read yet. Claude can write a few texts out of the characters you know
                {admin ? ', or add pages from a book with /add-text' : ''}.
              </p>
              <button className="btn primary" onClick={() => startSession(null)}>
                Write the first texts
              </button>
            </div>
          )}

          {shelf.loose.length > 0 && (
            <section className="block">
              <h2 className="block-title">Not on a shelf</h2>
              <div className="list">
                {shelf.loose.map((t) => (
                  <TextRow key={t.id} text={t} to={paths.text(t.id)} />
                ))}
              </div>
            </section>
          )}

        </>
      )}
    </div>
  );
}

/** How far through a book is: its chapters (a text and its easier version one chapter), read and opened. */
function progressOf(texts: GeneratedText[]) {
  const entries = shelfEntries(texts);
  const read = entries.filter((e) => e.main.read || e.easier?.read).length;
  const opened = (t: GeneratedText | null) => Boolean(t && (t.read || t.lastReadAt));
  const unopened = entries.filter((e) => !opened(e.main) && !opened(e.easier)).length;
  return { total: entries.length, read, unopened };
}

/** A book standing on its shelf: its cover, how far through it you are, and a tap opens it. */
function BookOnShelf({ book, texts, reading }: { book: Book; texts: GeneratedText[]; reading: boolean }) {
  const width = useBookWidth();
  const p = progressOf(texts);
  const meta = !p.total ? 'Empty' : p.read === 0 && p.unopened === p.total ? `New · ${p.total} ${p.total === 1 ? 'text' : book.kind === 'story' ? 'chapters' : 'texts'}` : `${p.read} of ${p.total} read`;
  return (
    <Link className="book" to={paths.shelf(book.set.id)} aria-label={`${book.title}${book.easier ? ', easier edition' : ''}: ${meta}`} style={{ width }}>
      <BookCover book={book} width={width} bookmark={reading} fresh={p.unopened > 0 && p.unopened < p.total} done={p.total > 0 && p.read === p.total} />
      <span className="book-meta">
        <i>
          <i style={{ width: `${p.total ? Math.round((p.read / p.total) * 100) : 0}%` }} />
        </i>
        {meta}
      </span>
    </Link>
  );
}

/** Covers on a shelf: a little wider on an iPad, where there is room; followed as the iPad turns. */
function useBookWidth(): number {
  const query = '(min-width: 900px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide ? 120 : 104;
}

/** Where you stopped: the book's cover, the chapter, and the way back to it. */
function ContinueBook({ go }: { go: NonNullable<ReturnType<typeof useContinue>> }) {
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  // In the book's own reading order, as its page lists them.
  const inBook = go.set ? (shelve(texts, sets).bySet.get(go.set.id) ?? []) : [];
  const book = go.set ? bookOf(go.set, inBook) : null;
  const entries = shelfEntries(inBook);
  const at = entries.findIndex((e) => e.main.id === go.text.id || (e.easier !== null && e.easier.id === go.text.id));
  // Counted as the book counts them: the page before the chapters is not one.
  const chapters = entries.filter((e) => !isFrontMatter(e.main));
  const chapterAt = at >= 0 && !isFrontMatter(entries[at]!.main) ? chapters.indexOf(entries[at]!) : -1;
  return (
    <Link className="continue-book" to={go.to}>
      {book && <BookCover book={book} width={66} bookmark />}
      <span className="grow" style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span className="small muted">Go on reading{book ? ` · ${book.title}` : ''}</span>
        <span className="hanzi continue-title">{go.text.titleZh || go.text.title}</span>
        {chapterAt >= 0 && chapters.length > 1 && (
          <span className="small muted">
            {book?.kind === 'story' ? 'Chapter' : 'Text'} {chapterAt + 1} of {chapters.length}
          </span>
        )}
      </span>
      <span className="btn primary">Read</span>
    </Link>
  );
}

function TextRow({ text, to, sub }: { text: GeneratedText; to: string; sub?: string }) {
  return (
    <Link className="text-row" to={to}>
      <span className="grow">
        <span className="hanzi text-row-zh">{text.titleZh || text.title}</span>
        <span className="small muted">{sub ?? text.title}</span>
      </span>
      <Icon name="chevron" className="muted" />
    </Link>
  );
}

const TABS: ShelfTab[] = ['texts', 'words', 'characters'];

/**
 * One shelf, at /read/:setId — its texts, the words it is teaching, and its
 * characters, each a tab.
 */
export function ShelfPage() {
  const admin = useIsAdmin();
  const { setId = '' } = useParams();
  const [query, setQuery] = useQuery();
  const tab = oneOf(query.get('tab'), TABS, 'texts');
  const navigate = useNavigate();
  const lib = useLibrary();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const settings = useStore((s) => s.settings);
  const set = sets.find((s) => s.id === setId) ?? null;
  const list = useMemo(() => (set ? shelve(texts, sets).bySet.get(set.id) ?? [] : []), [texts, sets, set]);
  const entries = useMemo(() => shelfEntries(list), [list]);
  const study = useMemo(() => new Set<ItemId>(set?.study ?? []), [set?.study]);
  const wordDone = useWordDone(study);
  // As the passage marks them: a character's level, or that of the one-character word it is when that was asked about.
  const levelOfWord = useWordLevel();
  // A text's characters not known yet, by your own answers, in the order they come.
  const unknownIn = (t: GeneratedText) => {
    const out: string[] = [];
    for (const l of t.lines) for (const c of l.zh) if (isHanzi(c) && !out.includes(c) && levelOfWord(c) === 0) out.push(c);
    return out;
  };
  const startSession = useStartSession();
  const pdf = usePdfExport();
  useTitle(set?.name ?? 'Shelf');

  // What the shelf teaches: a retelling stands for the book's passage it retells.
  const taught = useMemo(() => taughtTexts(list), [list]);
  const words = useMemo(() => shelfWords(taught, set?.study ?? [], lib), [taught, set?.study, lib]);
  // Each character once, with the chapter it first comes in: a character only
  // added by hand goes with the first text that has it, or with none.
  const chars = useMemo(() => {
    const out: Array<{ c: string; at: number }> = [];
    const seen = new Set<string>();
    const add = (c: string, at: number) => {
      if (!isHanzi(c) || seen.has(c)) return;
      seen.add(c);
      out.push({ c, at });
    };
    taught.forEach((t, i) => t.teach.forEach((c) => add(c, i)));
    for (const id of set?.study ?? []) for (const c of hanziIn(idValue(id))) add(c, taught.findIndex((t) => t.lines.some((l) => l.zh.includes(c))));
    return out;
  }, [taught, set?.study]);

  if (!set) return <Navigate to={paths.read()} replace />;

  const book = list.some(fromBook);
  const asBook = bookOf(set, list);
  const story = asBook.kind === 'story';
  const progress = progressOf(list);
  // The chapter being read: the one last open here, else the first not read.
  const lastId = lastReading()?.textId ?? null;
  // Not `e.easier?.id === lastId`: with no easier version and nothing read, undefined would equal undefined.
  const lastAt = lastId ? entries.findIndex((e) => e.main.id === lastId || (e.easier !== null && e.easier.id === lastId)) : -1;
  const reading = lastAt >= 0;
  const nowAt = Math.max(0, reading ? lastAt : entries.findIndex((e) => !e.main.read && !e.easier?.read));
  const frontMatter = isFrontMatter;
  // Chapters numbered as a Chinese book numbers them, the page before them not counted.
  const numbers = entries.map((_e, i) => entries.slice(0, i + 1).filter((x) => !frontMatter(x.main)).length);
  const opened = (t: GeneratedText | null) => Boolean(t && (t.read || t.lastReadAt));
  const stateAt = (i: number): Chapter['state'] => {
    const e = entries[i]!;
    return e.main.read || e.easier?.read ? 'done' : reading && i === nowAt ? 'now' : !opened(e.main) && !opened(e.easier) ? 'new' : 'open';
  };
  // The chapters as the Words and Characters tabs group by them, and one for what was added by hand.
  const chapters: Chapter[] = [
    ...entries.map((e, i): Chapter => ({
      at: i,
      badge: frontMatter(e.main) ? <Icon name="book" size={16} /> : story ? chineseNumber(numbers[i]!) : numbers[i],
      title: frontMatter(e.main) ? 'Before the chapters' : chapterHead(e.main, null).zh,
      state: stateAt(i),
    })),
    { at: -1, badge: <Icon name="plus" size={16} />, title: 'Added by you', state: 'open' },
  ];

  function moveShelf() {
    const names = bookcase(sets, shelve(texts, sets).bySet).map((s) => s.name);
    const name = prompt(`Which shelf should it stand on? Yours: ${names.join(', ')}. A new name makes a new shelf; empty puts it back where it was.`, asBook.shelf);
    if (name === null) return;
    shelveBook(set!.id, name.trim() || null);
  }

  function rename() {
    const name = prompt('Rename this book', set!.name);
    if (name?.trim()) renameSet(set!.id, name.trim());
  }

  function remove() {
    if (!confirm(`Delete the book “${set!.name}” and its ${list.length} text${list.length === 1 ? '' : 's'}?`)) return;
    navigate(paths.read(), { replace: true, flushSync: true });
    deleteSet(set!.id);
  }

  function exportJson() {
    const out = list.map((t) => ({
      title: t.title,
      titleZh: t.titleZh,
      lines: t.lines,
      vocab: t.vocab.map((w) => ({ w: w.w, py: w.py, d: w.d, new: w.isNew ?? false })),
      questions: t.questions,
      grammar: t.grammar,
      note: t.note,
      teach: t.teach.map((c) => ({ c, ...(t.glosses[c] ?? {}) })),
    }));
    downloadText(safeFileName(set!.name, 'json'), JSON.stringify({ name: set!.name, texts: out }, null, 2), 'application/json');
  }

  function printChars() {
    const items = chars.map((x) => charId(x.c)).filter((id) => lib.byChar.has(idValue(id)));
    const sheet: Collection = {
      id: set!.id,
      name: set!.name,
      items,
      sheet: defaultSheet(),
      scope: { ...DEFAULT_SCOPE },
      createdAt: set!.createdAt,
      updatedAt: Date.now(),
    };
    void pdf.run(`chars-${set!.id}`, {
      title: `${set!.name}, characters`,
      render: () => renderCollection(lib, sheet, items, { footerNote: settings.footerNote, palette: settings.printPalette }),
    });
  }

  return (
    <div className="shelf-page">
      <header className="page-head">
        <Link className="back-link" to={paths.read()}>
          <Icon name="back" size={22} />
          Read
        </Link>
        <span className="spacer" />
        <Menu label={<Icon name="more" size={22} />} title="More" className="icon-btn">
          {(close) => (
            <>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), startSession(set.id, set.name))}>
                Write more texts for this book
              </button>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), rename())}>
                Rename
              </button>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), moveShelf())}>
                Move to another shelf
                <span className="tiny muted">now on {asBook.shelf}</span>
              </button>
              {list.length > 0 && (
                <button
                  role="menuitem"
                  className="btn ghost sm"
                  disabled={pdf.busy !== null}
                  onClick={() => {
                    close();
                    void pdf.run(set.id, {
                      title: set.name,
                      render: () =>
                        renderTextSet(lib, set.name, list, readerSheet(settings), {
                          footerNote: settings.footerNote,
                          practice: settings.readerPractice,
                        }),
                    });
                  }}
                >
                  Print the texts as a PDF
                </button>
              )}
              {list.length > 0 && (
                <button role="menuitem" className="btn ghost sm" onClick={() => (close(), exportJson())}>
                  Save the texts as a file
                  <span className="tiny muted">to paste back into a writing session</span>
                </button>
              )}
              <button role="menuitem" className="btn ghost sm danger" onClick={() => (close(), remove())}>
                Delete this book
              </button>
            </>
          )}
        </Menu>
      </header>

      <div className="book-head">
        <BookCover book={asBook} width={112} bookmark={reading && progress.read < progress.total} done={progress.total > 0 && progress.read === progress.total} />
        <div className="book-head-text">
          <h1 className={hasHan(asBook.title) ? 'hanzi sh-title zh' : 'sh-title'}>{asBook.title}</h1>
          {asBook.easier && (
            <span className="small book-head-easier">
              <span className="hanzi">简</span> Easier edition
            </span>
          )}
          <span className="small muted">
            {story ? `A story in ${numbers[numbers.length - 1] ?? 0} chapter${numbers[numbers.length - 1] === 1 ? '' : 's'}` : `${entries.length} text${entries.length === 1 ? '' : 's'}`}
            {book ? ', from a book' : ''}
          </span>
          {progress.total > 0 && (
            <span className="book-meta book-head-progress">
              <i>
                <i style={{ width: `${Math.round((progress.read / progress.total) * 100)}%` }} />
              </i>
              {progress.read} of {progress.total} read
            </span>
          )}
        </div>
      </div>

      <div className="seg sh-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setQuery('tab', t, 'texts')}>
            {t === 'texts' ? (story ? 'Chapters' : 'Texts') : t === 'words' ? 'Words' : 'Characters'}
            <span className="count">{t === 'texts' ? entries.length : t === 'words' ? words.length : chars.length}</span>
          </button>
        ))}
      </div>

      {tab === 'texts' && (
        <>
          {entries.length ? (
            <ol className="list shelf-texts">
              {entries.map((e, i) => {
                const fill = partFill(e.main, wordDone);
                const unknown = unknownIn(e.main);
                const front = frontMatter(e.main);
                const state = stateAt(i);
                return (
                  <li key={e.main.id}>
                    <Link className="shelf-text" data-state={state} to={paths.reading(set.id, { page: i + 1 })}>
                      {/* Read is a tick; not opened yet, the red pen's dot on the corner. */}
                      <span className="chapter-badge" data-state={state} aria-hidden>
                        {state === 'done' ? <Icon name="check" size={18} /> : front ? <Icon name="book" size={18} /> : story ? chineseNumber(numbers[i]!) : numbers[i]}
                      </span>
                      <span className="grow">
                        {state === 'now' && <span className="shelf-text-now">Reading now</span>}
                        <span className="hanzi shelf-text-zh">
                          {e.main.titleZh || e.main.title}
                          {state === 'new' && <span className="sr-only">, not opened yet</span>}
                        </span>
                        <span className="small muted">{e.main.title.replace(/\s*\(easier\)\s*$/, '')}</span>
                        <span className="shelf-text-meta">
                          <span className="part-ticks" aria-label="Parts done">
                            {partsOf(e.main).map((p) => (
                              <i key={p.id} title={p.label} style={{ '--fill': `${Math.round(fill[p.id] * 100)}%` } as CSSProperties} />
                            ))}
                          </span>
                          {e.easier && e.original && <span className="versions-tag hanzi">简 原</span>}
                          <span className="shelf-text-new" title={unknown.length ? `Not known yet: ${unknown.join(' ')}` : 'You know every character in it'}>
                            {unknown.length ? (
                              <>
                                <span className="hanzi">{unknown.slice(0, 6).join('')}</span>
                                {unknown.length > 6 && <b> +{unknown.length - 6}</b>}
                                <span className="muted"> new to you</span>
                              </>
                            ) : (
                              <span className="muted">every character known</span>
                            )}
                          </span>
                        </span>
                      </span>
                      <Icon name="chevron" size={18} className="shelf-text-go" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="empty compact">
              <span className="big">空</span>
              <p>No texts on this shelf yet.</p>
            </div>
          )}
          <div className="page-foot">
            {entries.length > 0 && (
              <Link className="btn primary lg" to={paths.reading(set.id, { page: nowAt + 1 })}>
                {progress.read === progress.total ? 'Read it again from the start' : story && frontMatter(entries[nowAt]!.main) ? 'Start reading' : `Read ${story ? (frontMatter(entries[nowAt]!.main) ? '' : `chapter ${numbers[nowAt]}`) : `text ${nowAt + 1}`}`}
              </Link>
            )}
            <button className={`btn lg ${entries.length ? 'quiet' : 'primary'}`} onClick={() => startSession(set.id, set.name)}>
              Write more texts with Claude
            </button>
            {/* Claude Code's add-text is the site owner's tool, not a learner's. */}
            {admin && <p className="tiny muted">From a book: send the page to Claude with /add-text and name this shelf.</p>}
          </div>
        </>
      )}

      {tab === 'words' && <BookWords setId={set.id} words={words} chapters={chapters} study={study} />}

      {tab === 'characters' && (
        <>
          <BookChars chars={chars} chapters={chapters} />
          {chars.length > 0 && (
            <div className="page-foot">
              <button className="btn lg" disabled={pdf.busy !== null} onClick={printChars}>
                <Icon name="print" />
                Print a practice sheet
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Every word a shelf's texts list, and every word chosen to learn on it, once each. */
function shelfWords(list: GeneratedText[], study: ItemId[], lib: ReturnType<typeof useLibrary>): BookWord[] {
  const out = new Map<string, BookWord>();
  list.forEach((t, at) => {
    for (const v of t.vocab) if (!out.has(v.w)) out.set(v.w, { w: v.w, py: v.py, d: v.d, at });
  });
  for (const id of study) {
    const w = idValue(id);
    if (out.has(w)) continue;
    if (isWordId(id)) {
      const e = lib.byWord.get(w);
      out.set(w, { w, py: e?.py ?? '', d: e?.d ?? '', at: list.findIndex((t) => t.lines.some((l) => l.zh.includes(w))) });
    } else if (isCharId(id)) {
      const e = lib.byChar.get(w);
      out.set(w, { w, py: e?.py[0] ?? '', d: e ? firstSense(e.def) : '', at: list.findIndex((t) => t.lines.some((l) => l.zh.includes(w))) });
    }
  }
  return [...out.values()];
}

