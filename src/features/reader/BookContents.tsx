import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { chapterHead, chineseNumber, isFrontMatter, type Book } from '../../domain/bookshelf';
import type { ShelfEntry, TextSet } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { useWordLevel } from '../shared/levels';
import { BookCover } from './BookCover';
import './shelves.css';

/**
 * The book's chapters, from the list button in the bar: a panel from the
 * left with the cover, then every chapter with where you are in it — read,
 * the one open now, or how many of its words are new to you. A chapter opens
 * on a tap and the panel goes; Escape, Close or a tap beside it put it away.
 */
export function BookContents({
  set,
  book,
  entries,
  page,
  onClose,
}: {
  set: TextSet;
  book: Book;
  entries: ShelfEntry[];
  /** the chapter open now, from 1 */
  page: number;
  onClose: () => void;
}) {
  const levelOfWord = useWordLevel();
  const story = book.kind === 'story';
  const current = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    current.current?.focus({ preventScroll: true });
    current.current?.scrollIntoView({ block: 'center' });
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  let n = 0;
  return (
    <div className="rd-toc-scrim" onClick={onClose}>
      <nav className="rd-toc" role="dialog" aria-modal="true" aria-label="Chapters" onClick={(e) => e.stopPropagation()}>
        <div className="rd-toc-body">
          <header className="rd-toc-head">
            <BookCover book={book} width={64} />
            <span>
              <b className={/\p{Script=Han}/u.test(book.title) ? 'hanzi' : undefined}>{book.title}</b>
              <small>
                {story ? `${entries.filter((e) => !isFrontMatter(e.main)).length} chapters` : `${entries.length} texts`}
              </small>
            </span>
          </header>
          <ol className="rd-toc-list">
            {entries.map((e, i) => {
              const front = story && isFrontMatter(e.main);
              if (!front) n += 1;
              const head = chapterHead(e.main, story && !front ? n : null);
              const read = Boolean(e.main.read || e.easier?.read);
              const now = i + 1 === page;
              const fresh = e.main.vocab.filter((v) => levelOfWord(v.w) === 0).length;
              return (
                <li key={e.main.id}>
                  <Link
                    ref={now ? current : undefined}
                    className="rd-toc-row"
                    to={paths.reading(set.id, { page: i + 1 })}
                    aria-current={now ? 'page' : undefined}
                    onClick={onClose}
                  >
                    <span className="rd-toc-badge hanzi" data-read={(read && !now) || undefined} aria-hidden>
                      {/* The chapter open now shows its number, read or not: it is where you are. */}
                      {read && !now ? <Icon name="check" size={18} /> : front ? <Icon name="book" size={18} /> : story ? chineseNumber(n) : n}
                    </span>
                    <span className="rd-toc-title">
                      <span className={front ? undefined : 'hanzi'}>{front ? 'Before the chapters' : head.zh}</span>
                      <small>{front ? 'Who is who, and the key words' : head.en}</small>
                    </span>
                    <span className="rd-toc-state">{now ? 'Reading' : read ? 'Read' : fresh ? `${fresh} new` : ''}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="rd-toc-foot">
          <Link className="btn quiet" to={paths.shelf(set.id)}>
            The book’s page
          </Link>
          <button className="btn tonal" onClick={onClose}>
            Close
          </button>
        </div>
      </nav>
    </div>
  );
}
