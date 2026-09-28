import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { Brand } from './types';
import { useHelp } from './help';
import { glossFor } from './gloss';

/**
 * The first-visit tour: numbered coach marks over the real menu screen,
 * each with the Chinese, the pinyin and the English. It can be skipped, and
 * replayed from the guide. Whether it has been seen is kept per device.
 */

const seenKey = (brand: Brand) => `hanzi-workshop/order-tour/${brand.id}`;

export function tourSeen(brand: Brand): boolean {
  try {
    return localStorage.getItem(seenKey(brand)) === '1';
  } catch {
    return false;
  }
}

export function markTourSeen(brand: Brand) {
  try {
    localStorage.setItem(seenKey(brand), '1');
  } catch {
    /* per device only */
  }
}

export function Tour({ brand, phone, onDone }: { brand: Brand; phone: RefObject<HTMLElement>; onDone(): void }) {
  const help = useHelp();
  const [i, setI] = useState(0);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number; ph: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(0);
  const step = brand.tour[i];

  useLayoutEffect(() => {
    const measure = () => {
      const root = phone.current?.querySelector<HTMLElement>('.ok-app');
      const el = root?.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!root || !el) return setBox(null);
      const r = el.getBoundingClientRect();
      const p = root.getBoundingClientRect();
      setBox({ x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height, ph: p.height });
    };
    // The mark may be further down the menu (the first dish with choices is
    // among the roast meats at 点都德): bring it into view inside the phone
    // first, or the card would sit under it, off the screen.
    reveal(phone.current?.querySelector<HTMLElement>(`.ok-app [data-tour="${step.target}"]`) ?? null);
    measure();
    // again once the screen has slid in (or scrolled), and whenever the stage changes size
    const t = window.setTimeout(measure, 260);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [i, step, phone]);

  useLayoutEffect(() => setCardH(card.current?.offsetHeight ?? 0), [i, box]);

  const done = () => {
    markTourSeen(brand);
    onDone();
  };
  const g = glossFor(step.zh, help.gl);
  // The card goes below the mark if it fits there, else above it; a mark as
  // tall as the phone (the category rail) leaves room for neither, and the
  // card lies over it. Either way it stays on the phone.
  const top = (() => {
    if (!box) return null;
    const gap = 14;
    const fitsBelow = box.y + box.h + gap + cardH <= box.ph - 8;
    const fitsAbove = box.y - gap - cardH >= 8;
    const want = fitsBelow ? box.y + box.h + gap : fitsAbove ? box.y - gap - cardH : box.ph - cardH - 24;
    return Math.max(8, Math.min(want, box.ph - cardH - 8));
  })();

  return (
    <div className="ok-tour" role="dialog" aria-label="Tour of the menu">
      {box && <div className="ok-tour-hole" style={{ left: box.x - 4, top: box.y - 4, width: box.w + 8, height: box.h + 8 }} />}
      <div ref={card} className="ok-tour-card" style={{ top: top ?? '40%' }}>
        <div className="ok-tour-n tiny muted">
          {i + 1} of {brand.tour.length}
        </div>
        <div className="ok-tour-zh">
          <span className="hanzi">{step.zh}</span> <span className="ok-gloss-py">{g.py}</span>
        </div>
        <p className="small">{step.en}</p>
        <div className="ok-tour-actions">
          <button type="button" className="btn ghost sm" onClick={done}>
            Skip
          </button>
          <span className="spacer" />
          {i > 0 && (
            <button type="button" className="btn sm" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          <button type="button" className="btn primary sm" onClick={() => (i + 1 < brand.tour.length ? setI(i + 1) : done())} autoFocus>
            {i + 1 < brand.tour.length ? 'Next' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Scroll the nearest scrolling box inside the phone so `el` is in its middle — never the page. */
function reveal(el: HTMLElement | null) {
  for (let box = el?.parentElement; el && box && !box.classList.contains('ok-app'); box = box.parentElement) {
    if (box.scrollHeight <= box.clientHeight + 1) continue;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.top >= b.top && r.bottom <= b.bottom) return;
    box.scrollTop += r.top - b.top - (b.height - r.height) / 2;
    return;
  }
}
