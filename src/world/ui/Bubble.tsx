import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** how fast he talks: one character per tick */
const TICK_MS = 18;

/**
 * 兔儿爷's line, typed out into a box of a fixed number of lines — the way
 * a game's text box does it. Nothing scrolls: a line longer than the box
 * pauses at the page's end with a small ▼, and a tap shows the next page.
 * A tap while he types finishes the page at once.
 *
 * The text is laid out whole from the start (the untyped part invisible), so
 * the lines never re-wrap as he types and the box never changes size.
 */
export function Typed({ text, lines, onBusy }: { text: string; lines: number; onBusy?: (busy: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const shown = useRef<HTMLSpanElement>(null);
  const caret = useRef<HTMLSpanElement>(null);
  const ghost = useRef<HTMLSpanElement>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const run = useRef({ chars: [] as string[], n: 0, page: 0, timer: 0 });
  const busy = useRef(onBusy);
  busy.current = onBusy;

  const lineHeight = () => parseFloat(getComputedStyle(box.current!).lineHeight) || 20;
  const pages = () => Math.max(1, Math.ceil((inner.current!.offsetHeight - 2) / (lineHeight() * lines)));
  const put = (n: number) => {
    const r = run.current;
    r.n = n;
    shown.current!.textContent = r.chars.slice(0, n).join('');
    ghost.current!.textContent = r.chars.slice(n).join('');
  };
  const pastPage = () => Math.floor((caret.current!.offsetTop + 2) / lineHeight()) >= (run.current.page + 1) * lines;
  const stop = () => {
    window.clearInterval(run.current.timer);
    run.current.timer = 0;
  };
  /** type one character, or up to the page's end at once; say whether to go on */
  const step = (all: boolean): boolean => {
    const r = run.current;
    do {
      if (r.n >= r.chars.length) {
        stop();
        busy.current?.(false);
        setMore(r.page < pages() - 1);
        return false;
      }
      put(r.n + 1);
      if (pastPage()) {
        // the next character starts the next page: wait for a tap
        stop();
        busy.current?.(false);
        setMore(true);
        return false;
      }
    } while (all);
    return true;
  };
  const start = () => {
    stop();
    busy.current?.(true);
    run.current.timer = window.setInterval(() => step(false), TICK_MS);
  };

  // A new line: from the top, typed (or whole, for reduced motion).
  useLayoutEffect(() => {
    const r = run.current;
    r.chars = [...text];
    r.page = 0;
    setPage(0);
    setMore(false);
    if (reduced()) {
      put(r.chars.length);
      setMore(pages() > 1);
      return;
    }
    put(0);
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  useLayoutEffect(() => () => busy.current?.(false), []);

  // A tap on his line: finish the page, or turn it.
  const advance = () => {
    const r = run.current;
    if (r.timer) {
      step(true);
      return;
    }
    const all = pages();
    if (r.page < all - 1) {
      r.page += 1;
      setPage(r.page);
      setMore(false);
      if (r.n < r.chars.length) {
        // the character that paused it is on this page already
        if (!pastPage()) start();
      } else setMore(r.page < all - 1);
    } else if (all > 1 && r.n >= r.chars.length) {
      // at the end of a long line, a tap reads it again from the top
      r.page = 0;
      setPage(0);
      setMore(true);
    }
  };

  return (
    <div className="wb-text" ref={box} style={{ ['--lines' as string]: lines }} onClick={advance}>
      <div className="wb-text-in" ref={inner} style={{ transform: `translateY(calc(${-page * lines} * 1.4em))` }}>
        <span ref={shown} />
        <span ref={caret} />
        <span ref={ghost} className="wb-ghost" aria-hidden />
      </div>
      <span className="wb-sr">{text}</span>
      {more && <span className="wb-more" aria-hidden />}
    </div>
  );
}

/**
 * Word chips that wrap to at most the rows their box holds; the ones that do
 * not fit go behind a "+N" chip. Measured after layout, before paint, so
 * nothing is seen moving.
 */
export function FitChips<T>({ items, keyOf, render, more }: { items: readonly T[]; keyOf: (t: T) => string; render: (t: T) => ReactNode; more: (hidden: T[]) => ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // new words or a new width: try them all again
  const sig = `${items.map(keyOf).join('|')}#${width}`;
  const [measured, setMeasured] = useState({ sig, fit: items.length });
  const fit = measured.sig === sig ? measured.fit : items.length;
  useLayoutEffect(() => {
    const el = box.current;
    const last = el?.lastElementChild as HTMLElement | null;
    if (!el || !last || fit <= 0) return;
    if (last.offsetTop + last.offsetHeight > el.clientHeight + 1) setMeasured({ sig, fit: fit - 1 });
  });
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const hidden = items.slice(fit);
  return (
    <div className="wb-chips" ref={box}>
      {items.slice(0, fit).map((t) => (
        <span key={keyOf(t)} className="wb-chip">
          {render(t)}
        </span>
      ))}
      {hidden.length > 0 && more(hidden)}
    </div>
  );
}
