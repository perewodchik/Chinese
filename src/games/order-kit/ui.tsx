import { useContext, useState, type ReactNode } from 'react';
import { picturesFor } from '../../data/pictures';
import menuManifest from '../../data/menuPictures.json';
import { AppContext, useApp } from './app';
import { yuan } from './order';
import type { Brand } from './types';

/**
 * Small parts the screens share: the menu photo, the price, the stepper, the
 * bottom sheet and the cart icon.
 */

interface MenuPic {
  src: string;
  by: string;
  lic: string;
}

const menu = menuManifest as { pictures: Record<string, { w: number; h: number; by: string; lic: string; src: string }> };

/**
 * The photo for a menu key: the menu set's own photo when it has one, else
 * the word photo that stands in for it (a cup of coffee for the lattes), else
 * an empty box of the same size — never a drawing in place of food.
 */
export function menuPicture(brand: Brand, key: string): MenuPic | null {
  const own = menu.pictures[key];
  if (own) return { src: `/images/menu/${key}.jpg`, by: own.by, lic: own.lic };
  const word = brand.photos[key]?.word;
  const p = word ? picturesFor(word)?.picture : null;
  return p ? { src: p.src, by: p.by, lic: p.lic } : null;
}

export function MenuPhoto({ photo, className, brand: given }: { photo: string; className?: string; brand?: Brand }) {
  const app = useContext(AppContext);
  const brand = given ?? app!.brand;
  const pic = menuPicture(brand, photo);
  const [ready, setReady] = useState(false);
  return (
    <span className={className ? `ok-photo ${className}` : 'ok-photo'}>
      {pic && (
        <img
          src={pic.src}
          alt=""
          draggable={false}
          data-ready={ready || undefined}
          onLoad={() => setReady(true)}
        />
      )}
    </span>
  );
}

export function PhotoCredit({ photo }: { photo: string }) {
  const { brand } = useApp();
  const pic = menuPicture(brand, photo);
  if (!pic) return <span className="ok-credit"> </span>;
  return (
    <span className="ok-credit">
      Photo: {pic.by} · {pic.lic}
    </span>
  );
}

/** ¥23.5 — the yuan sign small, the number large. */
export function Price({ v, className, read }: { v: number; className?: string; read?: string }) {
  return (
    <span className={className ? `ok-price ${className}` : 'ok-price'} data-read={read}>
      <small>¥</small>
      {yuan(v)}
    </span>
  );
}

export function Was({ v }: { v: number }) {
  return <s className="ok-was">¥{yuan(v)}</s>;
}

export function Stepper({
  qty,
  onMinus,
  onPlus,
  minusHint,
  plusHint,
  min = 0,
}: {
  qty: number;
  onMinus(): void;
  onPlus(): void;
  minusHint?: string;
  plusHint?: string;
  min?: number;
}) {
  return (
    <span className="ok-stepper">
      <button type="button" className="ok-step minus" aria-label="one fewer" disabled={qty <= min} onClick={onMinus} data-hint={minusHint}>
        −
      </button>
      <span className="ok-qty">{qty}</span>
      <button type="button" className="ok-step plus" aria-label="one more" onClick={onPlus} data-hint={plusHint}>
        +
      </button>
    </span>
  );
}

/** A bottom sheet over the screen: dims it, slides up, closes on the scrim. */
export function Sheet({
  onClose,
  children,
  className,
  label,
  closeHint,
}: {
  onClose(): void;
  children: ReactNode;
  className?: string;
  label: string;
  closeHint?: string;
}) {
  return (
    <div className="ok-sheet-wrap">
      <div className="ok-scrim" onClick={onClose} data-hint={closeHint} />
      <div className={className ? `ok-sheet ${className}` : 'ok-sheet'} role="dialog" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function CartIcon() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
      <path d="M5 8h3l3 13h13l3-10H10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="13" cy="25.5" r="2" fill="currentColor" />
      <circle cx="22" cy="25.5" r="2" fill="currentColor" />
    </svg>
  );
}

/** A made-up QR code from the seed: decorative, never scannable. */
export function FakeQr({ seed }: { seed: string }) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const n = 21;
  const cells: ReactNode[] = [];
  const finder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      h = Math.imul(h ^ (x * 31 + y), 2654435761) >>> 0;
      if (h % 5 < 2) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  }
  const eye = (x: number, y: number) => (
    <g key={`e${x}${y}`}>
      <rect x={x} y={y} width="7" height="7" />
      <rect x={x + 1} y={y + 1} width="5" height="5" className="ok-qr-bg" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  );
  return (
    <svg className="ok-qr" viewBox={`-1 -1 ${n + 2} ${n + 2}`} aria-hidden>
      <rect x="-1" y="-1" width={n + 2} height={n + 2} className="ok-qr-bg" />
      {cells}
      {eye(0, 0)}
      {eye(n - 7, 0)}
      {eye(0, n - 7)}
    </svg>
  );
}
