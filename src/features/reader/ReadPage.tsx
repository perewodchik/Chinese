import { askText } from '../../ui/dialogs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { charId } from '../../domain/ids';
import { bookFromFile } from '../../domain/bookFile';
import { useToast } from '../../ui/toast';
import { firstUnread, isHanzi, shelfEntries, shelve, type GeneratedText, type TextSet } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { useIsAdmin } from '../auth/session';
import { WelcomeBack } from '../shared/WelcomeBack';
import { Announcement } from '../shared/Announcement';
import { useCardsToday } from '../shared/cardsToday';
import { useQuery } from '../../navigation/query';
import { addTexts } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { useTitle } from '../../ui/useTitle';
import { lastReading } from '../shared/lastRead';
import { useLevelOf } from '../shared/levels';
import { charLevels, fitOf } from '../../domain/reading';
import { useStartSession } from './startSession';
import { bookcase, bookOf, isFrontMatter, SHELF_FINISHED, type Book } from '../../domain/bookshelf';
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
  const startSession = useStartSession();
  const shelf = useMemo(() => shelve(texts, sets), [texts, sets]);
  const go = useContinue();
  const cards = useCardsToday();
  const [showFinished, setShowFinished] = useState(false);
  // With fewer than twenty characters marked every book reads as hard, which says nothing: covers say it from twenty on.
  const marked = useStore((s) => [...s.learned].filter((id) => id.startsWith('c')).length);
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
      .slice(0, 30)
      // The sentence that answered, unless the title did: why this text is in the list.
      .map((t) => {
        const inTitle = t.titleZh.includes(needle) || t.title.toLowerCase().includes(needle);
        const line = inTitle ? undefined : t.lines.find((l) => l.zh.includes(needle) || l.en.toLowerCase().includes(needle) || sounds(l.py));
        const word = inTitle || line ? undefined : t.vocab.find((w) => w.w.includes(needle) || w.d.toLowerCase().includes(needle) || sounds(w.py));
        return { text: t, hit: line ? { zh: line.zh, en: line.en } : word ? { zh: word.w, en: word.d } : undefined };
      });
  }, [q, texts]);

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
        {/* A word on it, not a bare +: a new learner does not know + means "a text to read" (V3). */}
        <Menu
          label={
            <>
              <Icon name="plus" size={18} />
              Add
            </>
          }
          title="Add a text or a book"
          className="btn tonal sm read-add"
        >
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
            {found.map(({ text: t, hit }) => (
              <TextRow key={t.id} text={t} to={paths.text(t.id)} sub={sets.find((s) => s.id === t.setId)?.name} hit={hit} />
            ))}
          </div>
          {/* B6: the same search in the dictionary, for a word met here to be looked up. */}
          <div className="list read-dict">
            <Link className="text-row" to={paths.librarySearch(q.trim())}>
              <span className="grow">
                <b>Look up “{q.trim()}” in the Library</b>
                <span className="small muted">Its characters and words, with their meaning and strokes</span>
              </span>
              <Icon name="chevron" className="muted" />
            </Link>
          </div>
        </section>
      ) : (
        <>
          <Announcement />

          <WelcomeBack />

          {go && <ContinueBook go={go} />}

          {/* What Today used to say about the day's cards, as one quiet line (V2); nothing when there are none. */}
          {cards.count > 0 && (
            <Link className="read-cards" to={paths.cardSession()}>
              <span className="grow">
                {cards.count} card{cards.count === 1 ? '' : 's'} today · about {cards.minutes} min
              </span>
              <span className="btn tonal sm">Start</span>
            </Link>
          )}

          {sets.length ? (
            <div className="bookcase">
              {shelves.map((sh) => (
                <section key={sh.name} className="bookshelf" data-small={sh.books.length <= 2 || undefined}>
                  <div className="bookshelf-head">
                    <h2>{sh.name}</h2>
                    <span className="small muted">
                      {sh.books.length} book{sh.books.length === 1 ? '' : 's'}
                    </span>
                    {/* What is finished is folded away: it is there to come back to, not to choose from. */}
                    {sh.name === SHELF_FINISHED && (
                      <button className="btn quiet sm bookshelf-fold" aria-expanded={showFinished} onClick={() => setShowFinished((v) => !v)}>
                        {showFinished ? 'Hide' : 'Show'}
                      </button>
                    )}
                  </div>
                  {(sh.name !== SHELF_FINISHED || showFinished) && (
                  <div className="bookshelf-row">
                    {sh.books.map((b) => (
                      <BookOnShelf key={b.set.id} book={b} texts={shelf.bySet.get(b.set.id) ?? []} reading={go?.set?.id === b.set.id} judge={marked >= 20} />
                    ))}
                  </div>
                  )}
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
  const entries = shelfEntries(texts);
  const read = entries.filter((e) => e.main.read || e.easier?.read).length;
  const opened = (t: GeneratedText | null) => Boolean(t && (t.read || t.lastReadAt));
  const unopened = entries.filter((e) => !opened(e.main) && !opened(e.easier)).length;
  return { total: entries.length, read, unopened };
}

const FIT = { comfortable: 'Comfortable', stretch: 'A stretch', hard: 'Hard' } as const;

/** A book standing on its shelf: its cover, how far through it you are, how far within reach, and a tap opens it. */
function BookOnShelf({ book, texts, reading, judge }: { book: Book; texts: GeneratedText[]; reading: boolean; judge: boolean }) {
  const width = useBookWidth();
  const p = progressOf(texts);
  const levelOfId = useLevelOf();
  // How far within reach, over every text of the book: the text head's count, once per book (V4).
  const fit = useMemo(() => (judge ? fitOf(charLevels(texts.flatMap((t) => t.lines.map((l) => l.zh)), (c) => levelOfId(charId(c)))) : null), [judge, texts, levelOfId]);
  const meta = !p.total ? 'Empty' : p.read === 0 && p.unopened === p.total ? `New · ${p.total} ${p.total === 1 ? 'text' : book.kind === 'story' ? 'chapters' : 'texts'}` : `${p.read} of ${p.total} read`;
  return (
    <Link className="book" to={paths.shelf(book.set.id)} aria-label={`${book.title}${book.easier ? ', easier edition' : book.original ? ', original edition' : ''}: ${meta}`} style={{ width }}>
      <BookCover book={book} width={width} bookmark={reading} fresh={p.unopened > 0 && p.unopened < p.total} done={p.total > 0 && p.read === p.total} />
      <span className="book-meta">
        <i>
          <i style={{ width: `${p.total ? Math.round((p.read / p.total) * 100) : 0}%` }} />
        </i>
        {meta}
        {/* The room is kept when there is nothing to say, so covers on a shelf line up. */}
        <span className="book-fit" data-hidden={fit ? undefined : ''}>
          {fit ? FIT[fit] : '\u00a0'}
        </span>
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
        {/* A text never opened is started, not gone on with. */}
        <span className="small muted">{go.text.read || go.text.lastReadAt ? 'Go on reading' : 'Start reading'}{book ? ` · ${book.title}` : ''}</span>
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
