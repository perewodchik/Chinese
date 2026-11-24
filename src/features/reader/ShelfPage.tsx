import { ask, askText } from '../../ui/dialogs';
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { DEFAULT_SCOPE, type Collection } from '../../domain/collection';
import { charId, isCharId, isWordId, idValue, type ItemId } from '../../domain/ids';
import { firstSense } from '../../domain/library';
import { defaultSheet } from '../../domain/sheet';
import { fromBook, hanziIn, isHanzi, shelfEntries, shelve, taughtTexts, type GeneratedText, type ShelfEntry, liveMarks } from '../../domain/text';
import { paths, type ShelfTab } from '../../navigation/paths';
import { useIsAdmin } from '../auth/session';
import { oneOf, useQuery } from '../../navigation/query';
// R5: the PDF code (pdf-lib and the fonts) comes only when something is printed.
const pdfRender = () => import('../../pdf/render');
import { downloadText, safeFileName } from '../../platform/files';
import { deleteSet, renameSet } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { usePdfExport } from '../shared/usePdfExport';
import { lastReading } from '../shared/lastRead';
import { readerSheet } from './readerSheet';
import { minutesToRead, shareOf } from './readerProgress';
import { useStartSession } from './startSession';
import { bookcase, bookOf, bookTitle, chapterHead, chineseNumber, isFrontMatter } from '../../domain/bookshelf';
import { canRelive, castOf, readInBook } from '../../domain/companion';
import { BookWords, type BookWord, type Chapter } from './BookStudy';
import { shelveBook } from '../../store/commands';
import { BookCover } from './BookCover';
import { BookNarrate } from './BookNarrate';
import './shelves.css';
import { PublishSheet } from './PublishSheet';
import { hasHan, progressOf } from './ReadPage';

