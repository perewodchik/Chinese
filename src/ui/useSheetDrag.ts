import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Pulling a bottom sheet down to close it.
 *
 * On a phone the drawer is the screen, and a panel that covers the screen has
 * to be dismissible the way every other full-screen panel on the device is:
 * by pushing it back down. The close button stays — a thumb at the top of a
 * 6-inch screen is a stretch, and a swipe is the shorter route from where the
 * hand already is.
 *
 * Two places start a drag. The grip under the top edge always does, and takes
 * `touch-action: none` so the browser hands the gesture over rather than
 * trying to scroll. The body starts one only when it is already scrolled to
 * the top and the finger has travelled ten-odd pixels downwards — before that
 * threshold a touch is still a tap, so buttons and links inside the sheet
 * keep working.
 */

const PHONE = '(max-width: 640px)';

/** Long enough to see it leave, short enough not to wait for it. */
const LEAVE_MS = 180;

/** How far down, or how fast, counts as meaning it. */
const CLOSE_DISTANCE = 120;
const FLICK_SPEED = 0.5; // px per ms
const FLICK_DISTANCE = 40;

const START_THRESHOLD = 10;

interface Origin {
  y: number;
  x: number;
  t: number;
  /** a body drag has to earn the right to begin; a grip drag has it already */
  armed: boolean;
}

export interface SheetDrag {
  /** whether the sheet is a bottom sheet at all right now */
  phone: boolean;
  /** closes it the way the gesture does, so Escape and the button match */
  close: () => void;
  gripProps: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: () => void;
  };
  sheetProps: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: () => void;
    style: { transform?: string; transition?: string };
    'data-dragging'?: true;
  };
  /** goes on the scrim, which fades as the sheet goes */
  leaving: boolean;
}

export function useSheetDrag(onClose: () => void): SheetDrag {
  const [phone, setPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PHONE).matches,
  );
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const from = useRef<Origin | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const onChange = () => setPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const close = useCallback(() => {
    if (!phone) {
      onClose();
      return;
    }
    setLeaving(true);
    timer.current = window.setTimeout(onClose, LEAVE_MS);
  }, [onClose, phone]);

  const begin = (armed: boolean) => (e: ReactPointerEvent) => {
    if (!phone || leaving || e.button !== 0) return;
    // The sheet scrolls; a drag that starts halfway down a scrolled page is a
    // scroll, and turning it into a dismissal would make the sheet unreadable.
    if (!armed) {
      const el = e.currentTarget as HTMLElement;
      if (el.scrollTop > 0) return;
    }
    from.current = { y: e.clientY, x: e.clientX, t: performance.now(), armed };
    if (armed) {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      setDragging(true);
    }
  };

  const move = (e: ReactPointerEvent) => {
    const origin = from.current;
    if (!origin) return;
    const d = e.clientY - origin.y;
    if (!origin.armed) {
      // Sideways, or upwards, or not far enough yet: leave it alone.
      if (d < START_THRESHOLD || Math.abs(e.clientX - origin.x) > d) {
        if (d < -START_THRESHOLD) from.current = null;
        return;
      }
      origin.armed = true;
      origin.y = e.clientY;
      origin.t = performance.now();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      setDragging(true);
      return;
    }
    // Upwards it barely moves: there is nothing above it to reveal.
    setDy(d > 0 ? d : d / 6);
  };

  const end = (e: ReactPointerEvent) => {
    const origin = from.current;
    from.current = null;
    if (!origin?.armed) return;
    setDragging(false);
    const d = e.clientY - origin.y;
    const speed = d / Math.max(1, performance.now() - origin.t);
    if (d > CLOSE_DISTANCE || (d > FLICK_DISTANCE && speed > FLICK_SPEED)) {
      setDy(0);
      close();
    } else {
      setDy(0);
    }
  };

  const cancel = () => {
    from.current = null;
    setDragging(false);
    setDy(0);
  };

  const handlers = (armed: boolean) => ({
    onPointerDown: begin(armed),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: cancel,
  });

  return {
    phone,
    close,
    leaving,
    gripProps: handlers(true),
    sheetProps: {
      ...handlers(false),
      style: !phone
        ? {}
        : leaving
          ? { transform: 'translateY(100%)' }
          : dragging
            ? { transform: `translateY(${dy}px)`, transition: 'none' }
            : {},
      ...(dragging ? { 'data-dragging': true as const } : {}),
    },
  };
}
