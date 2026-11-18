import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { ItemId } from '../../domain/ids';
import { LEVEL_NAME } from '../../domain/memory';
import { hskLabel } from '../../domain/text';
import { setShelfStudy } from '../../store/commands';
import { Icon } from '../../ui/Icon';
import { LevelQuick } from '../../ui/LevelPicker';
import { Say } from '../../ui/Say';
import { useWordLevel } from '../shared/levels';

export interface Peeked {
  word: string;
  id: ItemId;
  /** the word on the page, which the card is placed by */
  el: HTMLElement;
  py: string;
  meaning: string;
  band: number | null;
}

/** Where the card sits: a strip on the bottom edge of a phone, or by what it is about. */
export type Place = { kind: 'strip' } | { kind: 'below' | 'above'; left: number; top: number; arrow: number };

/** Where what is pinned to the top ends: the bar, and the narrator's row under it while it is open. */
export function pinnedBottom(fallback = 0): number {
  const bar = document.querySelector('.rd-pin')?.getBoundingClientRect().bottom;
  const dock = document.querySelector('.rd-dock:not([hidden])')?.getBoundingClientRect().bottom;
  return Math.max(bar ?? fallback, dock ?? 0);
}

const GAP = 10;
const EDGE = 12;

/**
 * Where a card about something on the page goes. A phone gets a strip along
 * the bottom, under the thumb and over nothing but the last lines. Anywhere
 * else it is a popover by the thing itself: below it, or above it when it is
 * low on the screen, its pointer at the middle of it. (It used to go into a
 * wide page's margin, level with the line: on an iPad on its side that put
 * it a hand's width from the word, over the glosses, and it read as lost.)
 *
 * A sentence wraps over lines: the card goes under its last line, or over
 * its first, and points at that line.
 */
export function placeFor(el: HTMLElement, card: HTMLElement | null): Place {
  if (window.innerWidth < 700) return { kind: 'strip' };
  const rects = [...el.getClientRects()].filter((r) => r.width > 0);
  const whole = el.getBoundingClientRect();
  const first = rects[0] ?? whole;
  const last = rects[rects.length - 1] ?? whole;
  const width = card?.offsetWidth ?? 340;
  const height = card?.offsetHeight ?? 170;
  const pinned = pinnedBottom();
  const at = (r: DOMRect) => {
    const left = Math.max(EDGE, Math.min(window.innerWidth - width - EDGE, r.left + r.width / 2 - width / 2));
    return { left, arrow: Math.max(16, Math.min(width - 32, r.left + r.width / 2 - left - 8)) };
  };
  const below = whole.bottom + GAP;
  if (below + height <= window.innerHeight - EDGE) return { kind: 'below', top: below, ...at(last) };
  return { kind: 'above', top: Math.max(pinned + GAP, first.top - GAP - height), ...at(first) };
}

/**
 * A tapped word, in brief: its pinyin, its meaning, how well you know it and
 * whether it is on the book's list, with the whole word drawer a tap away. It
 * is small so the reading goes on around it: a tap on another word changes
 * it, a tap anywhere else or Escape puts it away.
 */
export function WordPeek({
  peek,
  setId,
  onShelf,
  onMore,
  onClose,
}: {
  peek: Peeked;
  /** the book whose list "Learn this word" puts it on; none for a text on its own */
  setId: string | null;
  onShelf: boolean;
  onMore: () => void;
  onClose: () => void;
}) {
  const levelOfWord = useWordLevel();
  const level = levelOfWord(peek.word);
  const card = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place>(() => placeFor(peek.el, null));

  const measure = useCallback(() => setPlace(placeFor(peek.el, card.current)), [peek.el]);
  // Placed again once it has its size, and whenever the page under it moves.
  useLayoutEffect(measure, [measure, level, onShelf]);
  useEffect(() => {
    let frame = 0;
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), measure()));
    };
    document.addEventListener('scroll', soon, true);
    window.addEventListener('resize', soon);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', soon, true);
      window.removeEventListener('resize', soon);
    };
  }, [measure]);

  // A phone: the word is kept above the strip, not under it.
  // Checked again as the card takes its height (its fonts and sound button arrive a moment after it).
  useEffect(() => {
    const c = card.current;
    if (place.kind !== 'strip' || !c) return;
    const keepClear = () => {
      const r = peek.el.getBoundingClientRect();
      // From its resting place, not its box: the card is still rising into it when it is first measured.
      const clear = window.innerHeight - (parseFloat(getComputedStyle(c).bottom) || 0) - c.offsetHeight - 16;
      if (r.bottom > clear) document.querySelector('.main')?.scrollBy({ top: r.bottom - clear + 24, behavior: 'smooth' });
    };
    const seen = new ResizeObserver(keepClear);
    seen.observe(c);
    return () => seen.disconnect();
  }, [peek.el, place.kind]);

  // Away with a tap anywhere but the card or another word (a word opens its own), and with Escape.
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (card.current?.contains(t) || t.closest('.rd-zh .w')) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  const style: CSSProperties =
    place.kind === 'strip' ? {} : ({ left: place.left, top: place.top, '--arrow': `${place.arrow}px` } as CSSProperties);
  const about = [peek.band ? hskLabel(peek.band) : null, level === 0 ? 'new to you' : null].filter(Boolean).join(', ');

  return (
    <div ref={card} className="rd-peek no-print" data-place={place.kind} style={style} role="dialog" aria-label={peek.word}>
      {place.kind === 'strip' && <span className="rd-peek-grab" aria-hidden />}
      <button className="rd-peek-top" onClick={onMore} aria-label={`All about ${peek.word}`}>
        <span className="rd-peek-word hanzi" lang="zh">
          {peek.word}
        </span>
        <span className="rd-peek-what">
          <b>{peek.py}</b>
          <span>{peek.meaning || 'No meaning on file yet'}</span>
          {/* Its line kept when it says nothing, so the card keeps its height from word to word. */}
          <small>{about ? about[0]!.toUpperCase() + about.slice(1) : '\u00a0'}</small>
        </span>
        <span className="rd-peek-more" aria-hidden>
          <Icon name="chevron" size={20} />
        </span>
      </button>
      <div className="rd-peek-acts">
        <Say text={peek.word} size="lg" />
        <span className="rd-peek-level">
          <LevelQuick id={peek.id} level={level} />
          <span>{LEVEL_NAME[level]}</span>
        </span>
        <span className="spacer" />
        {setId &&
          (level >= 2 && !onShelf ? (
            <span className="rd-peek-known">
              <Icon name="check" size={16} /> Known
            </span>
          ) : (
            <button className={`btn sm ${onShelf ? 'tonal' : 'ghost'} rd-peek-learn`} aria-pressed={onShelf} onClick={() => setShelfStudy(setId, [peek.id], !onShelf)}>
              <Icon name={onShelf ? 'check' : 'plus'} size={16} /> {onShelf ? 'On your list' : 'Learn this word'}
            </button>
          ))}
      </div>
    </div>
  );
}