const TABS: ShelfTab[] = ['texts', 'words', 'grammar', 'notes'];

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
  const startSession = useStartSession();
  const pdf = usePdfExport();
  const [publishing, setPublishing] = useState(false);
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
  const grammarCount = entries.reduce((n, e) => n + e.main.grammar.length, 0);
  const notesCount = list.reduce((n, t) => n + liveMarks(t.study).length, 0);

  const book = list.some(fromBook);
  const asBook = bookOf(set, list);
  const story = asBook.kind === 'story';
  // A book with a companion (domain/companion): its guide, and each chapter read in either book of the pair to live again.
  const companion = story && castOf(bookTitle(set.name)) !== null;
  // Not a hook: it comes after the early return above, and it is a pass over the texts once a render.
  const readInPair = companion ? readInBook(texts, sets, bookTitle(set.name)) : new Set<string>();
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

  async function moveShelf() {
    const names = bookcase(sets, shelve(texts, sets).bySet).map((s) => s.name);
    const name = await askText({
      title: 'Move to another shelf',
      message: 'Tap one of your shelves, or write a new name for a new shelf. Empty puts it back where it was.',
      label: 'Shelf',
      value: asBook.shelf,
      choices: names,
      yes: 'Move it',
      allowEmpty: true,
    });
    if (name === null) return;
    shelveBook(set!.id, name.trim() || null);
  }

  async function rename() {
    const name = await askText({ title: 'Rename this book', label: 'Its name', value: set!.name, yes: 'Rename' });
    if (name?.trim()) renameSet(set!.id, name.trim());
  }

  async function remove() {
    if (!(await ask({ title: `Delete the book “${set!.name}”?`, message: list.length === 1 ? 'Its text goes with it.' : `Its ${list.length} texts go with it.`, yes: 'Delete it', danger: true }))) return;
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
      render: async () => (await pdfRender()).renderCollection(lib, sheet, items, { footerNote: settings.footerNote, palette: settings.printPalette }),
    });
  }

  return (
    <div className="shelf-page">
      {publishing && <PublishSheet set={set} texts={list} kind={story ? 'story' : 'texts'} onClose={() => setPublishing(false)} />}
      <header className="page-head">
        <Link className="back-link" to={paths.read()}>
          <Icon name="back" size={22} />
          Read
        </Link>
        <span className="spacer" />
        <Menu label={<Icon name="more" size={22} />} title="More" className="icon-btn">
          {(close) => (
            <>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), navigate(paths.addText(set.id)))}>
                Paste a text into this book
              </button>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), startSession(set.id, set.name))}>
                Write more texts for this book
              </button>
              {list.length > 1 && (
                <button role="menuitem" className="btn ghost sm" onClick={() => (close(), navigate(paths.reading(set.id, { mode: 'all' })))}>
                  {story ? 'Every chapter on one page' : 'Every text on one page'}
                  <span className="tiny muted">to read straight through, or print</span>
                </button>
              )}
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
                      render: async () =>
                        (await pdfRender()).renderTextSet(lib, set.name, list, readerSheet(settings), {
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
              {admin && list.length > 0 && (
                <button role="menuitem" className="btn ghost sm" onClick={() => (close(), setPublishing(true))}>
                  {set.catalog ? 'Publish a new version…' : 'Publish to the library…'}
                  <span className="tiny muted">{set.catalog ? `in the library as version ${set.catalog.version}` : 'for every learner to add to their shelves'}</span>
                </button>
              )}
              {chars.length > 0 && (
                <button role="menuitem" className="btn ghost sm" disabled={pdf.busy !== null} onClick={() => (close(), printChars())}>
                  Print a practice sheet of its characters
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
          {asBook.original && (
            <span className="small book-head-easier">
              <span className="hanzi">原</span> Original edition
            </span>
          )}
          <span className="small muted book-head-meta">
            {story ? `${numbers[numbers.length - 1] ?? 0} chapter${numbers[numbers.length - 1] === 1 ? '' : 's'}` : `${entries.length} text${entries.length === 1 ? '' : 's'}`}
            {progress.total > 0 ? ` · ${progress.read} read` : ''}
            {book ? ' · from a book' : ''}
          </span>
        </div>
      </div>

      {entries.length > 0 && (
        <Link className="btn primary lg book-go" to={paths.reading(set.id, { page: nowAt + 1 })}>
          {progress.total > 0 && progress.read === progress.total
            ? 'Read it again from the start'
            : story && frontMatter(entries[nowAt]!.main)
              ? 'Start reading'
              : reading
                ? `Continue ${story ? `chapter ${numbers[nowAt]}` : `text ${nowAt + 1}`}`
                : `Read ${story ? `chapter ${numbers[nowAt]}` : `text ${nowAt + 1}`}`}
        </Link>
      )}

      {entries.length > 0 && <BookNarrate texts={list} story={story} />}

      {companion && entries.some((e) => !isFrontMatter(e.main) && canRelive(e, readInPair)) && (
        <Link className="shelf-guide" to={paths.guide(set.id)}>
          <Icon name="book" size={20} />
          <span className="grow">
            <b>Guide</b>
            <span className="small muted">Who, where and what, from the chapters you have read</span>
          </span>
          <Icon name="chevron" size={18} />
        </Link>
      )}

      <div className="book-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setQuery('tab', t, 'texts')}>
            {t === 'texts' ? (story ? 'Chapters' : 'Texts') : t === 'words' ? 'Words' : t === 'grammar' ? 'Grammar' : 'Notes'}
            <span className="count">{t === 'texts' ? entries.length : t === 'words' ? words.length : t === 'grammar' ? grammarCount : notesCount}</span>
          </button>
        ))}
      </div>

      {tab === 'texts' && (
        <>
          {entries.length ? (
            <ol className="book-rows">
              {entries.map((e, i) => {
                const front = frontMatter(e.main);
                const state = stateAt(i);
                const pct = shareOf(e.easier?.id ?? e.main.id) ?? shareOf(e.main.id);
                return (
                  <li key={e.main.id} className="book-row" data-state={state}>
                    <Link className="book-row-main" to={paths.reading(set.id, { page: i + 1 })}>
                      <span className="book-row-n hanzi" aria-hidden>
                        {front ? '序' : story ? chineseNumber(numbers[i]!) : numbers[i]}
                      </span>
                      <span className="book-row-title">
                        <b className="hanzi">{front ? e.main.titleZh || e.main.title : chapterHead(e.main, null).zh}</b>
                        <small>{e.main.title.replace(/\s*\(easier\)\s*$/, '').replace(/^Chapter \d+:\s*/, '')}</small>
                      </span>
                      <span className="book-row-state">
                        {state === 'done' ? (
                          <Icon name="check" size={18} />
                        ) : state === 'now' && pct !== null ? (
                          <span className="now">{pct}%</span>
                        ) : (
                          `${minutesToRead(e.main)} min`
                        )}
                        {state === 'new' && <span className="sr-only">, not opened yet</span>}
                      </span>
                    </Link>
                    {!front ? (
                      <Link className="book-row-write hanzi" to={`${paths.reading(set.id, { page: i + 1 })}#write`} aria-label={`Write out ${e.main.titleZh || e.main.title}`} title="Write it out">
                        写
                      </Link>
                    ) : (
                      <span />
                    )}
                    {companion && !front && canRelive(e, readInPair) && (
                      <Link className="btn quiet sm shelf-relive" to={paths.relive(set.id, i + 1)} aria-label={`Relive ${e.main.titleZh}`}>
                        Relive
                      </Link>
                    )}
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
            <button className={`btn lg ${entries.length ? 'quiet' : 'primary'}`} onClick={() => startSession(set.id, set.name)}>
              Write more texts with Claude
            </button>
            {/* Claude Code's add-text is the site owner's tool, not a learner's. */}
            {admin && <p className="tiny muted">From a book: send the page to Claude with /add-text and name this shelf.</p>}
          </div>
        </>
      )}

      {tab === 'words' && <BookWords setId={set.id} words={words} chapters={chapters} study={study} />}

      {tab === 'notes' && <BookNotes setId={set.id} entries={entries} numbers={numbers} story={story} />}
      {tab === 'grammar' && <BookGrammar setId={set.id} entries={entries} numbers={numbers} story={story} />}
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


/**
 * Every grammar pattern the book's chapters bring in, by chapter. A tap opens
 * the chapter on its Grammar sheet, where each has its examples.
 */
function BookGrammar({ setId, entries, numbers, story }: { setId: string; entries: ShelfEntry[]; numbers: number[]; story: boolean }) {
  const withGrammar = entries.map((e, i) => ({ e, i })).filter(({ e }) => e.main.grammar.length > 0);
  if (!withGrammar.length)
    return (
      <div className="empty compact">
        <span className="big">法</span>
        <p>These texts came without grammar notes.</p>
      </div>
    );
  return (
    <div className="book-grammar">
      {withGrammar.map(({ e, i }) => (
        <section key={e.main.id}>
          <h3>{story ? `Chapter ${numbers[i]}` : `Text ${i + 1}`}</h3>
          <ul className="book-rows">
            {e.main.grammar.map((g, k) => (
              <li key={k} className="book-row">
                <Link className="book-row-main" to={`${paths.reading(setId, { page: i + 1 })}#grammar`}>
                  <span className="book-row-title">
                    <b>{g.point}</b>
                    {g.zh && <small className="hanzi">{g.zh}</small>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * The sentences highlighted in the book's chapters, with the notes on them,
 * chapter by chapter, in the order they come. A tap opens the chapter.
 */
function BookNotes({ setId, entries, numbers, story }: { setId: string; entries: ShelfEntry[]; numbers: number[]; story: boolean }) {
  const chapters = entries
    .map((e, i) => ({ i, items: [e.easier, e.original ?? e.main].filter((t, k, all): t is GeneratedText => Boolean(t) && all.findIndex((x) => x?.id === t!.id) === k).flatMap((t) => liveMarks(t.study).map((m) => ({ t, m }))) }))
    .filter((c) => c.items.length > 0);
  if (!chapters.length)
    return (
      <div className="empty compact">
        <span className="big">记</span>
        <p>Your highlights and notes from every chapter land here. In a chapter, hold a sentence, then Highlight or Note.</p>
      </div>
    );
  return (
    <div className="book-grammar book-notes">
      {chapters.map(({ i, items }) => (
        <section key={i}>
          <h3>{story ? `Chapter ${numbers[i]}` : `Text ${i + 1}`}</h3>
          <ul className="book-rows">
            {items.map(({ t, m }) => (
              <li key={`${t.id}:${m.line}`} className="book-row">
                <Link className="book-row-main" to={paths.reading(setId, { page: i + 1 })}>
                  <span className="book-row-title">
                    <small className="hanzi book-note-zh">{t.lines[m.line]?.zh ?? ''}</small>
                    {m.note && <b className="book-note">{m.note}</b>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
