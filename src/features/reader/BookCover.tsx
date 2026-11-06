import type { CSSProperties, ReactNode } from 'react';
import type { Book, CoverArt } from '../../domain/bookshelf';

/**
 * A book's cover, as it stands on a shelf: a story's drawn from what it is
 * about, title in brush at its foot; anything else an exercise book (练习本)
 * with a white label. Cloth colours are the book's own, the same in light and
 * dark, as a real cover would be. On it, as marks a real book could carry: the
 * 简 Easier sticker of an easier edition, a bookmark where you are reading, a
 * dot for a chapter not opened yet, and a 读完 seal once it is read through.
 */
export function BookCover({
  book,
  width,
  bookmark,
  fresh,
  done,
}: {
  book: Pick<Book, 'title' | 'kind' | 'easier' | 'art' | 'color'>;
  width: number;
  /** you are reading it now */
  bookmark?: boolean;
  /** a chapter in it not opened yet */
  fresh?: boolean;
  /** every chapter read */
  done?: boolean;
}) {
  const style = { '--cover': book.color.bg, '--spine': book.color.spine, width, height: Math.round(width * 1.42), fontSize: width / 6.2 } as CSSProperties;
  return (
    <span className="book-cover" data-kind={book.kind} style={style} aria-hidden>
      {book.kind === 'story' ? (
        <>
          <span className="book-art">{ART[book.art]}</span>
          <span className="book-title hanzi">{book.title}</span>
        </>
      ) : (
        <span className="book-label">
          <span className={/\p{Script=Han}/u.test(book.title) ? 'hanzi' : 'book-label-latin'} lang={/\p{Script=Han}/u.test(book.title) ? 'zh' : 'en'}>
            {book.title}
          </span>
          <i />
          <i />
        </span>
      )}
      {book.easier && (
        <span className="book-easier">
          <span className="hanzi">简</span> Easier
        </span>
      )}
      {bookmark && <span className="book-ribbon" />}
      {fresh && !book.easier && <span className="book-new" />}
      {done && <span className="book-seal hanzi">读完</span>}
    </span>
  );
}

// Each drawn in the same few flat shapes, on a 100 × 80 box, light on the cloth.
const ART: Record<CoverArt, ReactNode> = {
  tree: (
    <svg viewBox="0 0 100 80">
      <circle cx="54" cy="32" r="26" fill="rgb(255 255 255 / 18%)" />
      <rect x="50" y="50" width="8" height="24" fill="#7a5a3a" />
      <circle cx="44" cy="26" r="5" fill="#d9544a" />
      <circle cx="64" cy="38" r="5" fill="#d9544a" />
      <circle cx="57" cy="18" r="4.5" fill="#d9544a" />
    </svg>
  ),
  mountain: (
    <svg viewBox="0 0 100 80">
      <path d="M4 72L34 26l16 22 14-18 32 42z" fill="#e8d9b8" opacity="0.9" />
      <path d="M34 26l8 12-8-3-7 5z" fill="#fafbf8" />
      <path d="M14 20q6-6 12 0q6-6 12 0M60 12q5-5 10 0q5-5 10 0" fill="none" stroke="#fafbf8" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  lantern: (
    <svg viewBox="0 0 100 80">
      <path d="M30 0v14M70 0v22M50 0v8" stroke="#e8b84a" strokeWidth="1.5" />
      <ellipse cx="30" cy="24" rx="10" ry="12" fill="#d9544a" />
      <ellipse cx="70" cy="33" rx="11" ry="13" fill="#d9544a" />
      <ellipse cx="50" cy="17" rx="8" ry="10" fill="#e8b84a" />
      <path d="M8 70q20-12 42-4t42-6" fill="none" stroke="rgb(255 255 255 / 45%)" strokeWidth="2" />
    </svg>
  ),
  water: (
    <svg viewBox="0 0 100 80">
      <path d="M58 30q14-10 26 0q-12 10-26 0zM84 30l8-6v12z" fill="#e8b84a" />
      <circle cx="64" cy="29" r="1.6" fill="#18202b" />
      <path d="M4 50q8-6 16 0t16 0t16 0t16 0t16 0t16 0M4 62q8-6 16 0t16 0t16 0t16 0t16 0t16 0" fill="none" stroke="#fafbf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
    </svg>
  ),
  city: (
    <svg viewBox="0 0 100 80">
      <path d="M8 74V40h16v34zM28 74V22h18v52zM50 74V34h14v40zM68 74V14h20v60z" fill="rgb(255 255 255 / 22%)" />
      <path d="M33 30h3M40 30h3M33 40h3M40 40h3M73 22h3M81 22h3M73 32h3M81 32h3M73 42h3M81 42h3" stroke="#e8b84a" strokeWidth="3" />
    </svg>
  ),
  snow: (
    <svg viewBox="0 0 100 80">
      <path d="M50 10v40M33 20l34 20M67 20L33 40" stroke="#fafbf8" strokeWidth="3" strokeLinecap="round" />
      <path d="M4 72q24-14 48-6t44-4" fill="none" stroke="#fafbf8" strokeWidth="2.5" />
      <circle cx="20" cy="18" r="2" fill="#fafbf8" /><circle cx="82" cy="12" r="2" fill="#fafbf8" /><circle cx="86" cy="44" r="2" fill="#fafbf8" />
    </svg>
  ),
  food: (
    <svg viewBox="0 0 100 80">
      <path d="M22 38h56q-2 26-28 26T22 38z" fill="#fafbf8" />
      <path d="M22 38h56" stroke="#e8b84a" strokeWidth="3" />
      <path d="M40 30q4-8 0-16M52 30q4-8 0-16M64 30q4-8 0-16" fill="none" stroke="rgb(255 255 255 / 60%)" strokeWidth="2" strokeLinecap="round" />
      <path d="M60 10l18 30M68 8l14 32" stroke="#7a5a3a" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  night: (
    <svg viewBox="0 0 100 80">
      <path d="M66 12a18 18 0 1 0 14 30a14 14 0 1 1-14-30z" fill="#e8b84a" />
      <circle cx="20" cy="20" r="2" fill="#fafbf8" /><circle cx="36" cy="10" r="1.6" fill="#fafbf8" /><circle cx="28" cy="40" r="1.6" fill="#fafbf8" /><circle cx="48" cy="28" r="2" fill="#fafbf8" />
      <path d="M4 74q20-16 46-8t46-6" fill="none" stroke="rgb(255 255 255 / 40%)" strokeWidth="2" />
    </svg>
  ),
};
