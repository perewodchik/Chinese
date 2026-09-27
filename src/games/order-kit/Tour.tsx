import { useLayoutEffect, useState, type RefObject } from 'react';
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
    measure();
    // again once the screen has slid in, and whenever the stage changes size
    const t = window.setTimeout(measure, 260);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [i, step, phone]);

  const done = () => {
    markTourSeen(brand);
    onDone();
  };
  const g = glossFor(step.zh, help.gl);
  // the card goes below the mark, or above it when the mark is low on the phone
  const below = !box || box.y + box.h / 2 < box.ph / 2;

  return (
    <div className="ok-tour" role="dialog" aria-label="Tour of the menu">
      {box && <div className="ok-tour-hole" style={{ left: box.x - 4, top: box.y - 4, width: box.w + 8, height: box.h + 8 }} />}
      <div
        className="ok-tour-card"
        style={box ? (below ? { top: box.y + box.h + 14 } : { bottom: box.ph - box.y + 14 }) : { top: '40%' }}
      >
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
