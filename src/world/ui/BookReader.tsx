import { useEffect, useRef, useState } from 'react';
import { ENGLISH_KEY, glossesByPage, openAt, pageCount, shelfRows, TODAY_HEAD, todayText, type Book } from '../core/books';
import { souvenirs, type PlaceCard } from '../core/cards';
import type { SaveAction } from '../core/save';
import type { WorldSave } from '../core/types';
import { playLine } from './lineVoice';
import { FitSprite } from './PropSprite';
import { ZhText } from './ZhText';
import './book.css';

/** A picture on a page or a cover: a frame of the props atlas, or a spirit's woodcut (`figures/<id>`). */
function Pic({ pic, box }: { pic: string; box: number }) {
  return pic.startsWith('figures/') ? <FitSprite frame={pic} box={box} atlas="woodcut" /> : <FitSprite frame={pic} box={box} />;
}

const readEnglish = () => {
  try {
    return localStorage.getItem(ENGLISH_KEY) === '1';
  } catch {
    return false;
  }
};
const writeEnglish = (on: boolean) => {
  try {
    localStorage.setItem(ENGLISH_KEY, on ? '1' : '0');
  } catch {
    /* it just forgets */
  }
};

/**
 * A book open (§13 B1): one page at a time in a fixed page box, so nothing
 * moves when you turn (‹ › or a swipe, ← → on a keyboard). The Chinese on
 * top with its words tappable and unknown ones marked; the English under a
 * tap, or always with "EN" on (this device remembers). The words glossed for
 * the first time sit under the page. 🔊 reads the page aloud. A page seen is
 * a page read; the last one is 「今天的北京」, what you can see in the city.
 */
export function BookReader({ book, save, pinyin: pinyinAtFirst, onAct, onClose }: { book: Book; save: WorldSave; pinyin: boolean; onAct: (a: SaveAction) => void; onClose: () => void }) {
  const n = pageCount(book);
  const [page, setPage] = useState(() => openAt(save, book));
  const [english, setEnglish] = useState(readEnglish);
  const [peek, setPeek] = useState(false);
  const [pinyin, setPinyin] = useState(pinyinAtFirst);
  const glosses = glossesByPage(book);
  const today = page === book.pages.length;
  const p = today ? { zh: todayText(book.today.zh), en: book.today.en.replace(/^In Beijing today[:：]\s*/, ''), pic: undefined } : book.pages[page]!;
  const go = (d: number) => setPage((x) => Math.max(0, Math.min(n - 1, x + d)));
  // a page seen is a page read (the diary says so at the last one)
  useEffect(() => {
    if (!save.books[book.id]?.read.includes(page)) onAct({ do: 'read', id: book.id, page, of: n, zh: book.zh });
    setPeek(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, book.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else return;
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });
  const swipe = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      className="bk-scrim"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <section className="bk" role="dialog" aria-label={`《${book.zh}》 — ${book.en}`} onClick={(e) => e.stopPropagation()}>
        <header className="bk-head">
          <b className="han bk-title">《{book.zh}》</b>
          <span className="tiny muted bk-sub">{book.en}</span>
          <span className="spacer" />
          <button type="button" className="wd-tool" aria-pressed={pinyin} onClick={() => setPinyin((x) => !x)} title="Pinyin over the words">
            拼
          </button>
          <button
            type="button"
            className="wd-tool bk-en"
            aria-pressed={english}
            onClick={() => {
              setEnglish((x) => {
                writeEnglish(!x);
                return !x;
              });
            }}
            title="Show the English under every page"
          >
            EN
          </button>
          <button type="button" className="wd-tool" onClick={() => void playLine({ speaker: 'narrator', zh: p.zh, en: p.en, node: `book:${book.id}:${page}` })} aria-label="Read the page aloud">
            🔊
          </button>
          <button type="button" className="wd-tool" onClick={onClose} aria-label="Close the book">
            ×
          </button>
        </header>
        <div
          className="bk-page"
          data-today={today ? '' : undefined}
          onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) go(dx < 0 ? 1 : -1);
          }}
        >
          {today ? (
            <p className="bk-today-head">
              <span className="han">{TODAY_HEAD.zh}</span>
              <span>{TODAY_HEAD.en}</span>
            </p>
          ) : (
            <div className="bk-pic" aria-hidden>
              {p.pic ? <Pic pic={p.pic} box={96} /> : null}
            </div>
          )}
          <ZhText zh={p.zh} pinyin={pinyin} className="wd-zh bk-zh" />
          {english || peek ? (
            <p className="small bk-en-text">{p.en}</p>
          ) : (
            <button type="button" className="bk-peek tiny" onClick={() => setPeek(true)}>
              Tap for the English
            </button>
          )}
          {glosses[page]!.length > 0 && (
            <p className="bk-gloss tiny muted">
              {glosses[page]!.map((g) => (
                <span key={g.w}>
                  <b className="han">{g.w}</b> {g.en}
                </span>
              ))}
            </p>
          )}
        </div>
        <footer className="bk-foot">
          <button type="button" className="bk-turn" disabled={page === 0} onClick={() => go(-1)} aria-label="Page before">
            ‹
          </button>
          <span className="bk-dots" aria-label={`Page ${page + 1} of ${n}`}>
            {Array.from({ length: n }, (_, i) => (
              <button key={i} type="button" className="bk-dot" aria-current={i === page ? 'page' : undefined} data-read={save.books[book.id]?.read.includes(i) ? '' : undefined} onClick={() => setPage(i)} aria-label={`Page ${i + 1}`} />
            ))}
          </span>
          <button type="button" className="bk-turn" disabled={page === n - 1} onClick={() => go(1)} aria-label="Next page">
            ›
          </button>
        </footer>
      </section>
    </div>
  );
}

