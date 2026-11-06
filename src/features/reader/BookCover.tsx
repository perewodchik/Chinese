import type { CSSProperties } from 'react';
import type { Book, CoverArt, ScenePalette } from '../../domain/bookshelf';

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
  book: Pick<Book, 'title' | 'kind' | 'easier' | 'art' | 'color' | 'scene'>;
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
          <span className="book-art">
            <Scene art={book.art} p={book.scene} />
          </span>
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

/**
 * A story's picture, the whole cover, drawn in its world's own light: sky,
 * far and near ground, and the thing it is about, in a few flat shapes, as a
 * picture book's cover is. The title sits on a band at its foot.
 */
function Scene({ art, p }: { art: CoverArt; p: ScenePalette }) {
  const sky = <rect width="100" height="142" fill={p.sky} />;
  const band = <rect y="106" width="100" height="36" fill={p.band} />;
  switch (art) {
    case 'tree':
      return (
        <svg viewBox="0 0 100 142" preserveAspectRatio="xMidYMid slice">
          {sky}
          <circle cx="80" cy="18" r="10" fill="#fff7d6" />
          <path d="M0 70q25-14 50-6t50-8v50H0z" fill={p.far} />
          <path d="M0 88q30-8 60-2t40-4v24H0z" fill={p.near} />
          <rect x="44" y="52" width="7" height="40" rx="2" fill="#7a5a3a" />
          <circle cx="47" cy="44" r="22" fill={p.near} />
          <circle cx="36" cy="38" r="12" fill={p.far} opacity="0.55" />
          <circle cx="40" cy="42" r="3.2" fill={p.accent} />
          <circle cx="55" cy="36" r="3.2" fill={p.accent} />
          <circle cx="52" cy="52" r="3.2" fill={p.accent} />
          <circle cx="34" cy="52" r="3" fill={p.accent} />
          <circle cx="62" cy="96" r="2.6" fill={p.accent} />
          {band}
        </svg>
      );
    case 'mountain':
      return (
        <svg viewBox="0 0 100 142" preserveAspectRatio="xMidYMid slice">
          {sky}
          <circle cx="72" cy="30" r="12" fill="#fff3d0" opacity="0.9" />
          <path d="M-4 96L26 44l18 26 16-22 44 48z" fill={p.far} />
          <path d="M-4 108L40 56l24 30 14-12 26 34z" fill={p.near} />
          <path d="M40 56l7 9-7-2-6 5z" fill={p.accent} />
          <path d="M10 26q5-5 10 0q5-5 10 0M52 16q4-4 8 0q4-4 8 0" fill="none" stroke={p.accent} strokeWidth="2.2" strokeLinecap="round" />
          {band}
        </svg>
      );
    case 'lantern':
      return (
        <svg viewBox="0 0 100 142" preserveAspectRatio="xMidYMid slice">
          {sky}
          <circle cx="78" cy="22" r="9" fill="#f6e7c1" />
          <circle cx="16" cy="14" r="0.9" fill="#fff" /><circle cx="40" cy="8" r="0.8" fill="#fff" /><circle cx="58" cy="30" r="0.8" fill="#fff" />
          <path d="M-2 92h34l-6-8h-22zM30 92h44l-8-10H38zM68 92h34l-5-7H73z" fill={p.far} />
          <rect y="92" width="100" height="16" fill={p.near} />
          <path d="M26 0v26M50 0v40M74 0v22" stroke="#e8b84a" strokeWidth="0.9" />
          <circle cx="26" cy="34" r="11" fill={p.accent} opacity="0.25" />
          <ellipse cx="26" cy="34" rx="7" ry="8.5" fill={p.accent} />
          <circle cx="50" cy="48" r="13" fill={p.accent} opacity="0.25" />
          <ellipse cx="50" cy="48" rx="8" ry="10" fill={p.accent} />
          <circle cx="74" cy="30" r="10" fill={p.accent} opacity="0.25" />
          <ellipse cx="74" cy="30" rx="6" ry="7.5" fill={p.accent} />
          {band}
        </svg>
      );
    case 'water':
      return (
        <svg viewBox="0 0 100 142" preserveAspectRatio="xMidYMid slice">
          {sky}
          <circle cx="24" cy="22" r="9" fill="#fff6d6" />
          <path d="M0 62q30-14 60-4t40-6v14H0z" fill={p.far} />
          <rect y="64" width="100" height="44" fill={p.near} />
          <path d="M6 76q6-4 12 0t12 0M50 88q6-4 12 0t12 0M20 98q6-4 12 0t12 0M64 72q6-4 12 0" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
          <path d="M52 58q12-12 26-2q-14 8-26 2zM78 56l7-6v12z" fill={p.accent} />
          <circle cx="58" cy="56" r="1.3" fill="#18202b" />
          {band}
        </svg>
      );
    case 'city':
      return (
        <svg viewBox="0 0 100 142" preserveAspectRatio="xMidYMid slice">
          {sky}
          <circle cx="50" cy="56" r="20" fill={p.accent} opacity="0.55" />
          <path d="M0 108V58h14v-8h10v58zM64 108V46h12v-6h8v6h16v62z" fill={p.far} />
          <path d="M18 108V68h16v40zM36 108V40h20v68zM58 108V62h14v46zM80 108V72h20v36z" fill={p.near} />
          <path d="M40 48h4M48 48h4M40 58h4M48 58h4M40 68h4M48 68h4M40 78h4M22 76h3M28 76h3M22 86h3M62 70h3M67 70h3M84 80h3M92 80h3" stroke={p.accent} strokeWidth="3" />
          {band}
        </svg>
      );
    case 'snow':
      return (
        <svg viewBox="0 0 100 142" preserveAspectRatio="xMidYMid slice">
          {sky}
          <path d="M-4 86L28 40l20 26 18-18 38 38z" fill={p.near} />
          <path d="M28 40l8 11-8-3-7 5zM66 48l7 8-7-2-6 4z" fill={p.far} />
          <rect y="86" width="100" height="22" fill={p.far} />
          <path d="M18 96l7-16 7 16zM20 86l5-11 5 11zM74 98l6-14 6 14zM76 89l4-9 4 9z" fill={p.accent} />
          <circle cx="12" cy="16" r="1.4" fill="#fff" /><circle cx="44" cy="12" r="1.2" fill="#fff" /><circle cx="84" cy="22" r="1.4" fill="#fff" /><circle cx="60" cy="30" r="1.1" fill="#fff" /><circle cx="26" cy="30" r="1.1" fill="#fff" />
          {band}
        </svg>
      );
    case 'food':
      return (
        <svg viewBox="0 0 100 142" preserveAspectRatio="xMidYMid slice">
          {sky}
          <rect y="74" width="100" height="34" fill={p.near} />
          <path d="M18 62h64q-2 30-32 30T18 62z" fill={p.accent} />
          <path d="M18 62h64" stroke={p.far} strokeWidth="3" />
          <path d="M38 52q5-9 0-18M50 52q5-9 0-18M62 52q5-9 0-18" fill="none" stroke={p.far} strokeWidth="2" strokeLinecap="round" />
          <path d="M66 26l16 36M74 24l12 38" stroke="#7a5a3a" strokeWidth="2.4" strokeLinecap="round" />
          {band}
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 142" preserveAspectRatio="xMidYMid slice">
          {sky}
          <path d="M68 16a16 16 0 1 0 12 28a12 12 0 1 1-12-28z" fill={p.accent} />
          <circle cx="16" cy="20" r="1.4" fill="#fff" /><circle cx="34" cy="10" r="1.1" fill="#fff" /><circle cx="26" cy="44" r="1.1" fill="#fff" /><circle cx="48" cy="30" r="1.4" fill="#fff" /><circle cx="86" cy="58" r="1.1" fill="#fff" />
          <path d="M0 84q25-16 50-8t50-6v38H0z" fill={p.far} />
          <path d="M0 96q30-10 60-4t40-2v18H0z" fill={p.near} />
          {band}
        </svg>
      );
  }
}
