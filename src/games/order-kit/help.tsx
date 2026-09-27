import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { say } from '../../platform/audio/voiceOut';
import { glossFor } from './gloss';
import type { Gloss } from './types';

/**
 * The help layer: Chinese is shown on its own, as in the real app, and help
 * is one long press away.
 *
 * Every Chinese string in the kit goes through <T>. Pressing and holding it
 * (about 450 ms, cancelled if the finger moves) opens a small popover with
 * the pinyin, the English and a note, and swallows the tap that would
 * otherwise follow — so a normal tap keeps its normal meaning. With 拼 on,
 * pinyin sits over every label as ruby. The popover lives in a portal and
 * never moves the layout.
 */

export interface HelpApi {
  gl: Record<string, Gloss>;
  pinyin: boolean;
  /** texts the voice pack has a native recording of */
  native: Set<string>;
  /** a string was looked up (counts towards the help rule) */
  looked(zh: string): void;
}

const Ctx = createContext<HelpApi | null>(null);
export const HelpProvider = Ctx.Provider;

export function useHelp(): HelpApi {
  const h = useContext(Ctx);
  if (!h) throw new Error('<T> outside the order kit');
  return h;
}

/* ------------------------------------------------------------ the popover */

interface Open {
  zh: string;
  rect: DOMRect;
}

let openPopover: (o: Open | null) => void = () => {};

/** Open the popover for a string, anchored to an element. */
export function lookUp(zh: string, el: Element) {
  openPopover({ zh, rect: el.getBoundingClientRect() });
}

/** Swallow the click that ends a long press, so the button under it does not fire. */
function swallowNextClick() {
  const stop = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 600);
}

const HOLD = 450;
const SLOP = 8;

/** Press and hold: fires once after HOLD ms unless the pointer moves or lifts. */
export function useLongPress(onHold: (el: HTMLElement) => void) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  useEffect(() => cancel, []);
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const el = e.currentTarget;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        swallowNextClick();
        onHold(el);
      }, HOLD);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

/** A Chinese string on the phone: long press to look it up, ruby when 拼 is on. */
export function T({ children: zh, className }: { children: string; className?: string }) {
  const h = useHelp();
  const press = useLongPress((el) => {
    h.looked(zh);
    lookUp(zh, el);
  });
  const g = h.pinyin ? glossFor(zh, h.gl) : null;
  return (
    <span className={className ? `ok-t ${className}` : 'ok-t'} data-zh={zh} {...press}>
      {g ? (
        <ruby>
          {zh}
          <rt>{g.py}</rt>
        </ruby>
      ) : (
        zh
      )}
    </span>
  );
}

/** A speaker for a native recording — and nothing at all when there is none. */
export function NativeSay({ text }: { text: string }) {
  const h = useHelp();
  if (!h.native.has(text)) return null;
  return (
    <button
      type="button"
      className="say sm"
      aria-label={`Hear ${text}`}
      title={`Hear ${text} (native recording)`}
      onClick={(e) => {
        e.stopPropagation();
        void say(text);
      }}
    >
      🔊
    </button>
  );
}

/** Pinyin, English and a note for one string: the popover's body, and the guide's. */
export function GlossBody({ zh, big }: { zh: string; big?: boolean }) {
  const h = useHelp();
  const g = glossFor(zh, h.gl);
  return (
    <div className="ok-gloss">
      <div className="ok-gloss-head">
        <span className={big ? 'hanzi ok-gloss-zh big' : 'hanzi ok-gloss-zh'}>{zh}</span>
        <NativeSay text={zh} />
      </div>
      <div className="ok-gloss-py">{g.py}</div>
      <div className="ok-gloss-en">{g.en}</div>
      {g.note && <div className="tiny muted">{g.note}</div>}
      {g.parts.length > 1 && (
        <ul className="ok-gloss-parts">
          {g.parts.map((p, i) => (
            <li key={i}>
              <span className="hanzi">{p.t}</span>
              <span className="ok-gloss-py">{p.g.py}</span>
              <span className="tiny">{p.g.en}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The one popover, in a portal. Mounted once by the game. */
export function Popover({ help, extra }: { help: HelpApi; extra?: (zh: string) => ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    openPopover = setOpen;
    return () => {
      openPopover = () => {};
    };
  }, []);

  useLayoutEffect(() => {
    if (!open || !box.current) return setPos(null);
    const b = box.current.getBoundingClientRect();
    const r = open.rect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - b.width / 2), vw - b.width - 8);
    const below = r.bottom + 8;
    const top = below + b.height < vh - 8 ? below : Math.max(8, r.top - b.height - 8);
    setPos({ left, top });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (box.current && e.target instanceof Node && box.current.contains(e.target)) return;
      setOpen(null);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    // the pointerup that ended the long press must not close it
    const t = window.setTimeout(() => {
      window.addEventListener('pointerdown', close, true);
      window.addEventListener('scroll', close, true);
    }, 0);
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <Ctx.Provider value={help}>
      <div
        ref={box}
        className="ok-pop"
        role="dialog"
        aria-label={`What ${open.zh} means`}
        style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
      >
        <GlossBody zh={open.zh} big />
        {extra?.(open.zh)}
      </div>
    </Ctx.Provider>,
    document.body,
  );
}