/**
 * The books: yours as covers (how far you've read, ✓ when finished), the
 * rest as grey spines that say where they come from. The Collection's 书
 * view and the 书架 at home show the same list.
 */
export function Books({ save, books, onOpen }: { save: WorldSave; books: readonly Book[]; onOpen: (id: string) => void }) {
  const rows = shelfRows(save, books);
  if (!rows.some((r) => r.have))
    return (
      <div className="empty wp-empty">
        <div className="big han">书</div>
        <p className="small muted">No books yet — people give you one in each chapter. {rows[0] ? rows[0].book.where : ''}</p>
      </div>
    );
  return (
    <ul className="bk-shelf">
      {rows.map((r) => (
        <li key={r.book.id}>
          {r.have ? (
            <button type="button" className="bk-cover" onClick={() => onOpen(r.book.id)} aria-label={`《${r.book.zh}》, ${r.book.en} — ${r.done ? 'read' : `${r.read} of ${r.pages} pages read`}`}>
              <span className="bk-cover-art" aria-hidden>
                <Pic pic={r.book.cover} box={48} />
              </span>
              <b className="han bk-cover-title">{r.book.zh}</b>
              <span className="tiny muted bk-one">{r.book.en}</span>
              <span className="tiny bk-progress" data-done={r.done ? '' : undefined}>
                {r.done ? '✓ read' : r.read ? `${r.read} / ${r.pages}` : 'new'}
              </span>
            </button>
          ) : (
            <div className="bk-spine" aria-label={`A book you don't have yet: ${r.book.where}`}>
              <b className="han bk-cover-title">{r.book.zh}</b>
              <span className="tiny muted bk-where">{r.book.where}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The 书架 in your room (§13 B1): the same shelf in a sheet of its own. */
export function BookShelf({ save, books, cards = [], onOpen, onClose }: { save: WorldSave; books: readonly Book[]; cards?: readonly PlaceCard[]; onOpen: (id: string) => void; onClose: () => void }) {
  const [card, setCard] = useState<string | null>(null);
  const shelf = souvenirs(save, cards);
  const open = shelf.find((x) => x.state.card.id === card);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const have = Object.keys(save.books).length;
  return (
    <div className="wp-scrim wc-scrim" onClick={onClose}>
      <section className="wp wc bk-case" role="dialog" aria-label="书架 — your bookshelf" onClick={(e) => e.stopPropagation()}>
        <header className="wp-tabs wc-head-bar">
          <b className="han wc-title">书架</b>
          <span className="tiny muted wc-sub">
            {have} / {books.length} books · tap one to read
          </span>
          <span className="spacer" />
          <button type="button" className="wd-tool" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="bk-case-body">
          {shelf.length > 0 && (
            <>
              <h3 className="wp-label">
                <span className="han">纪念品</span> · souvenirs {shelf.filter((x) => x.got).length} / {shelf.length}
              </h3>
              <p className="tiny muted">Fill a place's card (收藏 → 地方) and its souvenir comes home to this shelf.</p>
              <ul className="bk-souvenirs">
                {shelf.map(({ state: st, got }) => (
                  <li key={st.card.id}>
                    <button type="button" className="bk-souvenir" data-got={got ? '' : undefined} onClick={() => setCard(st.card.id)} aria-label={got ? st.card.souvenir!.en : `${st.card.en}: ${st.open.length} of ${st.card.facts.length}`}>
                      <span className="bk-souvenir-art">{got ? <FitSprite frame={st.card.souvenir!.frame} box={48} /> : <span className="han">?</span>}</span>
                      <b className="han tiny">{got ? st.card.souvenir!.zh : st.card.zh}</b>
                      {!got && (
                        <span className="tiny muted">
                          {st.open.length} / {st.card.facts.length}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <h3 className="wp-label">
                <span className="han">书</span> · books
              </h3>
            </>
          )}
          <Books save={save} books={books} onOpen={onOpen} />
        </div>
        {open && (
          <div className="bk-souvenir-card" role="dialog" aria-label={open.state.card.en}>
            <header className="w-sheet-head">
              <b className="han">{open.state.card.zh}</b> <span className="small">{open.state.card.pinyin}</span>
              <span className="spacer" />
              <button type="button" className="wd-tool" onClick={() => setCard(null)} aria-label="Close">
                ×
              </button>
            </header>
            <p className="small">{open.got ? `${open.state.card.souvenir!.zh} — ${open.state.card.souvenir!.en}.` : 'Its souvenir comes home when the card is full.'}</p>
            <ol className="cl-facts">
              {open.state.card.facts.map((f) =>
                open.state.open.includes(f) ? (
                  <li key={f.id} data-open="">
                    <ZhText zh={f.zh} pinyin={save.settings.pinyin} className="wd-zh wp-zh" />
                    <span className="small muted">{f.en}</span>
                  </li>
                ) : (
                  <li key={f.id}>
                    <span className="small">Not yet — {f.how}</span>
                  </li>
                ),
              )}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
