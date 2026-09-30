import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Drag to move, pinch or scroll to zoom, glide to a frame — for an SVG
 * drawing whose view box follows the shape of its box on the page (the
 * neighbourhood plans and the metro diagram of the 🗺 panel).
 *
 * `bounds` is the drawing; the view never goes past its edges (fully out,
 * the whole of it, centred), and never closes in beyond `minW` units across.
 * `pad` is room past each edge in screen pixels, for names that keep their
 * size at any zoom.
 */

export type Pad = { l: number; r: number; t: number; b: number };

export type View = { x: number; y: number; w: number; h: number };

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function usePanZoom(bounds: View, minW: number, pad: Pad = { l: 0, r: 0, t: 0, b: 0 }) {
  const svg = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 800, h: 500 });
  /** the box has been measured once (a frame set before that is lost to the first measure) */
  const [measured, setMeasured] = useState(false);
  const [view, setView] = useState<View>(bounds);
  const viewRef = useRef(view);
  viewRef.current = view;
  const aspectRef = useRef(1.6);
  aspectRef.current = box.w / Math.max(1, box.h);
  const boxRef = useRef(box);
  boxRef.current = box;
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const padRef = useRef(pad);
  padRef.current = pad;
  const anim = useRef(0);
  const dragged = useRef(false);

  const clamp = useCallback(
    (v: View, a = aspectRef.current): View => {
      const b = boundsRef.current;
      const p = padRef.current;
      const bw = boxRef.current.w;
      const bh = bw / a;
      // furthest out is the whole drawing and its padding, fitted to the box's shape
      const most = Math.max((b.w * bw) / Math.max(1, bw - p.l - p.r), (b.h * bw) / Math.max(1, bh - p.t - p.b));
      const w = Math.min(most, Math.max(minW, v.w));
      const h = w / a;
      const u = w / bw;
      // on each axis: wider than the drawing, it sits in the middle; narrower, its edges stay on it
      const axis = (at: number, size: number, from: number, len: number) =>
        size >= len ? from + (len - size) / 2 : Math.min(from + len - size, Math.max(from, at));
      return {
        w,
        h,
        x: axis(v.x, w, b.x - p.l * u, b.w + (p.l + p.r) * u),
        y: axis(v.y, h, b.y - p.t * u, b.h + (p.t + p.b) * u),
      };
    },
    [minW],
  );

  /** a frame widened to the box's shape, centred on it */
  const fit = useCallback(
    (f: View): View => {
      const a = aspectRef.current;
      const w = Math.max(f.w, f.h * a);
      return clamp({ x: f.x + f.w / 2 - w / 2, y: f.y + f.h / 2 - w / a / 2, w, h: w / a }, a);
    },
    [clamp],
  );

  const glide = useCallback(
    (to: View, now = false) => {
      cancelAnimationFrame(anim.current);
      const from = viewRef.current;
      const target = fit(to);
      if (now || reduced()) {
        setView(target);
        return;
      }
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 380);
        const e = 1 - (1 - k) ** 3;
        setView({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
        if (k < 1) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [fit],
  );
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  const zoomAt = useCallback(
    (k: number, fx: number, fy: number) => {
      cancelAnimationFrame(anim.current);
      const v = viewRef.current;
      const r = (v.w * k) / v.w;
      setView(clamp({ x: fx - (fx - v.x) * r, y: fy - (fy - v.y) * r, w: v.w * k, h: v.h * k }));
    },
    [clamp],
  );
  const zoomBy = (k: number) => {
    const v = viewRef.current;
    zoomAt(k, v.x + v.w / 2, v.y + v.h / 2);
  };
  const toUnits = (clientX: number, clientY: number) => {
    const r = svg.current!.getBoundingClientRect();
    const v = viewRef.current;
    return [v.x + ((clientX - r.left) / r.width) * v.w, v.y + ((clientY - r.top) / r.height) * v.h] as const;
  };

  // the box's size, and its shape for the view
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    let first = true;
    const ro = new ResizeObserver(() => {
      const next = { w: el.clientWidth || 800, h: el.clientHeight || 500 };
      setBox(next);
      boxRef.current = next;
      const v = viewRef.current;
      const a = next.w / Math.max(1, next.h);
      aspectRef.current = a;
      // the first measure frames the whole drawing; later ones keep the middle where it was
      if (first) setView(fit(v));
      else setView(clamp({ x: v.x, y: v.y + v.h / 2 - v.w / a / 2, w: v.w, h: v.w / a }, a));
      first = false;
      setMeasured(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [clamp, fit]);

  // scroll (or a trackpad pinch) zooms where the pointer is
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const [fx, fy] = toUnits(e.clientX, e.clientY);
      zoomAt(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), fx, fy);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomAt]);

  // drag to move, two fingers to pinch; a drag is not a tap
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent) => {
    cancelAnimationFrame(anim.current);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) dragged.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) };
    }
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      const prev = pointers.current.get(ev.pointerId);
      if (!prev) return;
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) dragged.current = true;
      pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const r = svg.current!.getBoundingClientRect();
      const v = viewRef.current;
      if (pointers.current.size === 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        const [fx, fy] = toUnits((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
        zoomAt(pinch.current.d / Math.max(1, d), fx, fy);
        pinch.current = { d };
        return;
      }
      if (!dragged.current) return;
      setView(clamp({ ...v, x: v.x - ((ev.clientX - prev.x) / r.width) * v.w, y: v.y - ((ev.clientY - prev.y) / r.height) * v.h }));
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      pointers.current.delete(ev.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  /** one screen pixel in the drawing's units: marks and names keep their size at any zoom */
  const u = view.w / Math.max(1, box.w);
  return { svg, view, box, measured, u, glide, zoomBy, onPointerDown, dragged };
}
