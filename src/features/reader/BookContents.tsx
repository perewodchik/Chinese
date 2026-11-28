import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { chapterHead, chineseNumber, isFrontMatter, type Book } from '../../domain/bookshelf';
import { chapterRollup, isPartRead, partProgressKey, splitChapter } from '../../domain/chapterParts';
import type { ShelfEntry, TextSet } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { BookCover } from './BookCover';
import { minutesForHanzi, minutesToRead, shareOf } from './readerProgress';
import './shelves.css';

/**
 * The book's chapters, from the list button in the bar: a panel from the
 * left with the cover, then every chapter with where you are in it — read,
 * the one open now, or how many of its words are new to you. Chapters longer
 * than 450 characters expand into their derived sub-parts (e.g. 3.1, 3.2)
 * while the full chapter stays on the parent row.
 */
export function BookContents({
  set,
  book,
  entries,
  page,
  part,
  onClose,
}: {
  set: TextSet;
  book: Book;
  entries: ShelfEntry[];
  /** the chapter open now, from 1 */
  page: number;
  /** 1-based part number open now, or null when viewing the full chapter */
  part: number | null;
  onClose: () => void;
}) {
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
              const num = n;
              const head = chapterHead(e.main, story && !front ? num : null);
              const primary = e.easier ?? e.main;
              const parts = front ? [] : splitChapter(primary);
              const rollup = parts.length ? chapterRollup(primary, parts, shareOf) : null;
              const read = Boolean(e.main.read || e.easier?.read || (rollup && rollup.partsRead === rollup.partsTotal));
              const nowFull = i + 1 === page && part === null;
              const nowAny = i + 1 === page;
              return (
                <li key={e.main.id} className="rd-toc-item">
                  <Link
                    ref={nowFull ? current : undefined}
                    className="rd-toc-row"
                    to={paths.reading(set.id, { page: i + 1 })}
                    aria-current={nowFull ? 'page' : undefined}
                    onClick={onClose}
                  >
                    <span className="rd-toc-badge hanzi" data-read={(read && !nowAny) || undefined} aria-hidden>
                      {/* The chapter open now shows its number, read or not: it is where you are. */}
                      {read && !nowAny ? <Icon name="check" size={18} /> : front ? <Icon name="book" size={18} /> : story ? chineseNumber(num) : num}
                    </span>
                    <span className="rd-toc-title">
                      <span className={front ? undefined : 'hanzi'}>{front ? 'Before the chapters' : head.zh}</span>
                      <small>
                        {front
                          ? 'Who is who, and the key words'
                          : rollup
                            ? `${rollup.partsRead > 0 ? `${rollup.partsRead} of ${rollup.partsTotal} read` : `${rollup.partsTotal} parts`}, ${rollup.totalHanzi.toLocaleString('en')} chars`
                            : head.en}
                      </small>
                    </span>
                    <span className="rd-toc-state">
                      {rollup
                        ? read
                          ? ''
                          : rollup.pct > 0 || nowAny
                            ? `${rollup.pct}%`
                            : `${minutesForHanzi(rollup.totalHanzi)} min`
                        : nowFull
                          ? `${shareOf(e.easier?.id ?? e.main.id) ?? shareOf(e.main.id) ?? 0}%`
                          : read
                            ? ''
                            : `${minutesToRead(e.main)} min`}
                    </span>
                  </Link>
                  {parts.length > 0 && (
                    <ol className="rd-toc-sublist">
                      {parts.map((p) => {
                        const pDone = isPartRead(primary, p);
                        const pNow = i + 1 === page && part === p.index;
                        const pShare = shareOf(partProgressKey(primary.id, p.index));
                        return (
                          <li key={p.index}>
                            <Link
                              ref={pNow ? current : undefined}
                              className="rd-toc-row rd-toc-subrow"
                              to={paths.reading(set.id, { page: i + 1, part: p.index })}
                              aria-current={pNow ? 'page' : undefined}
                              onClick={onClose}
                            >
                              <span className="rd-toc-subbadge" data-read={(pDone && !pNow) || undefined} aria-hidden>
                                {pDone && !pNow ? <Icon name="check" size={14} /> : `${num}.${p.index}`}
                              </span>
                              <span className="rd-toc-title">
                                <span className="hanzi rd-toc-preview">{p.preview}</span>
                                <small>{p.hanzi.toLocaleString('en')} chars</small>
                              </span>
                              <span className="rd-toc-state">
                                {pNow ? `${pShare ?? (pDone ? 100 : 0)}%` : pDone ? '' : pShare && pShare > 0 ? `${pShare}%` : `${minutesForHanzi(p.hanzi)} min`}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  )}
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
