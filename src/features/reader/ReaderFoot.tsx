import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';
import { rememberShare, scrolledShare } from './readerProgress';

/**
 * The reader's foot, in one row along the bottom edge: the chapters, back a
 * chapter, how far down this one you have scrolled, and on a chapter.
 *
 * The share is the scroll itself: what has gone by over what can go by. At
 * the bottom it is always 100%, and reaching it once counts the chapter read
 * (`onEnd`, once per chapter opened), with no button for it.
 *
 * States: one chapter (no ‹ ›); the first (‹ off) and the last (› off); not a
 * book (no chapters button); a text shorter than the screen (100% at once).
 */
export function ReaderFoot({
  textId,
  onContents,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  onEnd,
}: {
  textId: string;
  onContents: (() => void) | null;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  prevLabel: string;
  nextLabel: string;
  onEnd: () => void;
}) {
  const [share, setShare] = useState(0);
  const ended = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  useEffect(() => {
    ended.current = false;
    let frame = 0;
    const measure = () => {
      frame = 0;
      // Measured on the text itself, between the bar and the foot: the page
      // scrolls in the app's own column, not always in the window.
      const text = document.querySelector<HTMLElement>('.rd-text');
      if (!text) return;
      const top = document.querySelector('.rd-pin')?.getBoundingClientRect().bottom ?? 0;
      const bottom = document.querySelector('.rd-foot')?.getBoundingClientRect().top ?? window.innerHeight;
      // Up to its last line: once that is in sight, the chapter is read.
      const lines = text.querySelectorAll('.sent');
      const r = text.getBoundingClientRect();
      const end = lines.length ? lines[lines.length - 1]!.getBoundingClientRect().bottom : r.bottom;
      const s = scrolledShare(top - r.top, end - r.top, bottom - top);
      setShare(s);
      rememberShare(textId, s);
      if (s >= 1 && !ended.current) {
        ended.current = true;
        onEndRef.current();
      }
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // After the text has laid out: a short chapter is all on the screen from the start.
    const first = window.setTimeout(measure, 400);
    document.addEventListener('scroll', soon, { passive: true, capture: true });
    window.addEventListener('resize', soon);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(first);
      document.removeEventListener('scroll', soon, { capture: true });
      window.removeEventListener('resize', soon);
    };
  }, [textId]);

  const pct = Math.round(share * 100);
  /** A tap on the line goes to that share of the chapter. */
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const text = document.querySelector<HTMLElement>('.rd-text');
    if (!text) return;
    const r = e.currentTarget.getBoundingClientRect();
    const want = (e.clientX - r.left) / r.width;
    const top = document.querySelector('.rd-pin')?.getBoundingClientRect().bottom ?? 0;
    const bottom = document.querySelector('.rd-foot')?.getBoundingClientRect().top ?? window.innerHeight;
    const t = text.getBoundingClientRect();
    const lines = text.querySelectorAll('.sent');
    const end = lines.length ? lines[lines.length - 1]!.getBoundingClientRect().bottom : t.bottom;
    const by = top - t.top - want * Math.max(0, end - t.top - (bottom - top));
    scrollerOf(text).scrollBy({ top: -by, behavior: 'smooth' });
  }

  return (
    <nav className="rd-foot no-print" aria-label="Where you are">
      {onContents ? (
        <button className="rd-foot-btn" aria-label="Chapters" title="Chapters" onClick={onContents}>
          <Icon name="contents" size={22} />
        </button>
      ) : (
        <span className="rd-foot-btn" aria-hidden />
      )}
      <button className="rd-foot-btn" aria-label={prevLabel} title={prevLabel} disabled={!onPrev} onClick={onPrev ?? undefined}>
        <Icon name="back" size={20} />
      </button>
      <span className="rd-foot-pct">{pct}%</span>
      <div className="rd-foot-track" role="progressbar" aria-label="How far down this chapter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} onClick={seek}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <button className="rd-foot-btn" aria-label={nextLabel} title={nextLabel} disabled={!onNext} onClick={onNext ?? undefined}>
        <Icon name="chevron" size={20} />
      </button>
    </nav>
  );
}

/** What scrolls the text: the nearest box that scrolls, else the page. */
function scrollerOf(el: HTMLElement): Element | Window {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return window;
}
