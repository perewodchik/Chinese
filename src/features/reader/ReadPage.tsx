import { ask, askText } from '../../ui/dialogs';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { bookFromFile } from '../../domain/bookFile';
import { useToast } from '../../ui/toast';
import { firstUnread, isHanzi, shelfEntries, shelve, type GeneratedText, type TextSet } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { useIsAdmin } from '../auth/session';
import { WelcomeBack } from '../shared/WelcomeBack';
import { Announcement } from '../shared/Announcement';
import { addTexts, deleteSet, markRead, renameSet, shelveBook } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { useTitle } from '../../ui/useTitle';
import { lastReading } from '../shared/lastRead';
import { minutesToRead, shareOf } from './readerProgress';
import { useStartSession } from './startSession';
import { bookcase, bookOf, chapterHead, isFrontMatter, SHELF_ASIDE, SHELF_FINISHED, SHELF_READING, type Book } from '../../domain/bookshelf';
import { BookCover } from './BookCover';
import './shelves.css';
import { FromLibrary } from './FromLibrary';

export const hasHan = (s: string) => [...s].some(isHanzi);

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
    const next = firstUnread(texts, sets);
    return next ? { text: next.text, set: next.set, to: paths.reading(next.set.id, { page: next.page }) } : null;
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

export function ReadPage() {
  const admin = useIsAdmin();
  useTitle('Read');
  const navigate = useNavigate();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const startSession = useStartSession();
  const shelf = useMemo(() => shelve(texts, sets), [texts, sets]);
  const go = useContinue();
  // Put aside and Finished are folded away: there to come back to, not to choose from.
  const [unfolded, setUnfolded] = useState<Set<string>>(new Set());
  const folds = (name: string) => name === SHELF_FINISHED || name === SHELF_ASIDE;

  // A book file read back in (T9): the JSON "Save the texts as a file" writes, or Claude's answer as a file.
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const learned = useStore((s) => s.learned);
  async function openBookFile(file: File) {
    const known = [...learned].filter((id) => id.startsWith('c')).map((id) => id.slice(1));
    const book = bookFromFile(await file.text(), known, file.name.replace(/\.[a-z]+$/i, ''));
    if ('error' in book) {
      toast(book.error);
      return;
    }
    // The same check the shared catalogue makes (T6), loaded only when a file is opened.
    const { newTextSchema } = await import('../../../shared/text');
    const fit = book.texts.filter((t) => newTextSchema.safeParse(t).success);
    if (!fit.length) {
      toast('Its texts are not in a shape the app can read, or too long.');
      return;
    }
    const { set } = addTexts(fit, { setId: null, name: book.name });
    const left = book.texts.length - fit.length;
    toast(`${fit.length} text${fit.length === 1 ? '' : 's'} added as “${set.name}”${left ? `; ${left} left out, too long or malformed` : ''}`);
    navigate(paths.shelf(set.id));
  }

  async function newBook() {
    const name = await askText({ title: 'A new book', message: 'A real book’s title, or a subject for texts.', label: 'What it is called', yes: 'Make it' });
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
        <Menu label={<Icon name="plus" size={24} />} title="Add a text or a book" className="icon-btn read-add">
          {(close) => (
            <>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), navigate(paths.addText()))}>
                Paste a text
                <span className="tiny muted">Chinese from anywhere, or scanned off a page</span>
              </button>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), startSession(null))}>
                Write texts with Claude
                <span className="tiny muted">out of the characters you know</span>
              </button>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), newBook())}>
                New book
                <span className="tiny muted">for a real book’s pages, or texts on a subject</span>
              </button>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), fileInput.current?.click())}>
                Open a book file
                <span className="tiny muted">a book saved as a file, from here or from Claude</span>
              </button>
            </>
          )}
        </Menu>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json,text/plain"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void openBookFile(file);
          }}
        />
      </header>

      {(
        <>
          <Announcement />

          <WelcomeBack />

          {go && <ContinueBook go={go} />}

          {sets.length ? (
            <div className="bookcase">
              {shelves.map((sh) => (
                <section key={sh.name} className="bookshelf" data-small={sh.books.length <= 2 || undefined}>
                  <div className="bookshelf-head">
                    <h2>{sh.name}</h2>
                    <span className="small muted">{sh.books.length}</span>
                    {folds(sh.name) && (
                      <button
                        className="btn quiet sm bookshelf-fold"
                        aria-expanded={unfolded.has(sh.name)}
                        onClick={() =>
                          setUnfolded((was) => {
                            const next = new Set(was);
                            if (next.has(sh.name)) next.delete(sh.name);
                            else next.add(sh.name);
                            return next;
                          })
                        }
                      >
                        {unfolded.has(sh.name) ? 'Hide' : 'Show'}
                      </button>
                    )}
                  </div>
                  {(!folds(sh.name) || unfolded.has(sh.name)) && (
                    <div className="bookshelf-row">
                      {sh.books.map((b) => (
                        <BookOnShelf key={b.set.id} book={b} texts={shelf.bySet.get(b.set.id) ?? []} reading={go?.set?.id === b.set.id} />
                      ))}
                    </div>
                  )}
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

          <FromLibrary sets={sets} />

          {shelf.loose.length > 0 && (
            <section className="block">
              <h2 className="block-title">Single texts</h2>
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
export function progressOf(texts: GeneratedText[]) {
  // The page before a story's chapters is not one of them.
  const entries = shelfEntries(texts).filter((e) => !isFrontMatter(e.main));
  const read = entries.filter((e) => e.main.read || e.easier?.read).length;
  const opened = (t: GeneratedText | null) => Boolean(t && (t.read || t.lastReadAt));
  const unopened = entries.filter((e) => !opened(e.main) && !opened(e.easier)).length;
  return { total: entries.length, read, unopened };
}

/**
 * A book standing on its shelf: its cover and name (a tap opens it), and under
 * them how far through it you are and ⋯ with what can be done with it — put
 * it aside (or back on Reading now), move it, mark it finished, rename it,
 * delete it.
 */
function BookOnShelf({ book, texts, reading }: { book: Book; texts: GeneratedText[]; reading: boolean }) {
  const width = useBookWidth();
  const p = progressOf(texts);
  const sets = useStore((s) => s.sets);
  const allTexts = useStore((s) => s.texts);
  const toast = useToast();
  const unit = book.kind === 'story' ? 'chapters' : 'texts';
  const meta = !p.total ? 'Empty' : p.read === p.total ? 'Read' : p.read === 0 && p.unopened === p.total ? `${p.total} ${p.total === 1 ? 'text' : unit}` : `${p.read} of ${p.total}`;
  const aside = book.shelf === SHELF_ASIDE;
  const id = book.set.id;

  async function move() {
    const names = bookcase(sets, shelve(allTexts, sets).bySet).map((s) => s.name);
    const name = await askText({
      title: 'Move to another shelf',
      message: 'Tap one of your shelves, or write a new name for a new shelf. Empty puts it back where it was.',
      label: 'Shelf',
      value: book.shelf,
      choices: names,
      yes: 'Move it',
      allowEmpty: true,
    });
    if (name !== null) shelveBook(id, name.trim() || null);
  }
  async function rename() {
    const name = await askText({ title: 'Rename this book', label: 'Its name', value: book.set.name, yes: 'Rename' });
    if (name?.trim()) renameSet(id, name.trim());
  }
  async function remove() {
    if (!(await ask({ title: `Delete the book “${book.set.name}”?`, message: texts.length === 1 ? 'Its text goes with it.' : `Its ${texts.length} texts go with it.`, yes: 'Delete it', danger: true }))) return;
    deleteSet(id);
  }
  function finish() {
    for (const t of texts) if (!t.read) markRead(t.id);
    // A shelf chosen by hand would keep it where it is: finished, it goes where finished books go.
    if (book.set.shelf) shelveBook(id, null);
    toast(`${book.title} is on Finished`);
  }

  return (
    <div className="book" style={{ width }}>
      <Link to={paths.shelf(id)} aria-label={`${book.title}${book.easier ? ', easier edition' : book.original ? ', original edition' : ''}: ${meta}`}>
        <BookCover book={book} width={width} bookmark={reading} done={p.total > 0 && p.read === p.total} />
      </Link>
      <span className="book-meta">
        <span className="book-meta-state" data-now={reading || undefined}>
          {meta}
        </span>
        <Menu label={<Icon name="more" size={20} />} title={`What to do with ${book.title}`} className="book-more" floating>
          {(close) => (
            <>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), shelveBook(id, aside ? SHELF_READING : SHELF_ASIDE))}>
                {aside ? 'Back to Reading now' : 'Put aside'}
              </button>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), void move())}>
                Move to another shelf…
                <span className="tiny muted">now on {book.shelf}</span>
              </button>
              {p.total > 0 && p.read < p.total && (
                <button role="menuitem" className="btn ghost sm" onClick={() => (close(), finish())}>
                  Mark it finished
                </button>
              )}
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), void rename())}>
                Rename…
              </button>
              <button role="menuitem" className="btn ghost sm danger" onClick={() => (close(), void remove())}>
                Delete the book
              </button>
            </>
          )}
        </Menu>
      </span>
    </div>
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

/**
 * Where you stopped, in one row: the book's small cover, the book and which
 * chapter of it, the chapter's name, how far down it and how long is left;
 * Continue under the row on a phone, at its end on a wider screen. The page
 * before the chapters is gone past to the first chapter: it is on the book's page.
 */
function ContinueBook({ go }: { go: NonNullable<ReturnType<typeof useContinue>> }) {
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  // In the book's own reading order, as its page lists them.
  const inBook = go.set ? (shelve(texts, sets).bySet.get(go.set.id) ?? []) : [];
  const book = go.set ? bookOf(go.set, inBook) : null;
  const entries = shelfEntries(inBook);
  let at = entries.findIndex((e) => e.main.id === go.text.id || (e.easier !== null && e.easier.id === go.text.id));
  let to = go.to;
  if (at >= 0 && isFrontMatter(entries[at]!.main) && at + 1 < entries.length && go.set) {
    at += 1;
    to = paths.reading(go.set.id, { page: at + 1 });
  }
  const text = at >= 0 ? (entries[at]!.easier && !entries[at]!.easier!.read ? entries[at]!.easier! : entries[at]!.main) : go.text;
  // Counted as the book counts them: the page before the chapters is not one.
  const chapters = entries.filter((e) => !isFrontMatter(e.main));
  const front = at >= 0 && isFrontMatter(entries[at]!.main);
  const chapterAt = at >= 0 && !front ? chapters.indexOf(entries[at]!) : -1;
  const pct = shareOf(text.id) ?? 0;
  const left = Math.max(1, Math.round(minutesToRead(text) * (1 - pct / 100)));
  const head = chapterHead(text, null);
  return (
    <section className="continue-book" aria-label="Go on reading">
      {book && <BookCover book={book} width={64} />}
      <span className="continue-text">
        <span className="small muted continue-where">
          {book ? book.title : 'A text'}
          {chapterAt >= 0 && chapters.length > 1 ? ` · ${book?.kind === 'story' ? 'Chapter' : 'Text'} ${chapterAt + 1} of ${chapters.length}` : front ? ' · Before you read' : ''}
        </span>
        <span className="hanzi continue-title">{front ? text.titleZh || text.title : head.zh}</span>
        <span className="continue-bar" style={{ '--f': `${pct}%` } as CSSProperties}>
          <i />
          {pct}% · {left} min left
        </span>
      </span>
      <Link className="btn primary continue-go" to={to}>
        {text.read || text.lastReadAt || pct ? 'Continue' : 'Start reading'}
      </Link>
    </section>
  );
}

function TextRow({ text, to, sub, hit }: { text: GeneratedText; to: string; sub?: string; hit?: { zh: string; en: string } }) {
  return (
    <Link className="text-row" to={to}>
      <span className="grow">
        <span className="hanzi text-row-zh">{text.titleZh || text.title}</span>
        <span className="small muted">{sub ?? text.title}</span>
        {hit && (
          <span className="text-row-hit">
            <span className="hanzi" lang="zh">
              {hit.zh}
            </span>
            <span className="small muted">{hit.en}</span>
          </span>
        )}
      </span>
      <Icon name="chevron" className="muted" />
    </Link>
  );
}
